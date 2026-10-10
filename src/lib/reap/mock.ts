// Katerbot — MOCK Reap backend. Used when REAP_API_KEY is empty so the demo works offline.
// Every id is prefixed with "mock_" and every response carries mock: true.
import type { Checkout, CreateCheckoutRequest, CreateEnrollmentRequest, CreateQuoteRequest, Enrollment, ProductSearchRequest, ProductSearchResult, Quote } from "./types";

const CURRENCY = process.env.REAP_CURRENCY || "MXN";
const QUOTE_TTL_MS = Number(process.env.MOCK_QUOTE_TTL_SECONDS || 180) * 1000;

const CATALOG: { key: RegExp; name: string; price: number; unit: string }[] = [
  { key: /lech|milk/i, name: "Leche entera 1 L", price: 29, unit: "L" },
  { key: /pan|bread/i, name: "Pan de caja integral (680 g)", price: 48, unit: "pz" },
  { key: /huev|egg/i, name: "Huevo blanco 12 pz", price: 72, unit: "pz" },
  { key: /poll|chick/i, name: "Pechuga de pollo 1 kg", price: 145, unit: "kg" },
  { key: /arroz|rice/i, name: "Arroz súper extra 1 kg", price: 31, unit: "kg" },
  { key: /frut|fruit|manzan|pl[aá]tan/i, name: "Fruta de temporada 1 kg", price: 30, unit: "kg" },
];

// Kept on globalThis so all Next.js route bundles share one mock backend.
type MockState = {
  enrollments: Map<string, Enrollment>;
  quotes: Map<string, Quote & { lines: { variantId: string; quantity: number; unit: number }[] }>;
  checkouts: Map<string, Checkout>;
  variantPrice: Map<string, number>;
};
const g = globalThis as unknown as { __katerbotMockReap?: MockState };
const state: MockState = (g.__katerbotMockReap ??= { enrollments: new Map(), quotes: new Map(), checkouts: new Map(), variantPrice: new Map() });
const { enrollments, quotes, checkouts, variantPrice } = state;

const rid = (p: string) => `mock_${p}_${Math.random().toString(36).slice(2, 10)}`;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const mockReap = {
  async createEnrollment(_req: CreateEnrollmentRequest): Promise<Enrollment> {
    // In live mode the user would type the card on Reap's hosted page. In MOCK it is ACTIVE immediately.
    const e: Enrollment = { id: rid("enr"), status: "ACTIVE", source: "EXTERNAL", nextAction: null };
    enrollments.set(e.id, e);
    return e;
  },
  async getEnrollment(id: string): Promise<Enrollment> {
    return enrollments.get(id) ?? { id, status: id.startsWith("mock_") ? "ACTIVE" : "FAILED", nextAction: null };
  },
  async searchProducts(req: ProductSearchRequest): Promise<ProductSearchResult> {
    const hit = CATALOG.find((c) => c.key.test(req.query));
    const base = hit ?? { name: `${req.query} (genérico)`, price: 50, unit: "pz" };
    const products = [0, 1].map((k) => {
      const price = Math.round(base.price * (k === 0 ? 1 : 1.12));
      const vid = `mock_var_${slug(base.name)}_${k}`;
      variantPrice.set(vid, price);
      return {
        id: `mock_prod_${slug(base.name)}_${k}`,
        merchant: { name: k === 0 ? "Súper Demo (MOCK)" : "Mercado Express (MOCK)" },
        name: base.name,
        priceRange: { min: { amount: price, currency: CURRENCY }, max: { amount: price, currency: CURRENCY } },
        available: true,
        previewVariant: { id: vid, name: base.name, price: { amount: price, currency: CURRENCY }, available: true },
      };
    });
    return { id: rid("search"), products, pagination: { nextCursor: null, hasNextPage: false, returnedCount: products.length }, warnings: ["MOCK catalog"] };
  },
  async createQuote(req: CreateQuoteRequest): Promise<Quote> {
    const lines = req.items.map((i) => ({ ...i, unit: variantPrice.get(i.variantId) ?? 50 }));
    const subtotal = lines.reduce((s, l) => s + l.unit * l.quantity, 0);
    const shipping = 39;
    const q: Quote & { lines: typeof lines } = {
      id: rid("qt"),
      lines,
      shippingOptions: [{ id: "mock_ship_std", name: "Estándar (MOCK)", selected: true, price: { amount: shipping, currency: CURRENCY } }],
      amountBreakdown: {
        itemsSubtotal: { amount: subtotal, currency: CURRENCY },
        shipping: { amount: shipping, currency: CURRENCY },
        tax: { amount: { amount: 0, currency: CURRENCY }, includedInPrices: true },
        discounts: [],
        additionalCharges: [],
        finalAmount: { amount: subtotal + shipping, currency: CURRENCY },
      },
      expiresAt: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
    };
    quotes.set(q.id, q);
    const { lines: _l, ...pub } = q;
    return pub;
  },
  async getQuote(id: string): Promise<Quote | null> {
    const q = quotes.get(id);
    if (!q) return null;
    const { lines: _l, ...pub } = q;
    return pub;
  },
  async createCheckout(req: CreateCheckoutRequest): Promise<Checkout> {
    const q = quotes.get(req.quoteId);
    if (!q) throw Object.assign(new Error("Quote not found"), { status: 404, code: "AGENTIC_RESOURCE_NOT_FOUND" });
    if (new Date(q.expiresAt).getTime() < Date.now()) throw Object.assign(new Error("Quote expired"), { status: 409, code: "QUOTE_EXPIRED" });
    // MOCK: approval is instant; the charge completes without a redirect.
    const c: Checkout = {
      id: rid("chk"),
      status: "COMPLETED",
      quoteId: q.id,
      enrollmentId: req.enrollmentId,
      amount: q.amountBreakdown.finalAmount,
      finalAmount: q.amountBreakdown.finalAmount,
      orderId: `MOCK-ORD-${Date.now().toString().slice(-6)}`,
      nextAction: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    checkouts.set(c.id, c);
    return c;
  },
  async getCheckout(id: string): Promise<Checkout | null> {
    return checkouts.get(id) ?? null;
  },
};
