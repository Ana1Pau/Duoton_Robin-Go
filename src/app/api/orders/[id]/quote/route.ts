// POST /api/orders/:id/quote — Reap POST /agentic/quotes. Also used to RE-QUOTE after expiry.
import { randomUUID } from "crypto";
import { ctx } from "@/lib/service";
import { reap } from "@/lib/reap/client";
import { fail, handle, json } from "@/lib/http";
import type { CreateQuoteRequest } from "@/lib/reap/types";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { repo, user } = await ctx();
    const order = await repo.getOrder(user.id, Number((await params).id));
    if (!order) return fail(404, "NOT_FOUND", "Order not found");
    if (!["DRAFT", "QUOTED", "EXPIRED"].includes(order.status)) return fail(409, "INVALID_STATE", `Order is ${order.status}`);
    const lines = order.items.filter((l) => l.variant_id);
    if (lines.length === 0) return fail(409, "NO_VARIANTS", "Run product search first");

    const req: CreateQuoteRequest = {
      items: lines.map((l) => ({ variantId: l.variant_id!, quantity: l.packs ?? 1 })),
      email: user.email,
    };
    if (process.env.REAP_SHIPPING_ADDRESS_JSON) {
      try { req.shippingAddress = JSON.parse(process.env.REAP_SHIPPING_ADDRESS_JSON); } catch { /* ignore malformed */ }
    }
    try {
      const q = await reap.createQuote(req, randomUUID());
      const updated = await repo.updateOrder(user.id, order.id, {
        quote_id: q.id,
        status: "QUOTED",
        total_amount: q.amountBreakdown.finalAmount.amount,
        currency: q.amountBreakdown.finalAmount.currency,
        quote_expires_at: q.expiresAt,
        checkout_id: null,
        error_code: null,
      });
      return json({ order: updated, quote: q, mode: reap.mode() });
    } catch (e) {
      const code = (e as { code?: string }).code ?? "QUOTE_FAILED";
      await repo.updateOrder(user.id, order.id, { error_code: code.slice(0, 60) });
      throw e;
    }
  } catch (e) {
    return handle(e);
  }
}
