// Katerbot — API helpers: JSON responses + consistent error envelope.
import { NextResponse } from "next/server";
import { ReapError } from "./reap/client";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export function fail(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function handle(e: unknown) {
  if (e instanceof ReapError) return fail(e.status >= 400 ? e.status : 502, e.code, e.message);
  if (e instanceof ValidationError) return fail(400, "VALIDATION_ERROR", e.message);
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[katerbot]", msg);
  return fail(500, "INTERNAL_ERROR", msg);
}

export class ValidationError extends Error {}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ValidationError("Invalid JSON body");
  }
}

export function num(v: unknown, field: string, { min = 0, required = true } = {}): number {
  if (v === undefined || v === null || v === "") {
    if (required) throw new ValidationError(`${field} is required`);
    return NaN;
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n < min) throw new ValidationError(`${field} must be a number >= ${min}`);
  return n;
}

export function str(v: unknown, field: string, max = 120): string {
  if (typeof v !== "string" || !v.trim()) throw new ValidationError(`${field} is required`);
  return v.trim().slice(0, max);
}

export function dateStr(v: unknown, field: string, required = false): string | null {
  if (v === undefined || v === null || v === "") {
    if (required) throw new ValidationError(`${field} is required`);
    return null;
  }
  const s = String(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new ValidationError(`${field} must be YYYY-MM-DD`);
  return s;
}

export function appBaseUrl(req: Request) {
  return (process.env.APP_BASE_URL || new URL(req.url).origin).replace(/\/+$/, "");
}
