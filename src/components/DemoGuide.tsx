"use client";
// Katerbot — /demo: explains and runs the full agentic flow for hackathon judges.
import Link from "next/link";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useI18n, type Lang } from "@/lib/i18n";
import type { ReapOrder, ReplenishProposal } from "@/lib/types";

type L = Record<Lang, string>;
interface StepDef {
  id: string;
  title: L;
  body: L;
  endpoint: string;
  run: (s: DemoState) => Promise<{ data: unknown; patch?: Partial<DemoState> }>;
  needsConfirm?: boolean;
}
interface DemoState {
  proposal?: ReplenishProposal;
  orderId?: number;
}

const STEPS: StepDef[] = [
  {
    id: "reset",
    title: { es: "0. Datos demo", en: "0. Demo data" },
    body: { es: "Carga al usuario demo con leche, pan, huevos, pollo, arroz y fruta. Las fechas son relativas a hoy para que siempre haya alertas.", en: "Loads the demo user with milk, bread, eggs, chicken, rice and fruit. Dates are relative to today so alerts always show." },
    endpoint: "POST /api/demo/reset",
    run: async () => ({ data: await api("/api/demo/reset", { method: "POST" }), patch: { proposal: undefined, orderId: undefined } }),
  },
  {
    id: "add",
    title: { es: "1. Agregar alimento", en: "1. Add an item" },
    body: { es: "El usuario agrega un alimento manualmente. La API valida y verifica si la compra rebasa el presupuesto semanal.", en: "The user adds an item manually. The API validates it and checks whether the purchase exceeds the weekly budget." },
    endpoint: "POST /api/items",
    run: async () => {
      const d = new Date();
      const iso = (n: number) => new Date(d.getTime() + n * 86400000).toISOString().slice(0, 10);
      return { data: await api("/api/items", { method: "POST", json: { name: "Yogur", category: "Lácteos", quantity: 4, unit: "pz", purchase_date: iso(0), expiry_date: iso(6), price: 52, daily_consumption_estimate: 1 } }) };
    },
  },
  {
    id: "log",
    title: { es: "2. Registrar consumo", en: "2. Log consumption" },
    body: { es: "Se registra el consumo diario. Baja el stock y Katerbot re-aprende el consumo diario (promedio 7 días mezclado con la estimación).", en: "Daily consumption is logged. Stock goes down and Katerbot re-learns daily use (7-day average blended with the estimate)." },
    endpoint: "POST /api/consumption",
    run: async () => {
      const items = await api<{ items: { id: number; name: string }[] }>("/api/items");
      const milk = items.items.find((i) => i.name === "Leche") ?? items.items[0];
      return { data: await api("/api/consumption", { method: "POST", json: { cater_item_id: milk.id, quantity: 0.5, note: "desayuno" } }) };
    },
  },
  {
    id: "alerts",
    title: { es: "3. Ver alertas", en: "3. See alerts" },
    body: { es: "Reglas: caduca en ≤ 3 días, se agota en ≤ 3 días (cantidad ÷ consumo diario), o el gasto semanal supera el presupuesto.", en: "Rules: expires in ≤ 3 days, runs out in ≤ 3 days (quantity ÷ daily use), or weekly spend exceeds the budget." },
    endpoint: "GET /api/alerts",
    run: async () => ({ data: await api("/api/alerts") }),
  },
  {
    id: "agent",
    title: { es: "4. Propuesta del agente", en: "4. Agent proposal" },
    body: { es: "El agente prioriza (agotamiento > caducidad > historial), calcula cantidades para ~5 días, ajusta a empaques y marca como opcional lo que rebasa el presupuesto.", en: "The agent prioritizes (depletion > expiry > history), sizes quantities for ~5 days, rounds to packs and marks over-budget lines as optional." },
    endpoint: "POST /api/agent/replenish",
    run: async () => {
      const r = await api<{ proposal: ReplenishProposal }>("/api/agent/replenish", { method: "POST" });
      return { data: r.proposal, patch: { proposal: r.proposal } };
    },
  },
  {
    id: "confirm",
    title: { es: "5. El usuario confirma el resumen", en: "5. User confirms the summary" },
    body: { es: "Humano en el ciclo: nada se compra sin confirmar. Se crea un pedido DRAFT con las líneas dentro del presupuesto.", en: "Human in the loop: nothing is bought without confirmation. A DRAFT order is created with the in-budget lines." },
    endpoint: "POST /api/orders",
    needsConfirm: true,
    run: async (s) => {
      if (!s.proposal) throw new ApiError(0, "RUN_STEP_4", "Run step 4 first");
      const lines = s.proposal.lines.filter((l) => l.within_budget);
      const r = await api<{ order: ReapOrder }>("/api/orders", { method: "POST", json: { lines: lines.length ? lines : s.proposal.lines.slice(0, 1) } });
      return { data: r.order, patch: { orderId: r.order.id } };
    },
  },
  {
    id: "enroll",
    title: { es: "6. Reap: enrollment", en: "6. Reap: enrollment" },
    body: { es: "POST /agentic/enrollments (source EXTERNAL). La tarjeta se captura en la página segura de Reap; guardamos solo enrollment_id y estado.", en: "POST /agentic/enrollments (source EXTERNAL). The card is entered on Reap's hosted page; we store only enrollment_id and status." },
    endpoint: "POST /api/reap/enrollments → Reap POST /agentic/enrollments",
    run: async () => ({ data: await api("/api/reap/enrollments", { method: "POST" }) }),
  },
  {
    id: "search",
    title: { es: "7. Reap: búsqueda de productos", en: "7. Reap: product search" },
    body: { es: "POST /agentic/products/search por cada línea; el agente elige la variante disponible más barata.", en: "POST /agentic/products/search per line; the agent picks the cheapest available variant." },
    endpoint: "POST /api/orders/:id/search → Reap POST /agentic/products/search",
    run: async (s) => ({ data: await api(`/api/orders/${need(s)}/search`, { method: "POST" }) }),
  },
  {
    id: "quote",
    title: { es: "8. Reap: cotización", en: "8. Reap: quote" },
    body: { es: "POST /agentic/quotes devuelve el total final y expiresAt. Si expira, el checkout responde QUOTE_EXPIRED y se pide otra cotización.", en: "POST /agentic/quotes returns the final total and expiresAt. If it expires, checkout returns QUOTE_EXPIRED and a new quote is requested." },
    endpoint: "POST /api/orders/:id/quote → Reap POST /agentic/quotes",
    run: async (s) => ({ data: await api(`/api/orders/${need(s)}/quote`, { method: "POST" }) }),
  },
  {
    id: "checkout",
    title: { es: "9. Reap: checkout", en: "9. Reap: checkout" },
    body: { es: "POST /agentic/checkouts con Idempotency-Key determinista (sin doble cobro). En LIVE el usuario aprueba en nextAction.url; luego GET /agentic/checkouts/:id.", en: "POST /agentic/checkouts with a deterministic Idempotency-Key (no double charge). In LIVE the user approves at nextAction.url; then GET /agentic/checkouts/:id." },
    endpoint: "POST /api/orders/:id/checkout → Reap POST /agentic/checkouts",
    run: async (s) => {
      const r = await api<{ next_action_url: string | null }>(`/api/orders/${need(s)}/checkout`, { method: "POST" });
      if (r.next_action_url) return { data: { ...r, note: "LIVE: open next_action_url to approve, then return to /reap/return" } };
      return { data: await api(`/api/orders/${need(s)}/sync`, { method: "POST" }) };
    },
  },
  {
    id: "saved",
    title: { es: "10. reap_orders guardado (sin datos de tarjeta)", en: "10. reap_orders saved (no card data)" },
    body: { es: "El registro solo contiene IDs (enrollment, quote, checkout), referencia del pedido, estado y monto. Verificamos que no haya PAN/CVV/OTP.", en: "The record only holds IDs (enrollment, quote, checkout), order reference, status and amount. We verify there is no PAN/CVV/OTP." },
    endpoint: "GET /api/orders/:id",
    run: async (s) => {
      const r = await api<{ order: ReapOrder }>(`/api/orders/${need(s)}`);
      const raw = JSON.stringify(r.order);
      const leak = /(card.?number|cvv|cvc|otp)/i.test(raw) || /\b\d{13,19}\b/.test(raw);
      return { data: { ...r, card_data_check: leak ? "FAIL" : "PASS — no PAN / CVV / OTP stored" } };
    },
  },
];

