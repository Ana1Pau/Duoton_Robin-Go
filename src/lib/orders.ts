// Katerbot — order lifecycle helpers (Reap checkout → reap_orders + inventory).
import type { Repo } from "./db/repo";
import type { ReapOrder, ReapOrderStatus } from "./types";
import type { Checkout } from "./reap/types";
import { addDaysISO, diffDays, todayISO } from "./dates";

export const OPEN_STATUSES: ReapOrderStatus[] = ["DRAFT", "QUOTED", "REQUIRES_ACTION", "PROCESSING"];

export function isQuoteExpired(o: Pick<ReapOrder, "quote_expires_at">, now = Date.now()) {
  return !!o.quote_expires_at && new Date(o.quote_expires_at).getTime() <= now;
}

/** Persist checkout result. Stores ONLY ids/status/amount — never card data. Idempotent. */
export async function applyCheckout(repo: Repo, userId: number, order: ReapOrder, c: Checkout): Promise<ReapOrder> {
  const status: ReapOrderStatus = c.status;
  const amount = c.finalAmount ?? c.amount;
  const wasCompleted = order.status === "COMPLETED";
  const updated = await repo.updateOrder(userId, order.id, {
    checkout_id: c.id,
    status,
    order_reference: c.orderId ?? order.order_reference,
    total_amount: amount?.amount ?? order.total_amount,
    currency: amount?.currency ?? order.currency,
    error_code: status === "FAILED" ? "CHECKOUT_FAILED" : status === "EXPIRED" ? "CHECKOUT_EXPIRED" : null,
  });
  if (status === "COMPLETED" && !wasCompleted) await restock(repo, userId, order);
  return updated ?? order;
}

/** After a completed purchase, add bought quantities back to the pantry and refresh expiry. */
async function restock(repo: Repo, userId: number, order: ReapOrder) {
  const today = todayISO();
  for (const line of order.items) {
    if (!line.cater_item_id) continue;
    const item = await repo.getItem(userId, line.cater_item_id);
    if (!item) continue;
    const shelfLife = item.expiry_date ? Math.max(1, diffDays(item.purchase_date, item.expiry_date)) : null;
    const expiredOrSoon = item.expiry_date ? diffDays(today, item.expiry_date) <= 1 : false;
    await repo.updateItem(userId, item.id, {
      quantity: Math.round(((expiredOrSoon ? 0 : item.quantity) + Number(line.quantity)) * 1000) / 1000,
      expiry_date: shelfLife ? addDaysISO(today, shelfLife) : item.expiry_date,
    });
  }
}
