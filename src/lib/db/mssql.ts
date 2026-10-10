// Katerbot — SQL Server 2025 repository (mssql / tedious driver).
// Connection: SQLSERVER_CONNECTION_STRING (ADO.NET style), e.g.
//   Server=localhost,1433;Database=Katerbot;User Id=katerbot_app;Password=***;Encrypt=true;TrustServerCertificate=true
import sql from "mssql";
import type { Repo } from "./repo";
import type { Alert, BudgetSettings, CaterItem, ConsumptionLog, ReapOrder, User } from "../types";
import { toDateOnly } from "../dates";
import { demoItems, DEMO_EMAIL } from "./seed";

let poolPromise: Promise<sql.ConnectionPool> | null = null;

function pool(): Promise<sql.ConnectionPool> {
  if (!poolPromise) {
    const cs = process.env.SQLSERVER_CONNECTION_STRING;
    if (!cs) throw new Error("SQLSERVER_CONNECTION_STRING is not set");
    poolPromise = new sql.ConnectionPool(cs).connect().catch((e) => {
      poolPromise = null;
      throw e;
    });
  }
  return poolPromise;
}

async function q<T = Record<string, unknown>>(text: string, params: Record<string, [sql.ISqlType | (() => sql.ISqlType), unknown]> = {}) {
  const req = (await pool()).request();
  for (const [k, [type, value]] of Object.entries(params)) req.input(k, type as sql.ISqlType, value);
  const r = await req.query<T>(text);
  return r.recordset ?? [];
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? null : String(v));
const num = (v: unknown) => (v == null ? null : Number(v));

function mapUser(r: Record<string, unknown>): User {
  return {
    id: Number(r.id), email: String(r.email), display_name: String(r.display_name), locale: (r.locale as "es" | "en") ?? "es",
    reap_customer_reference: (r.reap_customer_reference as string) ?? null,
    reap_enrollment_id: (r.reap_enrollment_id as string) ?? null,
    reap_enrollment_status: (r.reap_enrollment_status as User["reap_enrollment_status"]) ?? null,
  };
}
function mapItem(r: Record<string, unknown>): CaterItem {
  return {
    id: Number(r.id), user_id: Number(r.user_id), name: String(r.name), category: String(r.category), quantity: Number(r.quantity),
    unit: String(r.unit), purchase_date: toDateOnly(r.purchase_date)!, expiry_date: toDateOnly(r.expiry_date), price: Number(r.price),
    daily_consumption_estimate: Number(r.daily_consumption_estimate),
  };
}
function mapLog(r: Record<string, unknown>): ConsumptionLog {
  return { id: Number(r.id), user_id: Number(r.user_id), cater_item_id: Number(r.cater_item_id), quantity: Number(r.quantity), logged_at: iso(r.logged_at)!, note: (r.note as string) ?? null };
}
function mapAlert(r: Record<string, unknown>): Alert {
  return {
    id: Number(r.id), user_id: Number(r.user_id), cater_item_id: num(r.cater_item_id), alert_type: r.alert_type as Alert["alert_type"],
    severity: r.severity as Alert["severity"], message_es: String(r.message_es), message_en: String(r.message_en),
    is_resolved: Boolean(r.is_resolved), created_at: iso(r.created_at)!,
  };
}
function mapOrder(r: Record<string, unknown>): ReapOrder {
  let items: ReapOrder["items"] = [];
  try { items = r.items_json ? JSON.parse(String(r.items_json)) : []; } catch { items = []; }
  return {
    id: Number(r.id), user_id: Number(r.user_id), product_query: String(r.product_query), enrollment_id: (r.enrollment_id as string) ?? null,
    quote_id: (r.quote_id as string) ?? null, checkout_id: (r.checkout_id as string) ?? null, order_reference: (r.order_reference as string) ?? null,
    status: r.status as ReapOrder["status"], total_amount: num(r.total_amount), currency: r.currency ? String(r.currency).trim() : null,
    quote_expires_at: iso(r.quote_expires_at), items, is_mock: Boolean(r.is_mock), error_code: (r.error_code as string) ?? null,
    created_at: iso(r.created_at)!, updated_at: iso(r.updated_at)!,
  };
}

const ITEM_COLS = "id, user_id, name, category, quantity, unit, purchase_date, expiry_date, price, daily_consumption_estimate";
const ORDER_COLS = "id, user_id, product_query, enrollment_id, quote_id, checkout_id, order_reference, status, total_amount, currency, quote_expires_at, items_json, is_mock, error_code, created_at, updated_at";

