// Katerbot — server-side orchestration shared by API routes.
import { getRepo } from "./db";
import { computeAlerts, weeklySpend, withStatus } from "./calc";
import type { Repo } from "./db/repo";

export async function ctx() {
  const repo = await getRepo();
  const user = await repo.getDemoUser(); // single demo user for the hackathon (auth out of scope)
  return { repo, user };
}

export async function snapshot(repo: Repo, userId: number) {
  const [items, budget, orders] = await Promise.all([repo.listItems(userId), repo.getBudget(userId), repo.listOrders(userId)]);
  const spend = weeklySpend(items, orders);
  return { items, budget, orders, spend, itemsWithStatus: items.map((i) => withStatus(i)) };
}

/** Recompute alerts from current state and persist them (replaces open alerts). */
export async function refreshAlerts(repo: Repo, userId: number) {
  const { items, budget, spend } = await snapshot(repo, userId);
  return repo.replaceOpenAlerts(userId, computeAlerts(items, budget, spend));
}
