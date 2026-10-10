import type { CaterItemInput } from "@/lib/types";
import { dateStr, num, str, ValidationError } from "@/lib/http";
import { todayISO } from "@/lib/dates";

export function parseItem(b: Record<string, unknown>, partial = false): Partial<CaterItemInput> {
  const out: Partial<CaterItemInput> = {};
  const has = (k: string) => b[k] !== undefined;
  if (!partial || has("name")) out.name = str(b.name, "name");
  if (!partial || has("category")) out.category = str(b.category ?? "General", "category", 60);
  if (!partial || has("quantity")) out.quantity = num(b.quantity, "quantity");
  if (!partial || has("unit")) out.unit = str(b.unit ?? "pz", "unit", 20);
  if (!partial || has("purchase_date")) out.purchase_date = dateStr(b.purchase_date, "purchase_date") ?? todayISO();
  if (!partial || has("expiry_date")) out.expiry_date = dateStr(b.expiry_date, "expiry_date");
  if (!partial || has("price")) out.price = num(b.price ?? 0, "price");
  if (!partial || has("daily_consumption_estimate")) out.daily_consumption_estimate = num(b.daily_consumption_estimate ?? 0, "daily_consumption_estimate");
  if (out.expiry_date && out.purchase_date && out.expiry_date < out.purchase_date) throw new ValidationError("expiry_date must be on/after purchase_date");
  return out;
}
