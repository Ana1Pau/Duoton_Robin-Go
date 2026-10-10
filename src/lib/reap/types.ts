// Katerbot — Reap Agentic Payments API shapes (subset used by the app).
// Based on https://docs.reap.global (Reap-Version 2025-02-14). Fields we don't use are omitted.
// ASSUMPTIONS are marked with "ASSUMED" — verify against your Reap sandbox.

export interface Money {
  amount: number;
  currency: string;
}

export type ReapEnrollmentStatus = "REQUIRES_ACTION" | "ACTIVE" | "FAILED" | "EXPIRED" | "REVOKED";

/** POST /agentic/enrollments — EXTERNAL source: user types the card on a Reap-hosted page. */
export interface CreateEnrollmentRequest {
  source: "EXTERNAL" | "REAP_CARD" | "BIN_SPONSOR";
  cardId?: string; // REAP_CARD / BIN_SPONSOR
  // ASSUMED field names for EXTERNAL owner: CLIENT_REFERENCE owner + email
  owner?: { type: "CLIENT_REFERENCE"; reference: string };
  email?: string;
  presentation: { type: "REDIRECT"; returnUrl: string };
}

export interface Enrollment {
  id: string;
  status: ReapEnrollmentStatus;
  source?: string;
  nextAction?: { type: "REDIRECT"; url: string; expiresAt?: string } | null; // ASSUMED: hosted card-entry URL
}

/** POST /agentic/products/search */
export interface ProductSearchRequest {
  query: string;
  merchantPreference?: { mode: "PREFER" | "ONLY"; merchantName: string };
  context?: { country?: string; currency?: string };
  filters?: { price?: { min?: string; max?: string }; availability?: "AVAILABLE_ONLY" };
  pagination?: { cursor?: string | null; limit?: number };
}

export interface ProductSearchResult {
  id: string;
  products: {
    id: string;
    merchant: { name: string };
    name: string;
    imageUrl?: string;
    priceRange: { min: Money; max: Money };
    available?: boolean;
    previewVariant?: { id: string; name?: string; price: Money; available?: boolean };
  }[];
  pagination: { nextCursor: string | null; hasNextPage: boolean; returnedCount: number };
  warnings: string[];
}

/** POST /agentic/quotes */
export interface CreateQuoteRequest {
  items: { variantId: string; quantity: number }[];
  email?: string;
  offerCode?: string;
  shippingAddress?: {
    firstName: string;
    lastName: string;
    phone: string;
    addressLine1: string;
    city: string;
    postalCode: string;
    country: string;
  };
}

export interface Quote {
  id: string;
  shippingOptions?: { id: string; name: string; selected: boolean; price: Money }[];
  amountBreakdown: {
    itemsSubtotal: Money;
    shipping?: Money;
    tax?: { amount: Money; includedInPrices: boolean };
    discounts?: unknown[];
    additionalCharges?: unknown[];
    finalAmount: Money;
  };
  expiresAt: string;
}

/** POST /agentic/checkouts */
export interface CreateCheckoutRequest {
  quoteId: string;
  enrollmentId: string;
  presentation: { type: "REDIRECT"; returnUrl: string };
}

export type CheckoutStatus = "REQUIRES_ACTION" | "PROCESSING" | "COMPLETED" | "FAILED" | "EXPIRED";

export interface Checkout {
  id: string;
  status: CheckoutStatus;
  quoteId: string;
  enrollmentId: string;
  amount?: Money;
  finalAmount?: Money;
  orderId?: string | null;
  nextAction?: { type: "REDIRECT"; url: string; expiresAt?: string } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReapErrorBody {
  error: { code: string; message: string; detail?: unknown };
}
