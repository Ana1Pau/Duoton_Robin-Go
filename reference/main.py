"""Hybrid farm controller: strategic recipes, short committed routes and reactive safety.

Original extension of our 106399412-inspired baseline. No third-party action tapes.
Standard library only. Verified against kaggle-environments 1.32.7.
Create independent instances with make_agent(); agent is the submission entry point.
"""
import math
from collections import Counter

PARAMS = {
    "cash_buffer": 220,
    "max_hands": 12,
    "work_per_hand": 18,
    "wheat_age": 4,
    "carrot_age": 3,
    "feed_buffer_days": 0.5,
    "max_quadrants": 3,
    "milk_animals": 10,
    "wool_animals": 4,
    "melon_target": 10,
    "strawberry_target": 28,
    "herd_expansion_day": 3,
}
CROPS = {
    # seed cost, first mature day, preferred harvest day, yield cap, ongoing
    "WHEAT": (10, 2, 4, 6, False),
    "CARROT": (20, 2, 3, 4, False),
    "MELON": (80, 10, 10, 6, False),
    "STRAWBERRY": (100, 10, 16, 4, True),
    "TOMATO": (50, 8, 11, 4, True),
}
ANIMALS = {"COW": (400, "PASTURE", "MILK", 8, 2, 6),
           "SHEEP": (500, "PASTURE", "WOOL", 6, 3, 6),
           "GOOSE": (300, "COOP", "EGG", 4, 1, 4)}
PRODUCTS = tuple(CROPS) + ("MILK", "WOOL", "EGG", "FERTILIZER")


def distance(a, b):
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


def move(a, b):
    if a[0] < b[0]: return ["EAST"]
    if a[0] > b[0]: return ["WEST"]
    if a[1] < b[1]: return ["SOUTH"]
    if a[1] > b[1]: return ["NORTH"]
    return ["PASS"]


def fib(n):
    a, b = 1, 1
    for _ in range(n): a, b = b, a + b
    return a


