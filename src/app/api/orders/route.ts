// GET  /api/orders — purchase history (reap_orders).
// POST /api/orders — user confirmed the agent summary: create a DRAFT order from selected lines.
import { ctx } from "@/lib/service";
import { reap } from "@/lib/reap/client";
import { body, handle, json, ValidationError } from "@/lib/http";
import type { ReapOrderLine, ReplenishProposalLine } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { repo, user } = await ctx();
    return json({ orders: await repo.listOrders(user.id) });
  } catch (e) {
    return handle(e);
  }
}

export async function POST(req: Request) {
  try {
    const { repo, user } = await ctx();
    const b = await body<{ lines?: ReplenishProposalLine[]; locale?: string }>(req);
    const lines = Array.isArray(b.lines) ? b.lines : [];
    if (lines.length === 0) throw new ValidationError("Select at least one product");
    if (lines.length > 20) throw new ValidationError("Too many lines (max 20)");
    const items: ReapOrderLine[] = lines.map((l) => ({
      cater_item_id: Number(l.cater_item_id) || undefined,
      name: String(l.name).slice(0, 120),
      quantity: Number(l.proposed_quantity) || 1,
      unit: String(l.unit ?? "pz").slice(0, 20),
      packs: Math.max(1, Math.round(Number(l.packs) || 1)),
      reason: (b.locale === "en" ? l.reasons?.[0]?.en : l.reasons?.[0]?.es) ?? undefined,
    }));
    const order = await repo.createOrder(user.id, {
      product_query: lines.map((l) => String(l.product_query || l.name)).join(", "),
      items,
      is_mock: reap.mode() === "mock",
    });
    return json({ order }, 201);
  } catch (e) {
    return handle(e);
  }
}
