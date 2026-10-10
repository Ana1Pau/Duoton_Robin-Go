// Katerbot — repository contract. Two implementations:
//  - mssql.ts  : SQL Server 2025 (when SQLSERVER_CONNECTION_STRING is set)
//  - memory.ts : offline JSON-file store for demos without a database
import type {
  Alert,
  AlertInput,
  BudgetSettings,
  CaterItem,
  CaterItemInput,
  ConsumptionLog,
  EnrollmentStatus,
  ReapOrder,
  ReapOrderPatch,
  User,
} from "../types";

export interface Repo {
  kind: "sqlserver" | "memory";
  getDemoUser(): Promise<User>;
  setEnrollment(userId: number, enrollmentId: string | null, status: EnrollmentStatus | null): Promise<void>;

  listItems(userId: number): Promise<CaterItem[]>;
  getItem(userId: number, id: number): Promise<CaterItem | null>;
  createItem(userId: number, input: CaterItemInput): Promise<CaterItem>;
  updateItem(userId: number, id: number, input: Partial<CaterItemInput>): Promise<CaterItem | null>;
  deleteItem(userId: number, id: number): Promise<boolean>;

  listLogs(userId: number, itemId?: number): Promise<ConsumptionLog[]>;
  createLog(userId: number, itemId: number, quantity: number, note: string | null): Promise<ConsumptionLog>;
  deleteLog(userId: number, id: number): Promise<boolean>;

  getBudget(userId: number): Promise<BudgetSettings>;
  upsertBudget(userId: number, b: Omit<BudgetSettings, "user_id">): Promise<BudgetSettings>;

  /** Replace open alerts with a freshly computed set (idempotent refresh). */
  replaceOpenAlerts(userId: number, alerts: AlertInput[]): Promise<Alert[]>;
  listAlerts(userId: number, includeResolved?: boolean): Promise<Alert[]>;
  resolveAlert(userId: number, id: number): Promise<boolean>;

  listOrders(userId: number): Promise<ReapOrder[]>;
  getOrder(userId: number, id: number): Promise<ReapOrder | null>;
  createOrder(userId: number, o: { product_query: string; items: ReapOrder["items"]; is_mock: boolean }): Promise<ReapOrder>;
  updateOrder(userId: number, id: number, patch: ReapOrderPatch): Promise<ReapOrder | null>;

  resetDemo(): Promise<void>;
}
