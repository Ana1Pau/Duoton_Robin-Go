// POST /api/orders/:id/search — Reap POST /agentic/products/search for every line;
// the agent picks the cheapest available variant per product.
import { ctx } from "@/lib/service";
import { reap } from "@/lib/reap/client";
import { fail, handle, json } from "@/lib/http";
import { englishQuery } from "@/lib/agent";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { repo, user } = await ctx();
    const order = await repo.getOrder(user.id, Number((await params).id));
    if (!order) return fail(404, "NOT_FOUND", "Order not found");
    if (order.status !== "DRAFT") return fail(409, "INVALID_STATE", `Order is ${order.status}`);

    const country = process.env.REAP_COUNTRY || "MX";
    const currency = process.env.REAP_CURRENCY || "MXN";
    const results = [];
    const items = [];
    for (const line of order.items) {
      const query = reap.mode() === "live" && country !== "MX" ? englishQuery(line.name) : line.name;
      const r = await reap.searchProducts({
        query,
        context: { country, currency },
        filters: { availability: "AVAILABLE_ONLY" },
        pagination: { limit: 5 },
      });
      const candidates = r.products
        .filter((p) => p.previewVariant && p.available !== false && p.previewVariant.available !== false)
        .sort((a, b) => a.previewVariant!.price.amount - b.previewVariant!.price.amount);
      const best = candidates[0];
      results.push({
        name: line.name,
        query,
        found: candidates.length,
        chosen: best ? { product_id: best.id, name: best.name, merchant: best.merchant.name, variant_id: best.previewVariant!.id, price: best.previewVariant!.price } : null,
        warnings: r.warnings,
      });
      items.push(best ? { ...line, product_id: best.id, variant_id: best.previewVariant!.id, unit_price: best.previewVariant!.price.amount, merchant: best.merchant.name } : line);
    }
    if (!items.some((i) => "variant_id" in i && i.variant_id)) {
      await repo.updateOrder(user.id, order.id, { status: "FAILED", error_code: "NO_PRODUCTS_FOUND", items });
      return fail(422, "NO_PRODUCTS_FOUND", "Reap returned no purchasable products for this order");
    }
    const updated = await repo.updateOrder(user.id, order.id, { items });
    return json({ order: updated, results, mode: reap.mode() });
  } catch (e) {
    return handle(e);
  }
}
