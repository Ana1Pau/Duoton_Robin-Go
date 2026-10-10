// POST /api/orders/:id/cancel — user cancels before paying. Nothing is charged.
import { ctx } from "@/lib/service";
import { fail, handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { repo, user } = await ctx();
    const order = await repo.getOrder(user.id, Number((await params).id));
    if (!order) return fail(404, "NOT_FOUND", "Order not found");
    if (!["DRAFT", "QUOTED", "EXPIRED", "REQUIRES_ACTION"].includes(order.status)) {
      return fail(409, "INVALID_STATE", `Cannot cancel an order that is ${order.status}`);
    }
    const updated = await repo.updateOrder(user.id, order.id, { status: "CANCELLED", error_code: "USER_CANCELLED" });
    return json({ order: updated });
  } catch (e) {
    return handle(e);
  }
}