def plan(obs, configuration=None, params=None, route_memory=None, trace=None):
    """Compute physical tasks, reserve shared resources, and execute one route step."""
    p = dict(PARAMS)
    if params: p.update(params)
    route_memory = route_memory if route_memory is not None else {}
    next_routes = {}
    cfg = configuration or {}
    me = obs["farms"][obs["player"]]
    private = obs["private"]
    tiles = me["tiles"]
    size = len(tiles)
    half = size // 2
    access = [(half-1, half-1), (half, half-1), (half-1, half), (half, half)]
    nearest = lambda pos: min(access, key=lambda x: (distance(pos, x), x))
    tpd = int(cfg.get("turnsPerDay", 24))
    last_step = int(cfg.get("episodeSteps", 720)) - 2
    day, hour = int(obs["day"]), int(obs["hour"])
    step = day * tpd + hour
    remaining = last_step - step + 1
    days_left = remaining / tpd
    final_day = day == last_step // tpd
    prices = obs["market"]["prices"]
    positions = [tuple(me["farmer"])] + [tuple(x) for x in me.get("hands", [])]
    inventories = [dict(x) for x in private["inventories"]]
    while len(inventories) < len(positions): inventories.append({})
    shed = dict(private["shed"])
    pickup_stock = dict(shed)
    seeds = dict(private["seeds"])
    cells = [(x,y,t) for y,row in enumerate(tiles) for x,t in enumerate(row) if t != "LOCKED"]
    plants = [(x,y,t) for x,y,t in cells if isinstance(t,dict) and t.get("kind")=="PLANT"]
    livestock = [(x,y,t) for x,y,t in cells if isinstance(t,dict) and t.get("animal")]
    crops = Counter(t["crop"] for x,y,t in plants)
    animals = Counter(t["animal"] for x,y,t in livestock)
    n_animals = len(livestock)
    unfed = sum(not t.get("fed_today") for x,y,t in livestock)
    quadrants = len(me.get("unlocked_quadrants", ["NW"]))
    max_orders = int(cfg.get("maxMarketOrdersPerTurn", 10))
    capacity = int(cfg.get("shedCapacity", 100))

    # Reserve near-shed sites for livestock. Crops occupy the remaining sites.
    ordered = sorted(((x,y) for x,y,t in cells), key=lambda z:(distance(z, nearest(z)),z[1],z[0]))
    if day < p.get("herd_expansion_day",8):
        goals = {"COW":min(2,p["milk_animals"]), "SHEEP":min(1,p["wool_animals"]),
                 "GOOSE":min(1,p.get("egg_animals",0))}
    else:
        goals = {"COW":min(p["milk_animals"],4*quadrants), "SHEEP":min(p["wool_animals"],3*quadrants),
                 "GOOSE":min(p.get("egg_animals",0),3*quadrants)}
    if days_left < 12:
        goals = dict(animals)
    # Planned animal sites persist by current unlocked geometry, not worker IDs.
    desired_animals = {(x,y):t["animal"] for x,y,t in livestock}
    vacant = [z for z in ordered if z not in desired_animals and
              (tiles[z[1]][z[0]] is None or
               isinstance(tiles[z[1]][z[0]],dict) and tiles[z[1]][z[0]].get("kind") in ("PASTURE","COOP","WEED"))]
    vacant.sort(key=lambda z:(0 if isinstance(tiles[z[1]][z[0]],dict) and tiles[z[1]][z[0]].get("kind")=="PASTURE" else 1, distance(z,nearest(z)),z))
    pending_animals={a:shed.get(a,0)+sum(v.get(a,0) for v in inventories) for a in ANIMALS}
    # Allocate homes to animals already purchased before planning new purchases.
    for item in ("COW","SHEEP","GOOSE"):
        for _ in range(pending_animals[item]):
            if vacant and days_left>ANIMALS[item][3]+2:
                desired_animals[vacant.pop(0)] = item
    for item in ("COW","SHEEP","GOOSE"):
        for _ in range(max(0,goals.get(item,0)-animals[item]-pending_animals[item])):
            if vacant and days_left>ANIMALS[item][3]+2:
                desired_animals[vacant.pop(0)] = item

    targets = {"WHEAT":max(p.get("wheat_target",7),n_animals), "MELON":p["melon_target"],
               "STRAWBERRY":min(p["strawberry_target"], max(0,quadrants*14-10)),
               "CARROT":p.get("carrot_target",max(2,quadrants*3)),
               "TOMATO":min(p.get("tomato_target",0),max(0,quadrants*8-4))}
    if day < 3: targets["STRAWBERRY"] = 0; targets["TOMATO"] = 0
    if prices.get("MELON",0)<35 and day>10: targets["MELON"] = 0
    if prices.get("STRAWBERRY",0)<20: targets["STRAWBERRY"] = 0
    def can_start(crop):
        duration = CROPS[crop][1] + 3 if CROPS[crop][4] else CROPS[crop][2]
        # Leave a full day for harvesting and realizing sales.
        return days_left > duration + 1
    choices = []
    for crop in ("MELON","WHEAT","STRAWBERRY","TOMATO","CARROT"):
        if not can_start(crop): continue
        gap = targets[crop] - crops[crop]
        if gap<=0: continue
        base = {"WHEAT":100, "MELON":130 if day<2 else 65, "STRAWBERRY":95, "TOMATO":90, "CARROT":70}[crop]
        if crop=="WHEAT" and n_animals and crops[crop]<n_animals: base+=35
        choices.append((base*gap/max(1,targets[crop]),crop,gap))
    choices.sort(reverse=True)
    # Crop allocations are temporary plans, recalculated after each action.
    crop_sites = [z for z in ordered if z not in desired_animals and
                  (tiles[z[1]][z[0]] is None or (isinstance(tiles[z[1]][z[0]],dict) and tiles[z[1]][z[0]].get("kind")=="WEED"))]
    plant_plan = {}
    for _,crop,gap in choices:
        for _ in range(min(gap,len(crop_sites))):
            plant_plan[crop_sites.pop(0)] = crop

    # Physical task: (priority, location, action, required inventory item).
    tasks = []
    def add(priority, pos, action, need=None):
        tasks.append((priority, pos, action, need))
    for x,y,t in plants:
        pos=(x,y); crop=t["crop"]; cd=CROPS[crop]
        age=day-t["planted_day"]
        mature=age>=cd[1] and t.get("yield_units",0)>0
        expiry=t.get("max_lifespan_step",-1)
        dying=expiry>=0 and expiry-step<tpd//2
        ready_age=p["wheat_age"] if crop=="WHEAT" else p["carrot_age"] if crop=="CARROT" else cd[2]
        ready=mature and (final_day or dying or (cd[4] and t["yield_units"]>=2) or
                         (not cd[4] and (age>=ready_age or t["yield_units"]>=cd[3])))
        # Water before harvesting on the final bonus day when there is time.
        bonus_due=(not cd[4] and not t.get("watered_today") and
                   (2 if crop in ("WHEAT","CARROT") else 6)<=age and t["yield_units"]<cd[3])
        if ready and (not bonus_due or final_day or dying):
            add(850 if dying or final_day else 330, pos, ["HARVEST"])
            continue
        if not t.get("watered_today") and not final_day:
            urgent=t.get("consecutive_unwatered",0)>=1
            add((650 if urgent else 270)+hour*3, pos, ["WATER"])
            # Apply only when the extra yield has higher approximate value than
            # selling the fertilizer. No external model or future hidden state.
            future_bonus=2*prices.get(crop,0)
            if t.get("fertilized_until_day",-1)<day and future_bonus>prices.get("FERTILIZER",100)*1.3:
                window=(crop in ("WHEAT","CARROT") and 1<=age<=2) or (crop=="MELON" and 5<=age<=8) or (cd[4] and age>=cd[1]-1)
                if window: add(290, pos, ["FERTILIZE"], "FERTILIZER")
        elif ready:
            add(330,pos,["HARVEST"])
    for x,y,t in livestock:
        pos=(x,y); item=t["animal"]; ad=ANIMALS[item]
        if not t.get("fed_today") and not final_day:
            add((900 if t.get("consecutive_unfed",0)>=1 else 480)+hour*5,pos,["FEED"],"WHEAT")
        if t.get("yield_units",0)>0:
            add(850 if final_day else 310 if t["yield_units"]>=ad[5]-1 else 180,pos,["HARVEST"])
        if t.get("fertilizer_available") and (not final_day or prices.get("FERTILIZER",0)>1):
            add(240,pos,["COLLECT_FERTILIZER"])
        if not t.get("cared_today") and t.get("fed_today") and not final_day:
            if prices.get(ad[2],0)>max(5,prices.get("WHEAT",25)*0.3): add(p.get("care_priority",300),pos,["CARE"])
    # Animal setup chain: build -> pick up animal -> place -> feed.
    if not final_day:
        on_hand=Counter()
        for inv in inventories: on_hand.update({k:v for k,v in inv.items() if k in ANIMALS})
        available_animals={a:shed.get(a,0)+on_hand[a] for a in ANIMALS}
        for pos,item in desired_animals.items():
            t=tiles[pos[1]][pos[0]]
            if isinstance(t,dict) and t.get("animal"): continue
            if available_animals.get(item,0)<=0: continue
            if t is None: add(400,pos,["BUILD_"+ANIMALS[item][1]])
            elif isinstance(t,dict) and t.get("kind") in ("WEED","COOP","PASTURE") and t.get("kind")!=ANIMALS[item][1]: add(350,pos,["DIG"])
            elif isinstance(t,dict) and t.get("kind")==ANIMALS[item][1]:
                add(900,pos,["PLACE",item,1],item)
            else: continue
            available_animals[item]-=1
        for pos,crop in plant_plan.items():
            t=tiles[pos[1]][pos[0]]
            if isinstance(t,dict) and t.get("kind")=="WEED": add(100,pos,["DIG"])
            elif seeds.get(crop,0)>0 and hour<tpd-3:
                add(140,pos,["PLANT",crop])

    actions=[["PASS"] for _ in positions]
    unassigned=set(range(len(positions)))
    reserved=set()
    deposit_space=max(0,capacity-sum(shed.values()))
    def deposit(i):
        nonlocal deposit_space
        inv=inventories[i]
        content={k:v for k,v in inv.items() if v>0}
        if not content or not deposit_space: return
        if sum(content.values())<=deposit_space:
            actions[i]=["DROP"]
            for item,n in content.items(): shed[item]=shed.get(item,0)+n
            deposit_space-=sum(content.values())
            inv.clear()
        else:
            item=max(content,key=lambda k:prices.get(k,0)*content[k])
            n=min(content[item],deposit_space)
            actions[i]=["PLACE",item,n]
            shed[item]=shed.get(item,0)+n;inv[item]-=n;deposit_space-=n
    # Final-day return is planned backwards from the LAST EXECUTABLE action.
    for i,pos in enumerate(positions):
        inv=inventories[i]
        carried=sum(inv.values())
        home=nearest(pos); travel=distance(pos,home)
        total_stock=sum(shed.values())+sum(sum(v.values()) for v in inventories)
        return_now=carried>0 and (final_day and remaining<=travel+3 or
                  carried>=18 or total_stock>=capacity-12 and hour>=tpd-6)
        if return_now:
            if pos==home:
                deposit(i)
            else: actions[i]=move(pos,home)
            unassigned.remove(i)
    # Greedy bipartite assignment with hard task deadlines and inventory
    # reservation. Distances enter as action counts, not as fictitious money.
    while unassigned:
        best=None
        for i in sorted(unassigned):
            pos=positions[i]; inv=inventories[i]
            for j,(priority,target,command,need) in enumerate(tasks):
                if target in reserved: continue
                if command[0]=="PLANT" and seeds.get(command[1],0)<=0: continue
                dest=target; action=command; quantity=0
                travel=distance(pos,target)
                if need and inv.get(need,0)<=0:
                    if pickup_stock.get(need,0)<=0: continue
                    dest=nearest(pos)
                    travel=distance(pos,dest)+1+distance(dest,target)
                    quantity=min(pickup_stock[need], 3 if need=="WHEAT" else 2 if need=="FERTILIZER" else 1)
                    action=["PICKUP",need,quantity]
                # Reach AND complete today's maintenance; new plants need water.
                if travel+1+(command[0]=="PLANT")>tpd-hour: continue
                if final_day and (command[0] not in ("HARVEST","COLLECT_FERTILIZER") or
                                  travel+1+distance(target,nearest(target))+1>remaining): continue
                score=priority/(1+0.65*travel)
                if need and inv.get(need,0)>0: score*=1.12
                # Keep a short route until its target is serviced, unless another
                # task wins on urgency. Revalidate against real tiles every turn.
                if route_memory.get(i)==target: score*=p.get("commitment_bonus",1.8)
                if pos==target: score*=p.get("onsite_bonus",1.3)
                candidate=(score,-i,-j,dest,action,need,quantity)
                if best is None or candidate[:3]>best[:3]: best=candidate
        if best is None: break
        _,ni,nj,dest,command,need,quantity=best
        i,j=-ni,-nj
        unassigned.remove(i);reserved.add(tasks[j][1])
        pos=positions[i];inv=inventories[i]
        if pos!=dest:
            actions[i]=move(pos,dest)
            next_routes[i]=tasks[j][1]
        elif command[0]=="PICKUP":
            actions[i]=list(command)
            pickup_stock[need]-=quantity;shed[need]-=quantity;inv[need]=inv.get(need,0)+quantity
            next_routes[i]=tasks[j][1]
        else:
            actions[i]=list(command)
            if command[0]=="PLANT": seeds[command[1]]-=1
            elif need: inv[need]=max(0,inv.get(need,0)-1)
    for i in unassigned:
        inv=inventories[i];pos=positions[i]
        if sum(inv.values())>0:
            home=nearest(pos)
            if pos!=home: actions[i]=move(pos,home)
            else:
                deposit(i)

    orders=[];budget=float(me["money"])
    # Counts describe projected inventory AFTER the already chosen actions.
    held_wheat=sum(inv.get("WHEAT",0) for inv in inventories)
    fed_now=sum(a[0]=="FEED" for a in actions)
    reserve=0 if final_day else max(0,unfed-fed_now)+math.ceil(n_animals*p["feed_buffer_days"])
    wheat_to_keep=max(0,reserve-held_wheat)
    for item in sorted(PRODUCTS,key=lambda k:-(shed.get(k,0)*prices.get(k,0))):
        qty=max(0,shed.get(item,0)-(wheat_to_keep if item=="WHEAT" else 0))
        if qty>0 and len(orders)<max_orders:
            orders.append(["SELL",item,qty]);shed[item]-=qty
            # Do not spend forecast sale receipts: impacts and rival are unknown.
    def buy(order,estimated_cost,buffer=0):
        nonlocal budget
        if len(orders)<max_orders and budget>=estimated_cost+buffer:
            orders.append(order);budget-=estimated_cost;return True
        return False
    if not final_day:
        shortage=max(0,reserve-held_wheat-shed.get("WHEAT",0))
        if shortage:
            qty=min(shortage,max(0,int(budget/(max(1,prices["WHEAT"])*1.35))))
            if qty: buy(["BUY_PRODUCT","WHEAT",qty],qty*prices["WHEAT"]*1.35)
    workload=len(plants)*2.7+n_animals*6+min(20,len(plant_plan)*3)
    target_hands=min(p["max_hands"],max(4,math.ceil(workload/p["work_per_hand"])))
    if final_day: target_hands=min(p["max_hands"],max(4,math.ceil((len(plants)+n_animals)*0.2)))
    if hour<tpd//3:
        n=int(me.get("hires_today",len(me.get("hands",[]))))
        for k in range(max(0,target_hands-len(me.get("hands",[])))):
            cost=fib(n+k)*int(cfg.get("farmHandCostMult",1))
            if not buy(["HIRE"],cost,0 if final_day else min(p["cash_buffer"],100)): break
    buffer=p["cash_buffer"]+n_animals*prices.get("WHEAT",25)
    if not final_day and days_left>12:
        for item in ("COW","SHEEP","GOOSE"):
            total=animals[item]+private["shed"].get(item,0)+sum(v.get(item,0) for v in private["inventories"])
            suitable=sum(a==item and not (isinstance(tiles[z[1]][z[0]],dict) and tiles[z[1]][z[0]].get("animal")) for z,a in desired_animals.items())
            if suitable>pending_animals[item] and total<goals.get(item,0):
                buy(["BUY_ANIMAL",item,1],ANIMALS[item][0],buffer)
    if days_left>11 and quadrants<p["max_quadrants"] and len(plants)+n_animals>=len(cells)*0.72:
        cost=(1000,2000,4000)[quadrants-1]
        buy(["BUY_LAND"],cost,buffer+500)
    desired_seeds=Counter(plant_plan.values())
    for _,crop,_ in choices:
        gap=max(0,min(5,desired_seeds[crop])-seeds.get(crop,0))
        affordable=max(0,int((budget-min(buffer,300))/CROPS[crop][0]))
        qty=min(gap,affordable)
        if qty: buy(["BUY_SEED",crop,qty],qty*CROPS[crop][0],min(buffer,300))
    route_memory.clear(); route_memory.update(next_routes)
    if trace is not None:
        trace.update({"targets":targets,"animal_goals":goals,"feed_reserve":reserve,
                      "target_hands":target_hands,"routes":{str(k):list(v) for k,v in next_routes.items()},
                      "remaining_steps":remaining})
    return {"farmer":actions[0],"hands":actions[1:],"market":orders}


