// POST /api/orders/:id/sync — Reap GET /agentic/checkouts/:id after the user returns from approval.
import { ctx, refreshAlerts } from "@/lib/service";
import { reap } from "@/lib/reap/client";
import { fail, handle, json } from "@/lib/http";
import { applyCheckout } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { repo, user } = await ctx();
    const order = await repo.getOrder(user.id, Number((await params).id));
    if (!order) return fail(404, "NOT_FOUND", "Order not found");
    if (!order.checkout_id) return json({ order });
    if (order.status === "CANCELLED") return json({ order });
    const c = await reap.getCheckout(order.checkout_id);
    const updated = await applyCheckout(repo, user.id, order, c);
    await refreshAlerts(repo, user.id);
    return json({ order: updated });
  } catch (e) {
    return handle(e);
  }
}
