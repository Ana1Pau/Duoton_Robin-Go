// Katerbot — defense in depth: strip anything that looks like card data / OTP before
// a Reap payload is logged, stored, or sent to the browser.
const SENSITIVE_KEY = /(card.?number|^pan$|primary.?account|cvv|cvc|cvn|security.?code|otp|one.?time.?(pass|code)|pin$|expiry.?(month|year)|exp.?(month|year))/i;
const PAN_LIKE = /\b(?:\d[ -]?){13,19}\b/g;

export function stripSensitive<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripSensitive(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(k)) continue;
      out[k] = stripSensitive(v);
    }
    return out as T;
  }
  if (typeof value === "string") return value.replace(PAN_LIKE, "[redacted]") as unknown as T;
  return value;
}
