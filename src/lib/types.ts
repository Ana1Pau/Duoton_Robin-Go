// Katerbot — shared domain types (mirror of sql/001_schema.sql)

export interface User {
  id: number;
  email: string;
  display_name: string;
  locale: "es" | "en";
  reap_customer_reference: string | null;
  reap_enrollment_id: string | null;
  reap_enrollment_status: EnrollmentStatus | null;
}

export type EnrollmentStatus = "REQUIRES_ACTION" | "ACTIVE" | "FAILED" | "EXPIRED" | "REVOKED";

export interface CaterItem {
  id: number;
  user_id: number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  purchase_date: string; // YYYY-MM-DD
  expiry_date: string | null; // YYYY-MM-DD
  price: number;
  daily_consumption_estimate: number;
}

export interface CaterItemWithStatus extends CaterItem {
  days_to_depletion: number | null;
  estimated_depletion_date: string | null;
  days_to_expiry: number | null;
}

export type CaterItemInput = Omit<CaterItem, "id" | "user_id">;

export interface ConsumptionLog {
  id: number;
  user_id: number;
  cater_item_id: number;
  quantity: number;
  logged_at: string; // ISO
  note: string | null;
}

export type AlertType = "EXPIRY_SOON" | "DEPLETION_SOON" | "BUDGET_EXCEEDED";
export type Severity = "info" | "warning" | "critical";

export interface Alert {
  id: number;
  user_id: number;
  cater_item_id: number | null;
  alert_type: AlertType;
  severity: Severity;
  message_es: string;
  message_en: string;
  is_resolved: boolean;
  created_at: string;
}

export type AlertInput = Omit<Alert, "id" | "user_id" | "is_resolved" | "created_at">;

export interface BudgetSettings {
  user_id: number;
  weekly_budget: number;
  currency: string;
  alert_days: number;
}

export type ReapOrderStatus =
  | "DRAFT"
  | "QUOTED"
  | "REQUIRES_ACTION"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED";

export interface ReapOrderLine {
  name: string;
  quantity: number;
  unit: string;
  product_id?: string;
  variant_id?: string;
  unit_price?: number;
  packs?: number;
  merchant?: string;
  cater_item_id?: number;
  reason?: string;
}

/** Only identifiers + status. Never PAN/CVV/OTP. */
export interface ReapOrder {
  id: number;
  user_id: number;
  product_query: string;
  enrollment_id: string | null;
  quote_id: string | null;
  checkout_id: string | null;
  order_reference: string | null;
  status: ReapOrderStatus;
  total_amount: number | null;
  currency: string | null;
  quote_expires_at: string | null;
  items: ReapOrderLine[];
  is_mock: boolean;
  error_code: string | null;
  created_at: string;
  updated_at: string;
}

export type ReapOrderPatch = Partial<
  Pick<
    ReapOrder,
    | "enrollment_id"
    | "quote_id"
    | "checkout_id"
    | "order_reference"
    | "status"
    | "total_amount"
    | "currency"
    | "quote_expires_at"
    | "items"
    | "error_code"
  >
>;

export interface ReplenishProposalLine {
  cater_item_id: number;
  name: string;
  category: string;
  unit: string;
  current_quantity: number;
  proposed_quantity: number;
  estimated_unit_price: number;
  estimated_cost: number;
  priority: number; // higher = more urgent
  reasons: { es: string; en: string }[];
  product_query: string;
  packs: number; // purchasable units sent to Reap (e.g. 2 dozen eggs)
  pack_size: number;
  within_budget: boolean;
}

export interface ReplenishProposal {
  generated_at: string;
  agent: "katerbot-rules-v1";
  currency: string;
  weekly_budget: number;
  weekly_spend: number;
  remaining_budget: number;
  estimated_total: number;
  estimated_total_within_budget: number;
  lines: ReplenishProposalLine[];
  summary: { es: string; en: string };
}
