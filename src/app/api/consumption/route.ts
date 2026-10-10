// GET /api/consumption?item_id= — logs. POST /api/consumption — log daily consumption:
// decrements stock, re-learns daily_consumption_estimate, refreshes alerts.
import { ctx, refreshAlerts } from "@/lib/service";
import { body, fail, handle, json, num, ValidationError } from "@/lib/http";
import { learnDailyEstimate, withStatus } from "@/lib/calc";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { repo, user } = await ctx();
    const id = new URL(req.url).searchParams.get("item_id");
    return json({ logs: await repo.listLogs(user.id, id ? Number(id) : undefined) });
  } catch (e) {
    return handle(e);
  }
}

export async function POST(req: Request) {
  try {
    const { repo, user } = await ctx();
    const b = await body(req);
    const itemId = num(b.cater_item_id, "cater_item_id", { min: 1 });
    const qty = num(b.quantity, "quantity");
    if (qty <= 0) throw new ValidationError("quantity must be > 0");
    const item = await repo.getItem(user.id, itemId);
    if (!item) return fail(404, "NOT_FOUND", "Item not found");
    if (qty > item.quantity) throw new ValidationError(`quantity exceeds stock (${item.quantity} ${item.unit})`);

    const log = await repo.createLog(user.id, itemId, qty, typeof b.note === "string" ? b.note.slice(0, 200) : null);
    const logs = await repo.listLogs(user.id, itemId);
    const updated = await repo.updateItem(user.id, itemId, {
      quantity: Math.round((item.quantity - qty) * 1000) / 1000,
      daily_consumption_estimate: learnDailyEstimate(item.daily_consumption_estimate, logs),
    });
    const alerts = await refreshAlerts(repo, user.id);
    return json({ log, item: updated ? withStatus(updated) : null, alerts }, 201);
  } catch (e) {
    return handle(e);
  }
}
