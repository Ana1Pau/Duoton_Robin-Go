"use client";
// Katerbot — confirmation summary + Reap purchase flow (enroll → search → quote → checkout).
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, money } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { ReapOrder, ReplenishProposal, ReplenishProposalLine } from "@/lib/types";
import type { Quote } from "@/lib/reap/types";

type Step = "summary" | "enroll" | "search" | "quote" | "await_enroll" | "quoted" | "paying" | "redirect" | "done" | "cancelled" | "error";

interface Props {
  proposal: ReplenishProposal;
  lines: ReplenishProposalLine[];
  onClose: () => void;
  onFinished: () => void;
}

export function PurchaseFlow({ proposal, lines, onClose, onFinished }: Props) {
  const { t, lang } = useI18n();
  const [step, setStep] = useState<Step>("summary");
  const [order, setOrder] = useState<ReapOrder | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [enrollUrl, setEnrollUrl] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [now, setNow] = useState(Date.now());
  const [serverExpired, setServerExpired] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const total = lines.reduce((s, l) => s + l.estimated_cost, 0);
  const overBudget = proposal.weekly_budget > 0 && proposal.weekly_spend + total > proposal.weekly_budget;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const secondsLeft = order?.quote_expires_at ? Math.max(0, Math.floor((new Date(order.quote_expires_at).getTime() - now) / 1000)) : null;
  const expired = step === "quoted" && (secondsLeft === 0 || serverExpired);

  const signal = () => {
    abort.current?.abort();
    abort.current = new AbortController();
    return abort.current.signal;
  };

  const fail = (e: unknown) => {
    if ((e as Error).name === "AbortError") return;
    setError(e instanceof ApiError ? e : new ApiError(0, "NETWORK_ERROR", (e as Error).message));
    setStep("error");
  };

  const searchAndQuote = useCallback(async (o: ReapOrder, sig: AbortSignal) => {
    setStep("search");
    const s = await api<{ order: ReapOrder }>(`/api/orders/${o.id}/search`, { method: "POST", signal: sig });
    setOrder(s.order);
    setStep("quote");
    const q = await api<{ order: ReapOrder; quote: Quote }>(`/api/orders/${o.id}/quote`, { method: "POST", signal: sig });
    setOrder(q.order);
    setQuote(q.quote);
    setStep("quoted");
  }, []);

  async function start() {
    const sig = signal();
    setError(null);
    try {
      setStep("enroll");
      const created = await api<{ order: ReapOrder }>("/api/orders", { method: "POST", json: { lines, locale: lang }, signal: sig });
      setOrder(created.order);
      const e = await api<{ enrollment: { status: string; next_action_url: string | null } }>("/api/reap/enrollments", { method: "POST", signal: sig });
      if (e.enrollment.status !== "ACTIVE") {
        setEnrollUrl(e.enrollment.next_action_url);
        setStep("await_enroll");
        return;
      }
      await searchAndQuote(created.order, sig);
    } catch (e) {
      fail(e);
    }
  }

  async function checkEnrollment() {
    if (!order) return;
    const sig = signal();
    try {
      const e = await api<{ enrollment: { status: string; next_action_url: string | null } | null }>("/api/reap/enrollments", { signal: sig });
      if (e.enrollment?.status === "ACTIVE") await searchAndQuote(order, sig);
      else setEnrollUrl(e.enrollment?.next_action_url ?? enrollUrl);
    } catch (e) {
      fail(e);
    }
  }

  async function requote() {
    if (!order) return;
    const sig = signal();
    try {
      setServerExpired(false);
      setStep("quote");
      const q = await api<{ order: ReapOrder; quote: Quote }>(`/api/orders/${order.id}/quote`, { method: "POST", signal: sig });
      setOrder(q.order);
      setQuote(q.quote);
      setStep("quoted");
    } catch (e) {
      fail(e);
    }
  }

  async function pay() {
    if (!order) return;
    const sig = signal();
    try {
      setStep("paying");
      const r = await api<{ order: ReapOrder; next_action_url: string | null }>(`/api/orders/${order.id}/checkout`, { method: "POST", signal: sig });
      setOrder(r.order);
      if (r.next_action_url) {
        setStep("redirect");
        window.location.assign(r.next_action_url); // Reap-hosted approval page (card data stays at Reap)
        return;
      }
      const s = await api<{ order: ReapOrder }>(`/api/orders/${order.id}/sync`, { method: "POST", signal: sig });
      setOrder(s.order);
      setStep(s.order.status === "COMPLETED" ? "done" : "error");
      if (s.order.status !== "COMPLETED") setError(new ApiError(0, s.order.error_code ?? s.order.status, s.order.status));
      onFinished();
    } catch (e) {
      if (e instanceof ApiError && e.code === "QUOTE_EXPIRED") {
        setOrder((o) => (o ? { ...o, status: "EXPIRED" } : o));
        setServerExpired(true);
        setStep("quoted");
        return;
      }
      fail(e);
    }
  }

  async function cancel() {
    abort.current?.abort();
    if (order && ["DRAFT", "QUOTED", "EXPIRED", "REQUIRES_ACTION"].includes(order.status)) {
      try {
        const r = await api<{ order: ReapOrder }>(`/api/orders/${order.id}/cancel`, { method: "POST" });
        setOrder(r.order);
      } catch {
        /* already final */
      }
    }
    setStep(order ? "cancelled" : "summary");
    if (!order) onClose();
    onFinished();
  }

  const busy = ["enroll", "search", "quote", "paying", "redirect"].includes(step);
  const stepIdx = { summary: -1, enroll: 0, await_enroll: 0, search: 1, quote: 2, quoted: 3, paying: 3, redirect: 3, done: 4, cancelled: -1, error: -1 }[step];
  const steps = [t("step_enroll"), t("step_search"), t("step_quote"), t("step_checkout")];
  const cur = quote?.amountBreakdown.finalAmount.currency ?? proposal.currency;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl sm:p-6">
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold">{t("summary_title")}</h2>
          {!busy && (
            <button className="btn-ghost px-2 py-1" onClick={step === "summary" || ["done", "cancelled", "error"].includes(step) ? onClose : cancel}>
              ✕
            </button>
          )}
        </div>

        {stepIdx >= 0 && (
          <ol className="mb-4 grid grid-cols-4 gap-1 text-center text-[11px] sm:text-xs">
            {steps.map((s, i) => (
              <li key={s} className={`rounded-lg px-1 py-1.5 ${i < stepIdx ? "bg-kater-100 text-kater-700" : i === stepIdx ? "bg-kater-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                {i < stepIdx ? "✓ " : ""}{s}
              </li>
            ))}
          </ol>
        )}

        {/* Order lines (always visible = clear summary) */}
        <ul className="mb-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {(order?.items.length ? order.items : lines.map((l) => ({ name: l.name, quantity: l.proposed_quantity, unit: l.unit, packs: l.packs, reason: (lang === "en" ? l.reasons[0]?.en : l.reasons[0]?.es), merchant: undefined, unit_price: undefined }))).map((l, i) => (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <div>
                <p className="font-semibold">{l.name} · {l.quantity} {l.unit} {l.packs && l.packs > 1 ? `(${l.packs}×)` : ""}</p>
                {l.reason && <p className="text-xs text-slate-500">{l.reason}</p>}
                {l.merchant && <p className="text-xs text-slate-500">{t("merchant")}: {l.merchant}</p>}
              </div>
              {l.unit_price != null && <span className="text-sm">{money(l.unit_price * (l.packs ?? 1), cur)}</span>}
            </li>
          ))}
        </ul>

        {step === "summary" && (
          <>
            <p className="mb-2 text-sm">{t("est_cost")}: <b>{money(total, proposal.currency)}</b> · {t("remaining")}: {money(proposal.remaining_budget, proposal.currency)}</p>
            {overBudget && <p className="mb-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-800">⚠️ {t("over_budget_warn")}</p>}
            <p className="mb-2 text-sm text-slate-600">{t("summary_note")}</p>
            <p className="mb-4 text-xs text-slate-500">🔒 {t("privacy")}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <button className="btn-ghost" onClick={onClose}>{t("cancel")}</button>
              <button className="btn-primary" onClick={start}>{t("confirm_and_quote")}</button>
            </div>
          </>
        )}

        {busy && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm">
            <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-kater-600 border-t-transparent" />{step === "redirect" ? t("redirecting") : t("working")}</span>
            {step !== "redirect" && <button className="btn-danger px-3 py-1" onClick={cancel}>{t("stop")}</button>}
          </div>
        )}

        {step === "await_enroll" && (
          <div className="space-y-3 rounded-xl bg-amber-50 p-3 text-sm">
            <p>🔒 {t("enroll_needed")}</p>
            <div className="flex flex-wrap gap-2">
              {enrollUrl && <a className="btn-primary" href={enrollUrl} target="_blank" rel="noopener noreferrer">{t("open_reap")} ↗</a>}
              <button className="btn-ghost" onClick={checkEnrollment}>{t("check_status")}</button>
              <button className="btn-danger" onClick={cancel}>{t("cancel_order")}</button>
            </div>
          </div>
        )}

        {step === "quoted" && quote && (
          <div className="space-y-3">
            <div className="rounded-xl border border-kater-100 bg-kater-50 p-3 text-sm">
              <p className="mb-2 font-semibold">{t("quote_ready")} {order?.is_mock && <span className="badge ml-1 bg-amber-100 text-amber-800">MOCK</span>}</p>
              <dl className="grid grid-cols-2 gap-1">
                <dt>{t("subtotal")}</dt><dd className="text-right">{money(quote.amountBreakdown.itemsSubtotal.amount, cur)}</dd>
                {quote.amountBreakdown.shipping && (<><dt>{t("shipping")}</dt><dd className="text-right">{money(quote.amountBreakdown.shipping.amount, cur)}</dd></>)}
                {quote.amountBreakdown.tax && (<><dt>{t("tax")}</dt><dd className="text-right">{money(quote.amountBreakdown.tax.amount.amount, cur)}</dd></>)}
                <dt className="font-bold">{t("total")}</dt><dd className="text-right text-base font-bold">{money(quote.amountBreakdown.finalAmount.amount, cur)}</dd>
              </dl>
              {proposal.weekly_budget > 0 && proposal.weekly_spend + quote.amountBreakdown.finalAmount.amount > proposal.weekly_budget && (
                <p className="mt-2 text-amber-800">⚠️ {t("over_budget_warn")}</p>
              )}
              <p className={`mt-2 text-xs ${expired ? "font-semibold text-red-700" : "text-slate-600"}`}>
                {expired ? t("quote_expired") : `${t("expires_in")} ${Math.floor((secondsLeft ?? 0) / 60)}:${String((secondsLeft ?? 0) % 60).padStart(2, "0")}`}
              </p>
            </div>
            <p className="text-xs text-slate-500">🔒 {t("privacy")}</p>
            <div className="flex flex-wrap justify-end gap-2">
              <button className="btn-danger" onClick={cancel}>{t("cancel_order")}</button>
              {expired ? (
                <button className="btn-primary" onClick={requote}>{t("requote")}</button>
              ) : (
                <button className="btn-primary" onClick={pay}>{t("pay")}</button>
              )}
            </div>
          </div>
        )}

        {step === "done" && order && (
          <div className="space-y-2 rounded-xl bg-kater-50 p-3 text-sm">
            <p className="font-semibold text-kater-700">✅ {t("completed")}</p>
            <p>{t("order_ref")}: <code>{order.order_reference}</code></p>
            <p>{t("total")}: {money(order.total_amount, order.currency ?? cur)}</p>
            <p className="text-xs text-slate-500">checkout_id: <code>{order.checkout_id}</code> · quote_id: <code>{order.quote_id}</code></p>
            <div className="text-right"><button className="btn-primary" onClick={onClose}>{t("close")}</button></div>
          </div>
        )}

        {step === "cancelled" && (
          <div className="space-y-2 rounded-xl bg-slate-100 p-3 text-sm">
            <p>{t("cancelled")}</p>
            <div className="text-right"><button className="btn-ghost" onClick={onClose}>{t("close")}</button></div>
          </div>
        )}

        {step === "error" && error && (
          <div className="space-y-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            <p className="font-semibold">{error.code}</p>
            <p>{error.message}</p>
            <div className="flex justify-end gap-2">
              {order && <button className="btn-danger" onClick={cancel}>{t("cancel_order")}</button>}
              <button className="btn-ghost" onClick={onClose}>{t("close")}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