function need(s: DemoState) {
  if (!s.orderId) throw new ApiError(0, "RUN_STEP_5", "Run step 5 first");
  return s.orderId;
}

export function DemoGuide() {
  const { lang, t } = useI18n();
  const [state, setState] = useState<DemoState>({});
  const [out, setOut] = useState<Record<string, { ok: boolean; data: unknown }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  async function run(step: StepDef) {
    setBusy(step.id);
    try {
      const r = await step.run(state);
      setState((s) => ({ ...s, ...r.patch }));
      setOut((o) => ({ ...o, [step.id]: { ok: true, data: r.data } }));
    } catch (e) {
      const err = e instanceof ApiError ? { code: e.code, message: e.message } : { message: String(e) };
      setOut((o) => ({ ...o, [step.id]: { ok: false, data: { error: err } } }));
    } finally {
      setBusy(null);
    }
  }

  const L = (x: L) => x[lang];

  return (
    <div className="space-y-5">
      <section className="card bg-gradient-to-br from-kater-50 to-white">
        <h1 className="text-2xl font-bold">Katerbot × Reap Agentic Payments</h1>
        <p className="mt-1 text-slate-700">
          {lang === "es"
            ? "Katerbot es un agente que administra el inventario y el gasto diario de comida: detecta lo que caduca o se agota, propone una reposición dentro del presupuesto y, con tu aprobación, compra mediante la API de Reap. Nunca toca datos de tarjeta."
            : "Katerbot is an agent that manages daily food inventory and spend: it detects what expires or runs out, proposes an in-budget restock and, with your approval, buys through the Reap API. It never touches card data."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/" className="btn-primary">{t("nav_pantry")} →</Link>
          <a href="#run" className="btn-ghost">{lang === "es" ? "Ejecutar demo guiada" : "Run guided demo"}</a>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 font-bold">{lang === "es" ? "Flujo completo" : "End-to-end flow"}</h2>
          <pre className="overflow-x-auto rounded-xl bg-slate-900 p-3 text-[11px] leading-5 text-kater-100">{`Usuario/User
  │ agrega alimento / logs usage
  ▼
Katerbot API (Next.js) ──► SQL Server 2025
  │  cater_items · consumption_logs · alerts · budget_settings
  ▼
Alert rules (≤3d expiry, ≤3d depletion, budget)
  ▼
Agent /api/agent/replenish  → proposal + reasons
  ▼
👤 confirm summary (human-in-the-loop)
  ▼
Reap  /agentic/enrollments   (hosted card page)
      /agentic/products/search
      /agentic/quotes          (expiresAt)
      /agentic/checkouts       (nextAction → approve)
  ▼
reap_orders: ids + status only (no PAN/CVV/OTP)
  ▼
Pantry restocked · alerts cleared`}</pre>
        </div>
        <div className="card space-y-2 text-sm">
          <h2 className="font-bold">{lang === "es" ? "Por qué importa" : "Why it matters"}</h2>
          <ul className="list-disc space-y-1 pl-5">
            {(lang === "es"
              ? [
                  "Pagos agénticos con control humano: el agente propone, el usuario aprueba el resumen y Reap aprueba el cobro.",
                  "Seguridad: la tarjeta se captura en la página de Reap; Katerbot guarda solo IDs y estado. Las respuestas pasan por un filtro que elimina PAN/CVV/OTP.",
                  "Idempotencia: cada creación lleva Idempotency-Key; el checkout usa una clave determinista por cotización para evitar cobros dobles.",
                  "Robustez: manejo de errores de Reap, estados de carga, botón Detener/Cancelar y expiración de cotización con nueva cotización.",
                  "Datos en SQL Server 2025: columna calculada de días para agotarse, vista de estado e (opcional) tabla VECTOR para aprender de pedidos pasados vía MCP.",
                  "Funciona sin internet en modo MOCK (claramente etiquetado) y en LIVE con REAP_API_KEY.",
                ]
              : [
                  "Agentic payments with human control: the agent proposes, the user approves the summary, Reap approves the charge.",
                  "Security: the card is captured on Reap's page; Katerbot stores only IDs and status. Responses pass a filter that strips PAN/CVV/OTP.",
                  "Idempotency: every create call sends an Idempotency-Key; checkout uses a deterministic per-quote key to prevent double charges.",
                  "Resilience: Reap error handling, loading states, Stop/Cancel and quote expiry with re-quote.",
                  "SQL Server 2025 data: computed days-to-depletion column, status view and (optional) VECTOR table to learn from past orders via MCP.",
                  "Works offline in MOCK mode (clearly labeled) and LIVE with REAP_API_KEY.",
                ]
            ).map((x) => <li key={x}>{x}</li>)}
          </ul>
        </div>
      </section>

      <section id="run" className="card">
        <h2 className="mb-1 font-bold">{lang === "es" ? "Demo guiada (llamadas reales a la API)" : "Guided demo (real API calls)"}</h2>
        <p className="mb-3 text-sm text-slate-600">
          {lang === "es" ? "Ejecuta cada paso en orden. Cada uno muestra la respuesta JSON de la API de Katerbot." : "Run each step in order. Each one shows the JSON response from the Katerbot API."}
        </p>
        <ol className="space-y-3">
          {STEPS.map((s) => {
            const o = out[s.id];
            const blocked = s.needsConfirm && !confirmed;
            return (
              <li key={s.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{L(s.title)}</h3>
                    <p className="text-sm text-slate-600">{L(s.body)}</p>
                    <code className="mt-1 block break-all text-[11px] text-slate-500">{s.endpoint}</code>
                  </div>
                  <button className="btn-primary" onClick={() => run(s)} disabled={busy !== null || blocked}>
                    {busy === s.id ? t("working") : lang === "es" ? "Ejecutar" : "Run"}
                  </button>
                </div>
                {s.needsConfirm && state.proposal && (
                  <div className="mt-2 rounded-lg bg-slate-50 p-2 text-sm">
                    <p className="mb-1 font-medium">{t("summary_title")}</p>
                    <ul className="list-disc pl-5 text-xs">
                      {state.proposal.lines.filter((l) => l.within_budget).map((l) => (
                        <li key={l.cater_item_id}>{l.name}: +{l.proposed_quantity} {l.unit} · ≈ {l.estimated_cost.toFixed(2)} {state.proposal!.currency}</li>
                      ))}
                    </ul>
                    <label className="mt-2 flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="accent-kater-600" />
                      {lang === "es" ? "Confirmo este resumen de compra" : "I confirm this purchase summary"}
                    </label>
                  </div>
                )}
                {o && (
                  <pre className={`mt-2 max-h-64 overflow-auto rounded-lg p-2 text-[11px] ${o.ok ? "bg-slate-900 text-kater-100" : "bg-red-50 text-red-800"}`}>
                    {JSON.stringify(o.data, null, 2)}
                  </pre>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="card text-sm">
        <h2 className="mb-2 font-bold">{lang === "es" ? "Modo MOCK vs LIVE" : "MOCK vs LIVE mode"}</h2>
        <p>
          {lang === "es"
            ? "Sin REAP_API_KEY, Katerbot usa un backend simulado de Reap (IDs con prefijo mock_, insignia MOCK en la interfaz). Con la llave, llama a REAP_BASE_URL con Authorization: Bearer, Reap-Version e Idempotency-Key. En sandbox puedes poner REAP_SIMULATE_CHECKOUT=COMPLETED."
            : "Without REAP_API_KEY Katerbot uses a simulated Reap backend (mock_ prefixed IDs, MOCK badge in the UI). With the key it calls REAP_BASE_URL with Authorization: Bearer, Reap-Version and Idempotency-Key. In sandbox you can set REAP_SIMULATE_CHECKOUT=COMPLETED."}
        </p>
      </section>
    </div>
  );
}
