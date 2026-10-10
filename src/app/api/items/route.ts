// GET /api/items — inventory with depletion/expiry status. POST /api/items — add item manually.
import { ctx, refreshAlerts, snapshot } from "@/lib/service";
import { body, handle, json } from "@/lib/http";
import { budgetCheck, withStatus } from "@/lib/calc";
import type { CaterItemInput } from "@/lib/types";
import { parseItem } from "./validate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { repo, user } = await ctx();
    const { itemsWithStatus, budget, spend } = await snapshot(repo, user.id);
    return json({ items: itemsWithStatus, budget, weekly_spend: spend });
  } catch (e) {
    return handle(e);
  }
}

export async function POST(req: Request) {
  try {
    const { repo, user } = await ctx();
    const input = parseItem(await body(req)) as CaterItemInput;
    const { budget, spend } = await snapshot(repo, user.id);
    const check = budgetCheck(spend, input.price, budget); // "would this purchase exceed the weekly budget?"
    const item = await repo.createItem(user.id, input);
    const alerts = await refreshAlerts(repo, user.id);
    return json({ item: withStatus(item), budget_check: check, alerts }, 201);
  } catch (e) {
    return handle(e);
  }
}
