// POST /api/orders/:id/checkout — Reap POST /agentic/checkouts.
// Preconditions: user confirmed the quote summary, enrollment ACTIVE, quote not expired.
// Returns next_action_url when Reap needs the user to approve on its hosted page.
import { ctx } from "@/lib/service";
import { reap } from "@/lib/reap/client";
import { appBaseUrl, fail, handle, json } from "@/lib/http";
import { applyCheckout, isQuoteExpired } from "@/lib/orders";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { repo, user } = await ctx();
    const order = await repo.getOrder(user.id, Number((await params).id));
    if (!order) return fail(404, "NOT_FOUND", "Order not found");
    if (order.status !== "QUOTED" || !order.quote_id) return fail(409, "INVALID_STATE", `Order is ${order.status}`);
    if (isQuoteExpired(order)) {
      await repo.updateOrder(user.id, order.id, { status: "EXPIRED", error_code: "QUOTE_EXPIRED" });
      return fail(409, "QUOTE_EXPIRED", "The quote expired. Request a new quote.");
    }
    if (!user.reap_enrollment_id) return fail(409, "ENROLLMENT_REQUIRED", "Enroll a card with Reap first");
    const enr = await reap.getEnrollment(user.reap_enrollment_id);
    await repo.setEnrollment(user.id, enr.id, enr.status);
    if (enr.status !== "ACTIVE") return fail(409, "ENROLLMENT_NOT_ACTIVE", `Enrollment is ${enr.status}`);

    // Deterministic idempotency key: a retry for the same quote can never charge twice.
    const c = await reap.createCheckout(
      {
        quoteId: order.quote_id,
        enrollmentId: enr.id,
        presentation: { type: "REDIRECT", returnUrl: `${appBaseUrl(req)}/reap/return?order=${order.id}` },
      },
      `katerbot-checkout-${order.id}-${order.quote_id}`
    );
    await repo.updateOrder(user.id, order.id, { enrollment_id: enr.id });
    const updated = await applyCheckout(repo, user.id, { ...order, enrollment_id: enr.id }, c);
    return json({ order: updated, next_action_url: c.nextAction?.url ?? null, mode: reap.mode() });
  } catch (e) {
    return handle(e);
  }
}
