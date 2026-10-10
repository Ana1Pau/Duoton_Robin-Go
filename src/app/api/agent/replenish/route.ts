// POST /api/agent/replenish — Katerbot agent proposes what to buy, how much and why.
// Rule-based (alerts + budget + order history). Nothing is purchased here.
import { ctx, refreshAlerts, snapshot } from "@/lib/service";
import { buildProposal } from "@/lib/agent";
import { handle, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const { repo, user } = await ctx();
    const alerts = await refreshAlerts(repo, user.id);
    const { items, budget, spend, orders } = await snapshot(repo, user.id);
    const proposal = buildProposal(items, budget, spend, orders);
    return json({ proposal, alerts });
  } catch (e) {
    return handle(e);
  }
}