# Public demand baskets in the game; only observed shops are used.
SHOP_PRODUCTS = {
    "BAKERY": ("EGG","WHEAT"), "PIZZA_SHOP": ("MILK","TOMATO","WHEAT"),
    "BRUNCH_SPOT": ("EGG","WHEAT","STRAWBERRY"), "YARN_STORE": ("WOOL",),
    "ICE_CREAM_SHOP": ("STRAWBERRY","MILK","WHEAT"), "PET_CAFE": ("CARROT",),
    "SMOOTHIE_SHOP": ("STRAWBERRY","MILK"),
    "FARMERS_MARKET": ("WHEAT","CARROT","TOMATO","STRAWBERRY"),
}
PROFILES = {
    "balanced": dict(milk_animals=6,wool_animals=4,egg_animals=2,melon_target=8,
                     strawberry_target=24,tomato_target=0,carrot_target=6,max_hands=11),
    "dairy": dict(milk_animals=9,wool_animals=2,egg_animals=2,melon_target=6,
                  strawberry_target=28,tomato_target=4,carrot_target=4,max_hands=11),
    "wool": dict(milk_animals=4,wool_animals=8,egg_animals=2,melon_target=8,
                 strawberry_target=22,tomato_target=0,carrot_target=5,max_hands=11),
    "eggs": dict(milk_animals=4,wool_animals=3,egg_animals=7,melon_target=8,
                 strawberry_target=24,tomato_target=0,carrot_target=5,max_hands=11),
    "garden": dict(milk_animals=4,wool_animals=2,egg_animals=2,melon_target=6,
                   strawberry_target=20,tomato_target=10,carrot_target=14,max_hands=11),
    "frugal": dict(milk_animals=3,wool_animals=2,egg_animals=1,melon_target=6,
                   strawberry_target=12,tomato_target=0,carrot_target=5,max_hands=8,
                   max_quadrants=2,cash_buffer=400),
}
PROFILE_LABELS={"balanced":"Equilibrado","dairy":"Lácteos y fresas","wool":"Lana",
                "eggs":"Huevos","garden":"Huerta","frugal":"Ahorro"}
