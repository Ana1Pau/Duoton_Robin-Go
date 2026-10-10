"use client";
// Katerbot — main pantry dashboard.
import { useCallback, useEffect, useState } from "react";
import { api, ApiError, money } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { Alert, BudgetSettings, CaterItemWithStatus, ReapOrder, ReplenishProposal, ReplenishProposalLine } from "@/lib/types";
import { PurchaseFlow } from "./PurchaseFlow";

const today = () => new Date().toISOString().slice(0, 10);

export function Dashboard() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<CaterItemWithStatus[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [orders, setOrders] = useState<ReapOrder[]>([]);
  const [budget, setBudget] = useState<BudgetSettings | null>(null);
  const [spend, setSpend] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [proposal, setProposal] = useState<ReplenishProposal | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [agentBusy, setAgentBusy] = useState(false);
  const [flowLines, setFlowLines] = useState<ReplenishProposalLine[] | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [i, a, o] = await Promise.all([
        api<{ items: CaterItemWithStatus[]; budget: BudgetSettings; weekly_spend: number }>("/api/items"),
        api<{ alerts: Alert[] }>("/api/alerts"),
        api<{ orders: ReapOrder[] }>("/api/orders"),
      ]);
      setItems(i.items);
      setBudget(i.budget);
      setSpend(i.weekly_spend);
      setAlerts(a.alerts);
      setOrders(o.orders);
    } catch (e) {
      setError(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  async function runAgent() {
    setAgentBusy(true);
    try {
      const r = await api<{ proposal: ReplenishProposal; alerts: Alert[] }>("/api/agent/replenish", { method: "POST" });
      setProposal(r.proposal);
      setAlerts(r.alerts);
      setSelected(new Set(r.proposal.lines.filter((l) => l.within_budget).map((l) => l.cater_item_id)));
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : String(e));
    } finally {
      setAgentBusy(false);
    }
  }

  async function resetDemo() {
    setLoading(true);
    await api("/api/demo/reset", { method: "POST" }).catch(() => null);
    setProposal(null);
    await load();
  }

  if (loading) return <p className="p-6 text-slate-500">{t("loading")}</p>;
  if (error)
    return (
      <div className="card text-red-700">
        <p>{error}</p>
        <button className="btn-ghost mt-2" onClick={load}>{t("retry")}</button>
      </div>
    );

  const cur = budget?.currency ?? "MXN";
  const pct = budget && budget.weekly_budget > 0 ? Math.min(100, (spend / budget.weekly_budget) * 100) : 0;

  return (
    <div className="space-y-4">
      {toast && <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">{toast}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        {/* Budget */}
        <section className="card">
          <h2 className="mb-2 font-bold">💰 {t("budget")}</h2>
          {budget && <BudgetEditor budget={budget} onSaved={load} />}
          <div className="mt-3 h-2 rounded-full bg-slate-100">
            <div className={`h-2 rounded-full ${pct >= 100 ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-kater-500"}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {t("spent")}: <b>{money(spend, cur)}</b> · {t("remaining")}: <b>{money((budget?.weekly_budget ?? 0) - spend, cur)}</b>
          </p>
        </section>

        {/* Alerts */}
        <section className="card md:col-span-2">
          <h2 className="mb-2 font-bold">🔔 {t("alerts")} <span className="badge bg-slate-100 text-slate-700">{alerts.length}</span></h2>
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-500">{t("no_alerts")}</p>
          ) : (
            <ul className="space-y-1.5">
              {alerts.map((a) => (
                <li key={a.id} className={`rounded-lg px-3 py-2 text-sm ${a.severity === "critical" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>
                  <span className="mr-1 font-mono text-[10px] opacity-70">{a.alert_type}</span> {lang === "en" ? a.message_en : a.message_es}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Agent */}
      <section className="card border-kater-100">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-bold">🤖 {t("agent")}</h2>
            <p className="text-sm text-slate-600">{t("agent_desc")}</p>
          </div>
          <button className="btn-primary" onClick={runAgent} disabled={agentBusy}>
            {agentBusy ? t("working") : t("run_agent")}
          </button>
        </div>
        {proposal && (
          <div className="mt-3">
            <p className="mb-2 text-sm font-medium">{lang === "en" ? proposal.summary.en : proposal.summary.es}</p>
            <ul className="space-y-2">
              {proposal.lines.map((l) => (
                <li key={l.cater_item_id} className={`flex gap-3 rounded-xl border p-3 ${l.within_budget ? "border-slate-200" : "border-dashed border-amber-300 bg-amber-50/50"}`}>
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-kater-600"
                    checked={selected.has(l.cater_item_id)}
                    onChange={(e) => {
                      const s = new Set(selected);
                      if (e.target.checked) s.add(l.cater_item_id);
                      else s.delete(l.cater_item_id);
                      setSelected(s);
                    }}
                    aria-label={l.name}
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="font-semibold">
                        {l.name}: +{l.proposed_quantity} {l.unit}
                        {l.pack_size > 1 && <span className="text-xs font-normal text-slate-500"> ({l.packs}×{l.pack_size})</span>}
                      </p>
                      <p className="text-sm">{money(l.estimated_cost, proposal.currency)}</p>
                    </div>
                    <ul className="mt-1 list-disc pl-4 text-xs text-slate-600">
                      {l.reasons.map((r, i) => <li key={i}>{lang === "en" ? r.en : r.es}</li>)}
                    </ul>
                    {!l.within_budget && <span className="badge mt-1 bg-amber-100 text-amber-800">{t("optional")}</span>}
                  </div>
                </li>
              ))}
            </ul>
            {proposal.lines.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                <span className="text-sm">
                  {t("est_cost")}: <b>{money(proposal.lines.filter((l) => selected.has(l.cater_item_id)).reduce((s, l) => s + l.estimated_cost, 0), proposal.currency)}</b>
                </span>
                <button
                  className="btn-primary"
                  onClick={() => {
                    const ls = proposal.lines.filter((l) => selected.has(l.cater_item_id));
                    if (ls.length === 0) return setToast(t("nothing_selected"));
                    setFlowLines(ls);
                  }}
                >
                  {t("review_summary")} →
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Inventory */}
      <section className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">🧺 {t("inventory")}</h2>
          <button className="btn-ghost text-xs" onClick={resetDemo}>{t("reset_demo")}</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <ItemCard key={it.id} item={it} onChanged={load} onToast={setToast} />
          ))}
        </div>
      </section>

      <AddItem onAdded={(overBudget) => { setToast(overBudget ? t("item_over_budget") : t("item_added")); load(); }} />

      {/* Orders */}
      <section className="card">
        <h2 className="mb-2 font-bold">🧾 {t("orders")}</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-slate-500">{t("no_orders")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs text-slate-500">
                <tr><th className="py-1">#</th><th>{t("name")}</th><th>{t("status")}</th><th>{t("total")}</th><th>{t("order_ref")}</th><th>quote / checkout</th></tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-slate-100 align-top">
                    <td className="py-1.5">{o.id}</td>
                    <td>{o.product_query}{o.is_mock && <span className="badge ml-1 bg-amber-100 text-amber-800">MOCK</span>}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td>{money(o.total_amount, o.currency ?? cur)}</td>
                    <td className="font-mono text-xs">{o.order_reference ?? "—"}</td>
                    <td className="font-mono text-[10px] text-slate-500">{o.quote_id ?? "—"}<br />{o.checkout_id ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {flowLines && proposal && (
        <PurchaseFlow
          proposal={proposal}
          lines={flowLines}
          onClose={() => { setFlowLines(null); load(); }}
          onFinished={() => { setProposal(null); load(); }}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const c =
    status === "COMPLETED" ? "bg-kater-100 text-kater-700" :
    status === "FAILED" || status === "EXPIRED" ? "bg-red-100 text-red-700" :
    status === "CANCELLED" ? "bg-slate-200 text-slate-700" : "bg-blue-100 text-blue-700";
  return <span className={`badge ${c}`}>{status}</span>;
}

function BudgetEditor({ budget, onSaved }: { budget: BudgetSettings; onSaved: () => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState(String(budget.weekly_budget));
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await api("/api/budget", { method: "PUT", json: { weekly_budget: Number(value) } }).catch(() => null);
        setBusy(false);
        onSaved();
      }}
    >
      <input className="input" type="number" min={0} step="1" value={value} onChange={(e) => setValue(e.target.value)} aria-label={t("budget")} />
      <span className="self-center text-sm text-slate-500">{budget.currency}</span>
      <button className="btn-ghost" disabled={busy}>{t("save")}</button>
    </form>
  );
}

function ItemCard({ item, onChanged, onToast }: { item: CaterItemWithStatus; onChanged: () => void; onToast: (s: string) => void }) {
  const { t } = useI18n();
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);
  const dtd = item.days_to_depletion;
  const dte = item.days_to_expiry;
  const tone = (d: number | null) => (d == null ? "text-slate-500" : d <= 1 ? "text-red-700 font-semibold" : d <= 3 ? "text-amber-700 font-semibold" : "text-slate-700");

  async function logUse(e: React.FormEvent) {
    e.preventDefault();
    if (!qty) return;
    setBusy(true);
    try {
      await api("/api/consumption", { method: "POST", json: { cater_item_id: item.id, quantity: Number(qty) } });
      setQty("");
      onChanged();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{item.name}</h3>
          <p className="text-xs text-slate-500">{item.category} · {money(item.price)}</p>
        </div>
        <p className="text-right text-lg font-bold">{item.quantity} <span className="text-sm font-normal">{item.unit}</span></p>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-1 text-xs">
        <dt className="text-slate-500">{t("depletes")}</dt>
        <dd className={tone(dtd)}>{dtd == null ? "—" : `${t("in_days", { n: dtd })} · ${item.estimated_depletion_date}`}</dd>
        <dt className="text-slate-500">{t("expires")}</dt>
        <dd className={tone(dte)}>{dte == null ? "—" : `${t("in_days", { n: dte })} · ${item.expiry_date}`}</dd>
        <dt className="text-slate-500">{t("daily")}</dt>
        <dd>{item.daily_consumption_estimate} {item.unit}</dd>
      </dl>
      <form className="mt-2 flex gap-2" onSubmit={logUse}>
        <input className="input py-1" type="number" step="0.1" min="0.1" placeholder={t("quantity")} value={qty} onChange={(e) => setQty(e.target.value)} aria-label={t("log_use")} />
        <button className="btn-ghost px-3 py-1" disabled={busy || !qty}>{t("log")}</button>
        <button
          type="button"
          className="btn-danger px-2 py-1"
          title={t("delete")}
          onClick={async () => {
            if (!confirm(t("confirm_delete"))) return;
            await api(`/api/items/${item.id}`, { method: "DELETE" }).catch(() => null);
            onChanged();
          }}
        >
          🗑
        </button>
      </form>
    </article>
  );
}

function AddItem({ onAdded }: { onAdded: (overBudget: boolean) => void }) {
  const { t } = useI18n();
  const empty = { name: "", category: "General", quantity: "", unit: "pz", purchase_date: today(), expiry_date: "", price: "", daily_consumption_estimate: "" };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const field = (k: keyof typeof empty, label: string, type = "text", extra: Record<string, string> = {}) => (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" type={type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} />
    </label>
  );
  return (
    <section className="card">
      <h2 className="mb-3 font-bold">➕ {t("add_item")}</h2>
      <form
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setErr(null);
          try {
            const r = await api<{ budget_check: { exceeds: boolean } }>("/api/items", { method: "POST", json: f });
            setF(empty);
            onAdded(r.budget_check.exceeds);
          } catch (e2) {
            setErr(e2 instanceof ApiError ? e2.message : String(e2));
          } finally {
            setBusy(false);
          }
        }}
      >
        {field("name", t("name"), "text", { required: "true" })}
        {field("category", t("category"))}
        {field("quantity", t("quantity"), "number", { step: "0.001", min: "0", required: "true" })}
        <label className="block">
          <span className="label">{t("unit")}</span>
          <select className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>
            {["pz", "kg", "g", "L", "ml", "paq"].map((u) => <option key={u}>{u}</option>)}
          </select>
        </label>
        {field("purchase_date", t("purchase_date"), "date")}
        {field("expiry_date", t("expiry_date"), "date")}
        {field("price", t("price"), "number", { step: "0.01", min: "0" })}
        {field("daily_consumption_estimate", t("daily"), "number", { step: "0.001", min: "0" })}
        {err && <p className="col-span-full text-sm text-red-700">{err}</p>}
        <div className="col-span-full text-right">
          <button className="btn-primary" disabled={busy}>{busy ? t("working") : t("add_item")}</button>
        </div>
      </form>
    </section>
  );
}
