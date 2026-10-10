// Katerbot — thin Reap Agentic Payments client.
//  * LIVE mode when REAP_API_KEY is set: calls REAP_BASE_URL with
//    Authorization: Bearer <key> (or X-API-Key when REAP_AUTH_STYLE=x-api-key),
//    Reap-Version and an Idempotency-Key on every create call.
//  * MOCK mode otherwise (see ./mock.ts). Responses carry `mock: true`.
// All responses pass through stripSensitive() — card number / CVV / OTP never leave this module.
import { randomUUID } from "crypto";
import { mockReap } from "./mock";
import { stripSensitive } from "./sanitize";
import type {
  Checkout,
  CreateCheckoutRequest,
  CreateEnrollmentRequest,
  CreateQuoteRequest,
  Enrollment,
  ProductSearchRequest,
  ProductSearchResult,
  Quote,
  ReapErrorBody,
} from "./types";

export class ReapError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "ReapError";
  }
}

export function reapMode(): "live" | "mock" {
  return process.env.REAP_ENABLED === "true" && process.env.REAP_API_KEY ? "live" : "mock";
}

const TIMEOUT_MS = Number(process.env.REAP_TIMEOUT_MS || 20000);

async function call<T>(method: "GET" | "POST", path: string, body?: unknown, opts: { idempotencyKey?: string; simulate?: boolean } = {}): Promise<T> {
  const base = (process.env.REAP_BASE_URL || "https://sandbox.api.reap.global").replace(/\/+$/, "");
  if (!["https://sandbox.api.reap.global", "https://sg.sandbox.api.reap.global"].includes(base)) throw new ReapError(503, "SANDBOX_ONLY", "Confirma un host de sandbox permitido.");
  if (process.env.REAP_ADAPTER_REVIEWED !== "true" || !process.env.REAP_VERSION) throw new ReapError(503, "REVIEW_REQUIRED", "El desarrollador debe verificar el contrato actual de REAP y configurar la version antes de habilitar sandbox.");
  const key = process.env.REAP_API_KEY!;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Reap-Version": process.env.REAP_VERSION!,
  };
  if ((process.env.REAP_AUTH_STYLE || "bearer").toLowerCase() === "x-api-key") headers["X-API-Key"] = key;
  else headers.Authorization = `Bearer ${key}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method === "POST" && opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
  if (opts.simulate && process.env.REAP_SIMULATE_CHECKOUT) headers["X-Simulate-Checkout"] = process.env.REAP_SIMULATE_CHECKOUT;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctrl.signal, cache: "no-store", redirect: "error" });
  } catch (e) {
    throw new ReapError(504, ctrl.signal.aborted ? "REAP_TIMEOUT" : "REAP_NETWORK_ERROR", (e as Error).message);
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  let json: unknown = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  if (!res.ok) {
    const err = (json as ReapErrorBody | null)?.error;
    throw new ReapError(res.status, err?.code || `HTTP_${res.status}`, err?.message || text.slice(0, 300) || res.statusText);
  }
  return stripSensitive(json as T);
}

const live = {
  createEnrollment: (req: CreateEnrollmentRequest, idem: string = randomUUID()) => call<Enrollment>("POST", "/agentic/enrollments", req, { idempotencyKey: idem }),
  getEnrollment: (id: string) => call<Enrollment>("GET", `/agentic/enrollments/${encodeURIComponent(id)}`),
  searchProducts: (req: ProductSearchRequest) => call<ProductSearchResult>("POST", "/agentic/products/search", req),
  createQuote: (req: CreateQuoteRequest, idem: string = randomUUID()) => call<Quote>("POST", "/agentic/quotes", req, { idempotencyKey: idem }),
  getQuote: (id: string) => call<Quote>("GET", `/agentic/quotes/${encodeURIComponent(id)}`),
  createCheckout: (req: CreateCheckoutRequest, idem: string = randomUUID()) => call<Checkout>("POST", "/agentic/checkouts", req, { idempotencyKey: idem, simulate: true }),
  getCheckout: (id: string) => call<Checkout>("GET", `/agentic/checkouts/${encodeURIComponent(id)}`),
};

async function wrapMock<T>(p: Promise<T>): Promise<T> {
  try {
    return stripSensitive(await p);
  } catch (e) {
    const err = e as Error & { status?: number; code?: string };
    throw new ReapError(err.status ?? 500, err.code ?? "MOCK_ERROR", err.message);
  }
}

/** Facade used by API routes. */
export const reap = {
  mode: reapMode,
  async createEnrollment(req: CreateEnrollmentRequest, idem?: string) {
    return reapMode() === "live" ? live.createEnrollment(req, idem) : wrapMock(mockReap.createEnrollment(req));
  },
  async getEnrollment(id: string) {
    return reapMode() === "live" ? live.getEnrollment(id) : wrapMock(mockReap.getEnrollment(id));
  },
  async searchProducts(req: ProductSearchRequest) {
    return reapMode() === "live" ? live.searchProducts(req) : wrapMock(mockReap.searchProducts(req));
  },
  async createQuote(req: CreateQuoteRequest, idem?: string) {
    return reapMode() === "live" ? live.createQuote(req, idem) : wrapMock(mockReap.createQuote(req));
  },
  async getQuote(id: string) {
    if (reapMode() === "live") return live.getQuote(id);
    const q = await mockReap.getQuote(id);
    if (!q) throw new ReapError(404, "AGENTIC_RESOURCE_NOT_FOUND", "Quote not found (MOCK)");
    return q;
  },
  async createCheckout(req: CreateCheckoutRequest, idem?: string) {
    return reapMode() === "live" ? live.createCheckout(req, idem) : wrapMock(mockReap.createCheckout(req));
  },
  async getCheckout(id: string) {
    if (reapMode() === "live") return live.getCheckout(id);
    const c = await mockReap.getCheckout(id);
    if (!c) throw new ReapError(404, "AGENTIC_RESOURCE_NOT_FOUND", "Checkout not found (MOCK)");
    return c;
  },
};
