// Katerbot — offline store (JSON file under data/). Used when no SQL Server is configured.
import { promises as fs } from "fs";
import path from "path";
import type { Repo } from "./repo";
import type { Alert, BudgetSettings, CaterItem, ConsumptionLog, ReapOrder, User } from "../types";
import { demoItems, DEMO_EMAIL } from "./seed";

interface Store {
  seq: number;
  users: User[];
  items: CaterItem[];
  logs: ConsumptionLog[];
  alerts: Alert[];
  budgets: BudgetSettings[];
  orders: ReapOrder[];
}

const FILE = path.join(process.cwd(), "data", "dev-store.json");
let cache: Store | null = null;
let chain: Promise<unknown> = Promise.resolve();

function freshStore(): Store {
  const s: Store = { seq: 1, users: [], items: [], logs: [], alerts: [], budgets: [], orders: [] };
  const user: User = {
    id: s.seq++,
    email: DEMO_EMAIL,
    display_name: "Fernando (demo)",
    locale: "es",
    reap_customer_reference: "katerbot-demo-user-1",
    reap_enrollment_id: null,
    reap_enrollment_status: null,
  };
  s.users.push(user);
  s.budgets.push({ user_id: user.id, weekly_budget: 800, currency: "MXN", alert_days: 3 });
  for (const it of demoItems(user.id)) s.items.push({ ...it, id: s.seq++ });
  const now = Date.now();
  const byName = (n: string) => s.items.find((i) => i.name === n)!.id;
  for (const [name, qty, daysAgo] of [["Leche", 0.5, 1], ["Leche", 0.5, 2], ["Pan", 3, 1], ["Huevos", 2, 1], ["Pollo", 0.4, 1]] as const) {
    s.logs.push({ id: s.seq++, user_id: user.id, cater_item_id: byName(name), quantity: qty, logged_at: new Date(now - daysAgo * 86_400_000).toISOString(), note: "demo" });
  }
  const past = new Date(now - 10 * 86_400_000).toISOString();
  s.orders.push({
    id: s.seq++, user_id: user.id, product_query: "leche, huevos", enrollment_id: "mock_enr_demo", quote_id: "mock_qt_hist01",
    checkout_id: "mock_chk_hist01", order_reference: "MOCK-ORD-0001", status: "COMPLETED", total_amount: 142, currency: "MXN",
    quote_expires_at: null, items: [{ name: "Leche", quantity: 2, unit: "L" }, { name: "Huevos", quantity: 12, unit: "pz" }],
    is_mock: true, error_code: null, created_at: past, updated_at: past,
  });
  return s;
}

async function load(): Promise<Store> {
  if (cache) return cache;
  try {
    cache = JSON.parse(await fs.readFile(FILE, "utf8")) as Store;
  } catch {
    cache = freshStore();
    await save();
  }
  return cache!;
}

async function save() {
  if (!cache) return;
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(cache, null, 2));
  } catch {
    // read-only FS (e.g. serverless): keep in memory only
  }
}

/** Serialize mutations so concurrent requests don't clobber the file. */
function tx<T>(fn: (s: Store) => T | Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const s = await load();
    const r = await fn(s);
    await save();
    return r;
  });
  chain = run.catch(() => undefined);
  return run;
}

const nowIso = () => new Date().toISOString();

