"use client";
// Katerbot — minimal ES/EN i18n (toggle stored in localStorage).
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "es" | "en";

const dict = {
  tagline: { es: "Tu despensa con agente: inventario, gasto y compras con Reap", en: "Your agentic pantry: inventory, spend and purchases with Reap" },
  nav_pantry: { es: "Despensa", en: "Pantry" },
  nav_demo: { es: "Demo para jueces", en: "Judges demo" },
  mock_badge: { es: "Reap MOCK (sin API key)", en: "Reap MOCK (no API key)" },
  live_badge: { es: "Reap LIVE", en: "Reap LIVE" },
  db_memory: { es: "BD: almacén local (sin SQL Server)", en: "DB: local store (no SQL Server)" },
  db_sql: { es: "BD: SQL Server 2025", en: "DB: SQL Server 2025" },
  loading: { es: "Cargando…", en: "Loading…" },
  retry: { es: "Reintentar", en: "Retry" },
  budget: { es: "Presupuesto semanal", en: "Weekly budget" },
  spent: { es: "Gastado (7 días)", en: "Spent (7 days)" },
  remaining: { es: "Disponible", en: "Remaining" },
  save: { es: "Guardar", en: "Save" },
  cancel: { es: "Cancelar", en: "Cancel" },
  alerts: { es: "Alertas", en: "Alerts" },
  no_alerts: { es: "Sin alertas. ¡Todo en orden!", en: "No alerts. All good!" },
  inventory: { es: "Inventario", en: "Inventory" },
  add_item: { es: "Agregar alimento", en: "Add food item" },
  name: { es: "Nombre", en: "Name" },
  category: { es: "Categoría", en: "Category" },
  quantity: { es: "Cantidad", en: "Quantity" },
  unit: { es: "Unidad", en: "Unit" },
  purchase_date: { es: "Fecha de compra", en: "Purchase date" },
  expiry_date: { es: "Caducidad", en: "Expiry date" },
  price: { es: "Precio", en: "Price" },
  daily: { es: "Consumo diario estimado", en: "Estimated daily use" },
  depletes: { es: "Se agota", en: "Runs out" },
  expires: { es: "Caduca", en: "Expires" },
  days: { es: "días", en: "days" },
  in_days: { es: "en {n} d", en: "in {n} d" },
  log_use: { es: "Registrar consumo", en: "Log usage" },
  log: { es: "Registrar", en: "Log" },
  delete: { es: "Eliminar", en: "Delete" },
  confirm_delete: { es: "¿Eliminar este alimento?", en: "Delete this item?" },
  agent: { es: "Agente Katerbot", en: "Katerbot agent" },
  agent_desc: { es: "Analiza caducidad, agotamiento, presupuesto e historial y propone una reposición. No compra nada sin tu confirmación.", en: "Analyzes expiry, depletion, budget and history to propose a restock. Never buys without your confirmation." },
  run_agent: { es: "Generar propuesta", en: "Generate proposal" },
  proposal: { es: "Propuesta de reposición", en: "Restock proposal" },
  est_cost: { es: "Costo estimado", en: "Estimated cost" },
  optional: { es: "Opcional (fuera de presupuesto)", en: "Optional (over budget)" },
  review_summary: { es: "Revisar resumen", en: "Review summary" },
  summary_title: { es: "Resumen antes de comprar", en: "Summary before purchase" },
  summary_note: { es: "Katerbot buscará estos productos con Reap, pedirá una cotización y te mostrará el total final. El cobro solo ocurre cuando apruebes el pago.", en: "Katerbot will search these products with Reap, request a quote and show you the final total. You are only charged after you approve the payment." },
  over_budget_warn: { es: "Esta compra haría que tu gasto semanal supere el presupuesto.", en: "This purchase would push your weekly spend over budget." },
  confirm_and_quote: { es: "Confirmar y cotizar con Reap", en: "Confirm & quote with Reap" },
  step_enroll: { es: "Tarjeta (enrollment)", en: "Card (enrollment)" },
  step_search: { es: "Buscar productos", en: "Search products" },
  step_quote: { es: "Cotización", en: "Quote" },
  step_checkout: { es: "Pago", en: "Checkout" },
  enroll_needed: { es: "Abre la página segura de Reap para registrar tu tarjeta. Katerbot nunca ve ni guarda número, CVV ni OTP.", en: "Open Reap's secure page to enroll your card. Katerbot never sees or stores card number, CVV or OTP." },
  open_reap: { es: "Abrir página segura de Reap", en: "Open Reap secure page" },
  check_status: { es: "Ya terminé, verificar", en: "I'm done, check status" },
  quote_ready: { es: "Cotización lista", en: "Quote ready" },
  subtotal: { es: "Subtotal", en: "Subtotal" },
  shipping: { es: "Envío", en: "Shipping" },
  tax: { es: "Impuestos", en: "Tax" },
  total: { es: "Total final", en: "Final total" },
  expires_in: { es: "Expira en", en: "Expires in" },
  quote_expired: { es: "La cotización expiró. Pide una nueva antes de pagar.", en: "The quote expired. Request a new one before paying." },
  requote: { es: "Nueva cotización", en: "New quote" },
  pay: { es: "Aprobar y pagar con Reap", en: "Approve & pay with Reap" },
  cancel_order: { es: "Cancelar compra", en: "Cancel purchase" },
  cancelled: { es: "Compra cancelada. No se hizo ningún cargo.", en: "Purchase cancelled. Nothing was charged." },
  redirecting: { es: "Redirigiendo a Reap para aprobar el pago…", en: "Redirecting to Reap to approve the payment…" },
  completed: { es: "¡Compra completada! Inventario actualizado.", en: "Purchase completed! Inventory updated." },
  order_ref: { es: "Referencia de pedido", en: "Order reference" },
  orders: { es: "Pedidos con Reap", en: "Reap orders" },
  no_orders: { es: "Aún no hay pedidos.", en: "No orders yet." },
  status: { es: "Estado", en: "Status" },
  reset_demo: { es: "Restablecer datos demo", en: "Reset demo data" },
  merchant: { es: "Comercio", en: "Merchant" },
  nothing_selected: { es: "Selecciona al menos un producto.", en: "Select at least one product." },
  privacy: { es: "Solo guardamos IDs de enrollment, cotización y checkout, la referencia del pedido y su estado.", en: "We only store enrollment, quote and checkout IDs, the order reference and its status." },
  close: { es: "Cerrar", en: "Close" },
  working: { es: "Procesando…", en: "Working…" },
  stop: { es: "Detener", en: "Stop" },
  item_added: { es: "Alimento agregado.", en: "Item added." },
  item_over_budget: { es: "Ojo: con esta compra superas tu presupuesto semanal.", en: "Heads-up: this purchase puts you over your weekly budget." },
  return_title: { es: "Regresando de Reap", en: "Back from Reap" },
  back_home: { es: "Volver a la despensa", en: "Back to pantry" },
} as const;

export type Key = keyof typeof dict;

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");
  useEffect(() => {
    const saved = typeof window !== "undefined" ? (localStorage.getItem("katerbot.lang") as Lang | null) : null;
    if (saved === "es" || saved === "en") setLangState(saved);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("katerbot.lang", l);
  }, []);
  const t = useCallback(
    (k: Key, vars?: Record<string, string | number>) => {
      let s: string = dict[k]?.[lang] ?? String(k);
      if (vars) for (const [n, v] of Object.entries(vars)) s = s.replace(`{${n}}`, String(v));
      return s;
    },
    [lang]
  );
  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const c = useContext(I18nContext);
  if (!c) throw new Error("useI18n outside I18nProvider");
  return c;
}
