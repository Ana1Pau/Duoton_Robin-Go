// Demo seed used by the offline memory store. Mirrors sql/002_seed_demo.sql.
import type { CaterItem } from "../types";
import { addDaysISO, todayISO } from "../dates";

export function demoItems(userId: number, today = todayISO()): Omit<CaterItem, "id">[] {
  const d = (n: number) => addDaysISO(today, n);
  return [
    { user_id: userId, name: "Leche", category: "Lácteos", quantity: 2, unit: "L", purchase_date: d(-3), expiry_date: d(2), price: 58, daily_consumption_estimate: 0.5 },
    { user_id: userId, name: "Pan", category: "Panadería", quantity: 6, unit: "pz", purchase_date: d(-2), expiry_date: d(4), price: 48, daily_consumption_estimate: 3 },
    { user_id: userId, name: "Huevos", category: "Proteína", quantity: 12, unit: "pz", purchase_date: d(-4), expiry_date: d(14), price: 72, daily_consumption_estimate: 2 },
    { user_id: userId, name: "Pollo", category: "Proteína", quantity: 1, unit: "kg", purchase_date: d(-1), expiry_date: d(1), price: 145, daily_consumption_estimate: 0.4 },
    { user_id: userId, name: "Arroz", category: "Granos", quantity: 2, unit: "kg", purchase_date: d(-5), expiry_date: d(180), price: 62, daily_consumption_estimate: 0.15 },
    { user_id: userId, name: "Fruta", category: "Frutas", quantity: 3, unit: "kg", purchase_date: d(-2), expiry_date: d(5), price: 90, daily_consumption_estimate: 0.5 },
  ];
}

export const DEMO_EMAIL = "demo@katerbot.app";