PHASE_LABELS={"opening":"Apertura","expansion":"Expansión","production":"Producción","closing":"Cierre"}

def strategy_choice(obs, previous="balanced"):
    shops=obs.get("town",{}).get("unlocked_shops",[])
    demand=Counter(item for shop in shops for item in SHOP_PRODUCTS.get(shop,()))
    if not shops:
        return "balanced","Apertura equilibrada: todavía no hay tiendas visibles.",dict(demand)
    scores={"balanced":1.1,
            "dairy":demand["MILK"]+0.4*demand["STRAWBERRY"],
            "wool":2*demand["WOOL"],
            "eggs":1.3*demand["EGG"],
            "garden":0.8*demand["CARROT"]+0.8*demand["TOMATO"]}
    chosen=max(scores,key=scores.get)
    # Hysteresis: do not change a viable production plan for a small score change.
    if previous in scores and scores[previous]>=scores[chosen]*0.85:
        chosen=previous
    return chosen,"Demanda visible de tiendas; estabilidad del plan con margen del 15%.",dict(demand)

class HybridAgent:
    """Per-player memory. No online training; each instance owns its own state."""
    def __init__(self, profile="auto", record=False, params=None):
        if profile!="auto" and profile not in PROFILES:
            raise ValueError("Unknown profile: "+str(profile))
        self.profile=profile
        self.record=record
        self.params=dict(params or {})
        self.players={}
        self.history=[]
        self.last_decision={}

    def __call__(self, obs, configuration=None):
        cfg=configuration or {}
        day,hour=int(obs["day"]),int(obs["hour"])
        step=day*int(cfg.get("turnsPerDay",24))+hour
        seat=int(obs["player"])
        state=self.players.get(seat)
        if state is None or step<=state["last"]:
            state={"last":-1,"day":-1,"profile":"balanced","routes":{}}
            self.players[seat]=state
            if step==0:
                self.history=[row for row in self.history if row["player"]!=seat]
        if state["day"]!=day:
            state["routes"]={}
            if self.profile=="auto":
                choice,reason,demand=strategy_choice(obs,state["profile"])
            else:
                choice,reason,demand=self.profile,"Plan elegido manualmente.",{}
            state.update(day=day,profile=choice,reason=reason,demand=demand)
        params=dict(PROFILES[state["profile"]])
        params.update(self.params)
        tpd=int(cfg.get("turnsPerDay",24))
        final_day=(int(cfg.get("episodeSteps",720))-2)//tpd
        phase="closing" if day>=final_day-4 else "opening" if day<3 else "expansion" if day<10 else "production"
        trace={"step":step,"player":seat,"day":day,"hour":hour,"profile":state["profile"],
               "phase":phase,"reason":state["reason"],"demand":state["demand"],
               "money":obs["farms"][seat]["money"]}
        action=plan(obs,cfg,params,state["routes"],trace)
        state["last"]=step
        self.last_decision=trace
        if self.record:
            self.history.append(dict(trace))
        return action

def make_agent(profile="auto", record=False, params=None):
    return HybridAgent(profile,record,params)

_SUBMISSION_AGENT=make_agent()

def agent(obs, configuration=None):
    return _SUBMISSION_AGENT(obs,configuration)