export const memoryRepo: Repo = {
  kind: "memory",
  async getDemoUser() {
    const s = await load();
    return s.users[0];
  },
  setEnrollment: (userId, enrollmentId, status) =>
    tx((s) => {
      const u = s.users.find((x) => x.id === userId);
      if (u) {
        u.reap_enrollment_id = enrollmentId;
        u.reap_enrollment_status = status;
      }
    }),

  async listItems(userId) {
    const s = await load();
    return s.items.filter((i) => i.user_id === userId).sort((a, b) => a.name.localeCompare(b.name));
  },
  async getItem(userId, id) {
    const s = await load();
    return s.items.find((i) => i.user_id === userId && i.id === id) ?? null;
  },
  createItem: (userId, input) =>
    tx((s) => {
      const it: CaterItem = { ...input, id: s.seq++, user_id: userId };
      s.items.push(it);
      return it;
    }),
  updateItem: (userId, id, input) =>
    tx((s) => {
      const it = s.items.find((i) => i.user_id === userId && i.id === id);
      if (!it) return null;
      Object.assign(it, input);
      return it;
    }),
  deleteItem: (userId, id) =>
    tx((s) => {
      const n = s.items.length;
      s.items = s.items.filter((i) => !(i.user_id === userId && i.id === id));
      s.logs = s.logs.filter((l) => l.cater_item_id !== id);
      s.alerts = s.alerts.filter((a) => a.cater_item_id !== id);
      return s.items.length < n;
    }),

  async listLogs(userId, itemId) {
    const s = await load();
    return s.logs
      .filter((l) => l.user_id === userId && (itemId == null || l.cater_item_id === itemId))
      .sort((a, b) => b.logged_at.localeCompare(a.logged_at));
  },
  createLog: (userId, itemId, quantity, note) =>
    tx((s) => {
      const log: ConsumptionLog = { id: s.seq++, user_id: userId, cater_item_id: itemId, quantity, logged_at: nowIso(), note };
      s.logs.push(log);
      return log;
    }),
  deleteLog: (userId, id) =>
    tx((s) => {
      const n = s.logs.length;
      s.logs = s.logs.filter((l) => !(l.user_id === userId && l.id === id));
      return s.logs.length < n;
    }),

  async getBudget(userId) {
    const s = await load();
    return s.budgets.find((b) => b.user_id === userId) ?? { user_id: userId, weekly_budget: 0, currency: "MXN", alert_days: 3 };
  },
  upsertBudget: (userId, b) =>
    tx((s) => {
      const existing = s.budgets.find((x) => x.user_id === userId);
      if (existing) Object.assign(existing, b);
      else s.budgets.push({ ...b, user_id: userId });
      return s.budgets.find((x) => x.user_id === userId)!;
    }),

  replaceOpenAlerts: (userId, alerts) =>
    tx((s) => {
      s.alerts = s.alerts.filter((a) => a.user_id !== userId || a.is_resolved);
      const created = alerts.map<Alert>((a) => ({ ...a, id: s.seq++, user_id: userId, is_resolved: false, created_at: nowIso() }));
      s.alerts.push(...created);
      return created;
    }),
  async listAlerts(userId, includeResolved = false) {
    const s = await load();
    return s.alerts.filter((a) => a.user_id === userId && (includeResolved || !a.is_resolved));
  },
  resolveAlert: (userId, id) =>
    tx((s) => {
      const a = s.alerts.find((x) => x.user_id === userId && x.id === id);
      if (!a) return false;
      a.is_resolved = true;
      return true;
    }),

  async listOrders(userId) {
    const s = await load();
    return s.orders.filter((o) => o.user_id === userId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  async getOrder(userId, id) {
    const s = await load();
    return s.orders.find((o) => o.user_id === userId && o.id === id) ?? null;
  },
  createOrder: (userId, o) =>
    tx((s) => {
      const t = nowIso();
      const order: ReapOrder = {
        id: s.seq++, user_id: userId, product_query: o.product_query, enrollment_id: null, quote_id: null, checkout_id: null,
        order_reference: null, status: "DRAFT", total_amount: null, currency: null, quote_expires_at: null, items: o.items,
        is_mock: o.is_mock, error_code: null, created_at: t, updated_at: t,
      };
      s.orders.push(order);
      return order;
    }),
  updateOrder: (userId, id, patch) =>
    tx((s) => {
      const o = s.orders.find((x) => x.user_id === userId && x.id === id);
      if (!o) return null;
      Object.assign(o, patch, { updated_at: nowIso() });
      return o;
    }),

  resetDemo: () =>
    tx((s) => {
      Object.assign(s, freshStore());
    }),
};
