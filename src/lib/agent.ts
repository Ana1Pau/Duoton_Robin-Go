// Katerbot — replenishment agent (rule-based, deterministic, no external LLM needed).
// Inputs: inventory status, alerts, weekly budget, and past orders (simple "learning":
// items bought before get a small priority boost and their past quantity is reused).
import type { BudgetSettings, CaterItem, ReapOrder, ReplenishProposal, ReplenishProposalLine } from "./types";
import { withStatus } from "./calc";
import { todayISO } from "./dates";

const COVER_DAYS = 5; // target: enough stock for ~5 days (perishables)

const QUERY_EN: Record<string, string> = {
  leche: "milk", pan: "bread", huevos: "eggs", pollo: "chicken breast", arroz: "rice", fruta: "fresh fruit",
};

/** Retail pack size per unit of inventory (e.g. eggs come by the dozen). */
const PACK_SIZE: Record<string, number> = { huevos: 12, pan: 6 };
export function packSizeFor(name: string): number {
  return PACK_SIZE[name.trim().toLowerCase()] ?? 1;
}

export function productQueryFor(name: string): string {
  return name.trim().toLowerCase();
}

export function buildProposal(items: CaterItem[], budget: BudgetSettings, weeklySpend: number, history: ReapOrder[], today = todayISO()): ReplenishProposal {
  const days = budget.alert_days ?? 3;
  const pastNames = new Map<string, number>();
  for (const o of history.filter((h) => h.status === "COMPLETED")) {
    for (const l of o.items ?? []) {
      const k = l.name.toLowerCase();
      pastNames.set(k, Math.max(pastNames.get(k) ?? 0, Number(l.quantity) || 0));
    }
  }

  const candidates: ReplenishProposalLine[] = [];
  for (const raw of items) {
    const it = withStatus(raw, today);
    const reasons: { es: string; en: string }[] = [];
    let priority = 0;

    const expiring = it.days_to_expiry != null && it.days_to_expiry <= days;
    const depleting = it.days_to_depletion != null && it.days_to_depletion <= days;
    if (expiring) {
      priority += it.days_to_expiry! <= 1 ? 50 : 30;
      reasons.push({
        es: `Caduca en ${it.days_to_expiry} día(s): conviene reponer fresco.`,
        en: `Expires in ${it.days_to_expiry} day(s): restock fresh.`,
      });
    }
    if (depleting) {
      priority += it.days_to_depletion! <= 1 ? 60 : 40;
      reasons.push({
        es: `Se agota en ~${it.days_to_depletion} día(s) al ritmo de ${it.daily_consumption_estimate} ${it.unit}/día.`,
        en: `Runs out in ~${it.days_to_depletion} day(s) at ${it.daily_consumption_estimate} ${it.unit}/day.`,
      });
    }
    if (!expiring && !depleting) continue;

    const past = pastNames.get(it.name.toLowerCase());
    if (past) {
      priority += 5;
      reasons.push({ es: `Lo compraste antes (${past} ${it.unit}).`, en: `You bought it before (${past} ${it.unit}).` });
    }

    // Quantity: cover COVER_DAYS of consumption. Expiring stock is treated as unusable.
    const usable = expiring ? 0 : it.quantity;
    const need = Math.max(0, it.daily_consumption_estimate * COVER_DAYS - usable);
    let qty = need > 0 ? need : past ?? it.quantity;
    qty = it.unit === "pz" ? Math.ceil(qty) : Math.ceil(qty * 2) / 2; // whole pieces / half kg-L
    if (qty <= 0) qty = 1;
    const pack = packSizeFor(it.name);
    const packs = Math.max(1, Math.ceil(qty / pack));
    if (pack > 1) qty = packs * pack;

    const unitPrice = it.quantity > 0 ? Math.round((it.price / it.quantity) * 100) / 100 : it.price;
    candidates.push({
      cater_item_id: it.id,
      name: it.name,
      category: it.category,
      unit: it.unit,
      current_quantity: it.quantity,
      proposed_quantity: qty,
      estimated_unit_price: unitPrice,
      estimated_cost: Math.round(unitPrice * qty * 100) / 100,
      priority,
      reasons,
      product_query: productQueryFor(it.name),
      packs,
      pack_size: pack,
      within_budget: true,
    });
  }

  candidates.sort((a, b) => b.priority - a.priority);
  const remaining = Math.round((budget.weekly_budget - weeklySpend) * 100) / 100;
  let running = 0;
  for (const c of candidates) {
    if (budget.weekly_budget > 0 && running + c.estimated_cost > remaining) {
      c.within_budget = false;
      c.reasons.push({
        es: `Excede el presupuesto semanal restante (${remaining.toFixed(2)} ${budget.currency}); opcional.`,
        en: `Exceeds remaining weekly budget (${remaining.toFixed(2)} ${budget.currency}); optional.`,
      });
    } else {
      running += c.estimated_cost;
    }
  }
  const total = Math.round(candidates.reduce((s, c) => s + c.estimated_cost, 0) * 100) / 100;
  const inBudget = Math.round(running * 100) / 100;
  const n = candidates.length;
  const nIn = candidates.filter((c) => c.within_budget).length;

  return {
    generated_at: new Date().toISOString(),
    agent: "katerbot-rules-v1",
    currency: budget.currency,
    weekly_budget: budget.weekly_budget,
    weekly_spend: weeklySpend,
    remaining_budget: remaining,
    estimated_total: total,
    estimated_total_within_budget: inBudget,
    lines: candidates,
    summary:
      n === 0
        ? { es: "Todo bien: nada caduca ni se agota en los próximos días.", en: "All good: nothing expires or runs out in the next few days." }
        : {
            es: `Propongo reponer ${n} producto(s); ${nIn} caben en tu presupuesto (≈ ${inBudget.toFixed(2)} ${budget.currency} de ${remaining.toFixed(2)} disponibles).`,
            en: `I propose restocking ${n} item(s); ${nIn} fit your budget (≈ ${inBudget.toFixed(2)} ${budget.currency} of ${remaining.toFixed(2)} available).`,
          },
  };
}

export function englishQuery(name: string) {
  return QUERY_EN[name.toLowerCase()] ?? name;
}
