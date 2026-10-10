// Katerbot — inventory math + alert rules (pure functions, unit-testable)
import type { AlertInput, BudgetSettings, CaterItem, CaterItemWithStatus, ConsumptionLog, ReapOrder } from "./types";
import { addDaysISO, diffDays, todayISO } from "./dates";

/** days_to_depletion = quantity / daily_consumption_estimate */
export function daysToDepletion(item: Pick<CaterItem, "quantity" | "daily_consumption_estimate">): number | null {
  if (!item.daily_consumption_estimate || item.daily_consumption_estimate <= 0) return null;
  return Math.round((item.quantity / item.daily_consumption_estimate) * 100) / 100;
}

export function withStatus(item: CaterItem, today = todayISO()): CaterItemWithStatus {
  const dtd = daysToDepletion(item);
  return {
    ...item,
    days_to_depletion: dtd,
    estimated_depletion_date: dtd == null ? null : addDaysISO(today, Math.floor(dtd)),
    days_to_expiry: item.expiry_date ? diffDays(today, item.expiry_date) : null,
  };
}

/** Weekly spend = inventory purchases in the last 7 days + completed Reap orders in the last 7 days. */
export function weeklySpend(items: CaterItem[], orders: ReapOrder[], today = todayISO()): number {
  const from = addDaysISO(today, -6);
  const itemSpend = items
    .filter((i) => i.purchase_date >= from && i.purchase_date <= today)
    .reduce((s, i) => s + Number(i.price || 0), 0);
  const orderSpend = orders
    .filter((o) => o.status === "COMPLETED" && o.created_at.slice(0, 10) >= from)
    .reduce((s, o) => s + Number(o.total_amount || 0), 0);
  return Math.round((itemSpend + orderSpend) * 100) / 100;
}

/**
 * Learn the daily consumption: blend the current estimate with the
 * observed average of the last 7 days of logs (50/50).
 */
export function learnDailyEstimate(current: number, logs: ConsumptionLog[], now = new Date()): number {
  const since = now.getTime() - 7 * 86_400_000;
  const recent = logs.filter((l) => new Date(l.logged_at).getTime() >= since);
  if (recent.length === 0) return current;
  const observed = recent.reduce((s, l) => s + Number(l.quantity), 0) / 7;
  const blended = current > 0 ? (current + observed) / 2 : observed;
  return Math.round(blended * 1000) / 1000;
}

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();

/** Alert rules: expiry <= N days, depletion <= N days, weekly spend > budget. */
export function computeAlerts(
  items: CaterItem[],
  budget: BudgetSettings,
  spend: number,
  today = todayISO()
): AlertInput[] {
  const days = budget.alert_days ?? 3;
  const out: AlertInput[] = [];
  for (const raw of items) {
    const it = withStatus(raw, today);
    if (it.days_to_expiry != null && it.days_to_expiry <= days) {
      const expired = it.days_to_expiry < 0;
      out.push({
        cater_item_id: it.id,
        alert_type: "EXPIRY_SOON",
        severity: it.days_to_expiry <= 1 ? "critical" : "warning",
        message_es: expired
          ? `${it.name} caducó hace ${Math.abs(it.days_to_expiry)} día(s).`
          : `${it.name} caduca en ${it.days_to_expiry} día(s) (${it.expiry_date}).`,
        message_en: expired
          ? `${it.name} expired ${Math.abs(it.days_to_expiry)} day(s) ago.`
          : `${it.name} expires in ${it.days_to_expiry} day(s) (${it.expiry_date}).`,
      });
    }
    if (it.days_to_depletion != null && it.days_to_depletion <= days) {
      out.push({
        cater_item_id: it.id,
        alert_type: "DEPLETION_SOON",
        severity: it.days_to_depletion <= 1 ? "critical" : "warning",
        message_es: `${it.name} se agotará en ~${fmt(it.days_to_depletion)} día(s) (quedan ${it.quantity} ${it.unit}).`,
        message_en: `${it.name} will run out in ~${fmt(it.days_to_depletion)} day(s) (${it.quantity} ${it.unit} left).`,
      });
    }
  }
  if (budget.weekly_budget > 0 && spend > budget.weekly_budget) {
    out.push({
      cater_item_id: null,
      alert_type: "BUDGET_EXCEEDED",
      severity: "critical",
      message_es: `Gasto semanal ${spend.toFixed(2)} ${budget.currency} supera el presupuesto de ${budget.weekly_budget.toFixed(2)}.`,
      message_en: `Weekly spend ${spend.toFixed(2)} ${budget.currency} exceeds the ${budget.weekly_budget.toFixed(2)} budget.`,
    });
  }
  return out;
}

/** Would adding `extra` push weekly spend over budget? Used before saving an item or confirming a purchase. */
export function budgetCheck(spend: number, extra: number, budget: BudgetSettings) {
  const projected = Math.round((spend + extra) * 100) / 100;
  return {
    projected,
    exceeds: budget.weekly_budget > 0 && projected > budget.weekly_budget,
    remaining: Math.round((budget.weekly_budget - spend) * 100) / 100,
  };
}
