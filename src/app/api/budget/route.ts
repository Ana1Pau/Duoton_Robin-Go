import { ctx, refreshAlerts, snapshot } from "@/lib/service";
import { body, handle, json, num, ValidationError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { repo, user } = await ctx();
    const { budget, spend } = await snapshot(repo, user.id);
    return json({ budget, weekly_spend: spend });
  } catch (e) {
    return handle(e);
  }
}

export async function PUT(req: Request) {
  try {
    const { repo, user } = await ctx();
    const b = await body(req);
    const current = await repo.getBudget(user.id);
    const currency = String(b.currency ?? current.currency).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new ValidationError("currency must be ISO 4217 (e.g. MXN)");
    const alertDays = b.alert_days === undefined ? current.alert_days : num(b.alert_days, "alert_days", { min: 1 });
    const budget = await repo.upsertBudget(user.id, {
      weekly_budget: num(b.weekly_budget ?? current.weekly_budget, "weekly_budget"),
      currency,
      alert_days: Math.min(30, Math.round(alertDays)),
    });
    const alerts = await refreshAlerts(repo, user.id);
    return json({ budget, alerts });
  } catch (e) {
    return handle(e);
  }
}