const ITEM_FIELDS: Record<string, () => sql.ISqlType> = {
  name: () => sql.NVarChar(120), category: () => sql.NVarChar(60), quantity: () => sql.Decimal(10, 3), unit: () => sql.NVarChar(20),
  purchase_date: () => sql.Date(), expiry_date: () => sql.Date(), price: () => sql.Decimal(12, 2), daily_consumption_estimate: () => sql.Decimal(10, 3),
};

export const mssqlRepo: Repo = {
  kind: "sqlserver",

  async getDemoUser() {
    const rows = await q("SELECT TOP (1) * FROM dbo.users WHERE email = @e", { e: [sql.NVarChar(320), DEMO_EMAIL] });
    if (rows[0]) return mapUser(rows[0]);
    await this.resetDemo();
    const again = await q("SELECT TOP (1) * FROM dbo.users WHERE email = @e", { e: [sql.NVarChar(320), DEMO_EMAIL] });
    return mapUser(again[0]);
  },
  async setEnrollment(userId, enrollmentId, status) {
    await q("UPDATE dbo.users SET reap_enrollment_id = @id, reap_enrollment_status = @st WHERE id = @u", {
      id: [sql.NVarChar(100), enrollmentId], st: [sql.NVarChar(30), status], u: [sql.Int, userId],
    });
  },

  async listItems(userId) {
    return (await q(`SELECT ${ITEM_COLS} FROM dbo.cater_items WHERE user_id = @u ORDER BY name`, { u: [sql.Int, userId] })).map(mapItem);
  },
  async getItem(userId, id) {
    const r = await q(`SELECT ${ITEM_COLS} FROM dbo.cater_items WHERE user_id = @u AND id = @id`, { u: [sql.Int, userId], id: [sql.Int, id] });
    return r[0] ? mapItem(r[0]) : null;
  },
  async createItem(userId, i) {
    const r = await q(
      `INSERT INTO dbo.cater_items (user_id, name, category, quantity, unit, purchase_date, expiry_date, price, daily_consumption_estimate)
       OUTPUT INSERTED.id, INSERTED.user_id, INSERTED.name, INSERTED.category, INSERTED.quantity, INSERTED.unit, INSERTED.purchase_date,
              INSERTED.expiry_date, INSERTED.price, INSERTED.daily_consumption_estimate
       VALUES (@u, @name, @category, @quantity, @unit, @purchase_date, @expiry_date, @price, @daily)`,
      {
        u: [sql.Int, userId], name: [sql.NVarChar(120), i.name], category: [sql.NVarChar(60), i.category], quantity: [sql.Decimal(10, 3), i.quantity],
        unit: [sql.NVarChar(20), i.unit], purchase_date: [sql.Date(), i.purchase_date], expiry_date: [sql.Date(), i.expiry_date],
        price: [sql.Decimal(12, 2), i.price], daily: [sql.Decimal(10, 3), i.daily_consumption_estimate],
      }
    );
    return mapItem(r[0]);
  },
  async updateItem(userId, id, input) {
    const sets: string[] = [];
    const params: Record<string, [() => sql.ISqlType, unknown]> = {};
    for (const [k, v] of Object.entries(input)) {
      if (!(k in ITEM_FIELDS)) continue;
      sets.push(`${k} = @${k}`);
      params[k] = [ITEM_FIELDS[k], v];
    }
    if (sets.length) {
      await q(`UPDATE dbo.cater_items SET ${sets.join(", ")}, updated_at = SYSUTCDATETIME() WHERE user_id = @u AND id = @id`, {
        ...params, u: [sql.Int, userId], id: [sql.Int, id],
      });
    }
    return this.getItem(userId, id);
  },
  async deleteItem(userId, id) {
    // alerts/logs cascade from cater_items
    const r = await q<{ n: number }>("DELETE FROM dbo.cater_items WHERE user_id = @u AND id = @id; SELECT @@ROWCOUNT AS n;", { u: [sql.Int, userId], id: [sql.Int, id] });
    return Number(r[0]?.n ?? 0) > 0;
  },

  async listLogs(userId, itemId) {
    const rows = await q(
      `SELECT TOP (500) * FROM dbo.consumption_logs WHERE user_id = @u AND (@item IS NULL OR cater_item_id = @item) ORDER BY logged_at DESC`,
      { u: [sql.Int, userId], item: [sql.Int, itemId ?? null] }
    );
    return rows.map(mapLog);
  },
  async createLog(userId, itemId, quantity, note) {
    const r = await q(
      `INSERT INTO dbo.consumption_logs (user_id, cater_item_id, quantity, note) OUTPUT INSERTED.* VALUES (@u, @i, @q, @n)`,
      { u: [sql.Int, userId], i: [sql.Int, itemId], q: [sql.Decimal(10, 3), quantity], n: [sql.NVarChar(200), note] }
    );
    return mapLog(r[0]);
  },
  async deleteLog(userId, id) {
    const r = await q<{ n: number }>("DELETE FROM dbo.consumption_logs WHERE user_id = @u AND id = @id; SELECT @@ROWCOUNT AS n;", { u: [sql.Int, userId], id: [sql.Int, id] });
    return Number(r[0]?.n ?? 0) > 0;
  },

  async getBudget(userId) {
    const r = await q("SELECT user_id, weekly_budget, currency, alert_days FROM dbo.budget_settings WHERE user_id = @u", { u: [sql.Int, userId] });
    if (!r[0]) return { user_id: userId, weekly_budget: 0, currency: "MXN", alert_days: 3 };
    return { user_id: userId, weekly_budget: Number(r[0].weekly_budget), currency: String(r[0].currency).trim(), alert_days: Number(r[0].alert_days) };
  },
  async upsertBudget(userId, b) {
    await q(
      `MERGE dbo.budget_settings WITH (HOLDLOCK) AS t
       USING (SELECT @u AS user_id) AS s ON t.user_id = s.user_id
       WHEN MATCHED THEN UPDATE SET weekly_budget = @wb, currency = @cur, alert_days = @ad, updated_at = SYSUTCDATETIME()
       WHEN NOT MATCHED THEN INSERT (user_id, weekly_budget, currency, alert_days) VALUES (@u, @wb, @cur, @ad);`,
      { u: [sql.Int, userId], wb: [sql.Decimal(12, 2), b.weekly_budget], cur: [sql.Char(3), b.currency], ad: [sql.Int, b.alert_days] }
    );
    return this.getBudget(userId) as Promise<BudgetSettings>;
  },

  async replaceOpenAlerts(userId, alerts) {
    const p = await pool();
    const t = new sql.Transaction(p);
    await t.begin();
    try {
      await new sql.Request(t).input("u", sql.Int, userId).query("DELETE FROM dbo.alerts WHERE user_id = @u AND is_resolved = 0");
      for (const a of alerts) {
        await new sql.Request(t)
          .input("u", sql.Int, userId).input("i", sql.Int, a.cater_item_id).input("t", sql.NVarChar(30), a.alert_type)
          .input("s", sql.NVarChar(10), a.severity).input("es", sql.NVarChar(400), a.message_es).input("en", sql.NVarChar(400), a.message_en)
          .query("INSERT INTO dbo.alerts (user_id, cater_item_id, alert_type, severity, message_es, message_en) VALUES (@u, @i, @t, @s, @es, @en)");
      }
      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
    return this.listAlerts(userId);
  },
  async listAlerts(userId, includeResolved = false) {
    const rows = await q(
      `SELECT * FROM dbo.alerts WHERE user_id = @u AND (@all = 1 OR is_resolved = 0) ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, created_at DESC`,
      { u: [sql.Int, userId], all: [sql.Bit, includeResolved ? 1 : 0] }
    );
    return rows.map(mapAlert);
  },
  async resolveAlert(userId, id) {
    const r = await q<{ n: number }>("UPDATE dbo.alerts SET is_resolved = 1 WHERE user_id = @u AND id = @id; SELECT @@ROWCOUNT AS n;", { u: [sql.Int, userId], id: [sql.Int, id] });
    return Number(r[0]?.n ?? 0) > 0;
  },

  async listOrders(userId) {
    return (await q(`SELECT TOP (100) ${ORDER_COLS} FROM dbo.reap_orders WHERE user_id = @u ORDER BY created_at DESC`, { u: [sql.Int, userId] })).map(mapOrder);
  },
  async getOrder(userId, id) {
    const r = await q(`SELECT ${ORDER_COLS} FROM dbo.reap_orders WHERE user_id = @u AND id = @id`, { u: [sql.Int, userId], id: [sql.Int, id] });
    return r[0] ? mapOrder(r[0]) : null;
  },
  async createOrder(userId, o) {
    const r = await q<{ id: number }>(
      `INSERT INTO dbo.reap_orders (user_id, product_query, items_json, is_mock, status) OUTPUT INSERTED.id VALUES (@u, @pq, @items, @mock, N'DRAFT')`,
      { u: [sql.Int, userId], pq: [sql.NVarChar(1000), o.product_query.slice(0, 1000)], items: [sql.NVarChar(sql.MAX), JSON.stringify(o.items)], mock: [sql.Bit, o.is_mock ? 1 : 0] }
    );
    return (await this.getOrder(userId, Number(r[0].id)))!;
  },
  async updateOrder(userId, id, patch) {
    const map: Record<string, [() => sql.ISqlType, unknown]> = {};
    if ("enrollment_id" in patch) map.enrollment_id = [() => sql.NVarChar(100), patch.enrollment_id];
    if ("quote_id" in patch) map.quote_id = [() => sql.NVarChar(100), patch.quote_id];
    if ("checkout_id" in patch) map.checkout_id = [() => sql.NVarChar(100), patch.checkout_id];
    if ("order_reference" in patch) map.order_reference = [() => sql.NVarChar(100), patch.order_reference];
    if ("status" in patch) map.status = [() => sql.NVarChar(30), patch.status];
    if ("total_amount" in patch) map.total_amount = [() => sql.Decimal(12, 2), patch.total_amount];
    if ("currency" in patch) map.currency = [() => sql.Char(3), patch.currency];
    if ("quote_expires_at" in patch) map.quote_expires_at = [() => sql.DateTime2(0), patch.quote_expires_at ? new Date(patch.quote_expires_at) : null];
    if ("items" in patch) map.items_json = [() => sql.NVarChar(sql.MAX), JSON.stringify(patch.items ?? [])];
    if ("error_code" in patch) map.error_code = [() => sql.NVarChar(60), patch.error_code];
    const keys = Object.keys(map);
    if (keys.length) {
      await q(`UPDATE dbo.reap_orders SET ${keys.map((k) => `${k} = @${k}`).join(", ")}, updated_at = SYSUTCDATETIME() WHERE user_id = @u AND id = @id`, {
        ...map, u: [sql.Int, userId], id: [sql.Int, id],
      });
    }
    return this.getOrder(userId, id);
  },

  async resetDemo() {
    const p = await pool();
    const t = new sql.Transaction(p);
    await t.begin();
    try {
      const r = new sql.Request(t);
      r.input("e", sql.NVarChar(320), DEMO_EMAIL);
      const ins = await r.query<{ id: number }>(`
        DELETE FROM dbo.reap_orders      WHERE user_id IN (SELECT id FROM dbo.users WHERE email = @e);
        DELETE FROM dbo.alerts           WHERE user_id IN (SELECT id FROM dbo.users WHERE email = @e);
        DELETE FROM dbo.consumption_logs WHERE user_id IN (SELECT id FROM dbo.users WHERE email = @e);
        DELETE FROM dbo.users WHERE email = @e;
        INSERT INTO dbo.users (email, display_name, locale, reap_customer_reference) OUTPUT INSERTED.id
        VALUES (@e, N'Fernando (demo)', N'es', N'katerbot-demo-user-1');`);
      const uid = Number(ins.recordset[0].id);
      await new sql.Request(t).input("u", sql.Int, uid)
        .query("INSERT INTO dbo.budget_settings (user_id, weekly_budget, currency, alert_days) VALUES (@u, 800, 'MXN', 3)");
      for (const i of demoItems(uid)) {
        await new sql.Request(t)
          .input("u", sql.Int, uid).input("name", sql.NVarChar(120), i.name).input("category", sql.NVarChar(60), i.category)
          .input("quantity", sql.Decimal(10, 3), i.quantity).input("unit", sql.NVarChar(20), i.unit).input("pd", sql.Date(), i.purchase_date)
          .input("ed", sql.Date(), i.expiry_date).input("price", sql.Decimal(12, 2), i.price).input("daily", sql.Decimal(10, 3), i.daily_consumption_estimate)
          .query(`INSERT INTO dbo.cater_items (user_id, name, category, quantity, unit, purchase_date, expiry_date, price, daily_consumption_estimate)
                  VALUES (@u, @name, @category, @quantity, @unit, @pd, @ed, @price, @daily)`);
      }
      await new sql.Request(t).input("u", sql.Int, uid).query(`
        INSERT INTO dbo.reap_orders (user_id, product_query, enrollment_id, quote_id, checkout_id, order_reference, status, total_amount, currency, items_json, is_mock, created_at, updated_at)
        VALUES (@u, N'leche, huevos', N'mock_enr_demo', N'mock_qt_hist01', N'mock_chk_hist01', N'MOCK-ORD-0001', N'COMPLETED', 142, 'MXN',
                N'[{"name":"Leche","quantity":2,"unit":"L"},{"name":"Huevos","quantity":12,"unit":"pz"}]', 1,
                DATEADD(DAY, -10, SYSUTCDATETIME()), DATEADD(DAY, -10, SYSUTCDATETIME()));`);
      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }
  },
};
