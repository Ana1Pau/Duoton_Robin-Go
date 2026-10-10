"use client";
// Return URL for Reap hosted pages (card enrollment / payment approval).
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, money } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { ReapOrder } from "@/lib/types";

function ReturnInner() {
  const { t } = useI18n();
  const sp = useSearchParams();
  const [msg, setMsg] = useState<string>("");
  const [order, setOrder] = useState<ReapOrder | null>(null);

  useEffect(() => {
    const orderId = sp.get("order");
    const type = sp.get("type");
    (async () => {
      try {
        if (orderId) {
          const r = await api<{ order: ReapOrder }>(`/api/orders/${orderId}/sync`, { method: "POST" });
          setOrder(r.order);
        } else if (type === "enrollment") {
          const r = await api<{ enrollment: { status: string } | null }>("/api/reap/enrollments");
          setMsg(`Enrollment: ${r.enrollment?.status ?? "—"}`);
        }
      } catch (e) {
        setMsg(String((e as Error).message));
      }
    })();
  }, [sp]);

  return (
    <div className="card mx-auto max-w-lg space-y-3">
      <h1 className="text-lg font-bold">{t("return_title")}</h1>
      {!order && !msg && <p className="text-slate-500">{t("loading")}</p>}
      {msg && <p>{msg}</p>}
      {order && (
        <div className="space-y-1 text-sm">
          <p>{t("status")}: <b>{order.status}</b></p>
          {order.status === "COMPLETED" && <p className="text-kater-700">✅ {t("completed")}</p>}
          <p>{t("order_ref")}: <code>{order.order_reference ?? "—"}</code></p>
          <p>{t("total")}: {money(order.total_amount, order.currency ?? "MXN")}</p>
        </div>
      )}
      <Link className="btn-primary" href="/">{t("back_home")}</Link>
    </div>
  );
}

export default function ReapReturnPage() {
  return (
    <Suspense>
      <ReturnInner />
    </Suspense>
  );
}
