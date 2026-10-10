# Katerbot 🧺🤖

**Agentic Payments hackathon × Reap.** Katerbot es un agente que administra el inventario y el gasto diario de comida, detecta productos próximos a caducar o agotarse, propone una reposición dentro del presupuesto y — con la aprobación del usuario — compra mediante la **API de Reap Agentic Payments**.

*Katerbot is an agent that manages daily food inventory and spend, detects items about to expire or run out, proposes an in-budget restock and — with user approval — purchases through the Reap Agentic Payments API.*

- UI responsive, bilingüe **ES / EN** (toggle en el header).
- Next.js 15 (App Router) + TypeScript + Tailwind, backend propio en `/api/*`.
- **SQL Server 2025** (Developer/Enterprise) — scripts T-SQL en `sql/`.
- Reap **LIVE** con `REAP_API_KEY`, o **MOCK** (offline, etiquetado en la UI) sin llave.
- Nunca se guarda ni se muestra número de tarjeta, CVV ni OTP.

---

## 1. Estructura

```
katerbot/
├── sql/
│   ├── 001_schema.sql              # tablas: users, cater_items, consumption_logs, alerts, budget_settings, reap_orders (+ vista)
│   ├── 002_seed_demo.sql           # usuario demo + leche, pan, huevos, pollo, arroz, fruta (fechas relativas a hoy)
│   └── 003_ai_learning_optional.sql# OPCIONAL: tabla VECTOR(1536) + SP de similitud para MCP/IA (SQL Server 2025)
├── src/
│   ├── app/
│   │   ├── page.tsx                # Despensa (dashboard)
│   │   ├── demo/page.tsx           # Página para jueces: explicación + demo guiada con llamadas reales
│   │   ├── reap/return/page.tsx    # return URL de las páginas hospedadas de Reap
│   │   └── api/…                   # backend (ver §5)
│   ├── components/                 # Dashboard, PurchaseFlow (resumen + flujo Reap), DemoGuide, Header
│   └── lib/
│       ├── calc.ts                 # agotamiento, alertas, gasto semanal, aprendizaje del consumo diario
│       ├── agent.ts                # agente de reposición (reglas, sin LLM)
│       ├── orders.ts               # ciclo de vida del pedido + reabastecer inventario
│       ├── reap/client.ts          # cliente Reap (LIVE/MOCK) + headers
│       ├── reap/mock.ts            # backend Reap simulado
│       ├── reap/sanitize.ts        # elimina PAN/CVV/OTP de cualquier payload
│       ├── reap/types.ts           # shapes de request/response (documentados)
│       └── db/                     # repo SQL Server (mssql) + repo offline (JSON)
└── .env.example
```

## 2. Requisitos

- Node.js 20+
- (Opcional) SQL Server 2025 Developer/Enterprise (o 2019/2022 para 001/002; 003 requiere 2025 por `VECTOR`)
- (Opcional) Llave de sandbox de Reap con Agentic Payments habilitado

## 3. Configuración

```bash
cd katerbot
cp .env.example .env.local
npm install
```

### Variables de entorno

| Variable | Descripción |
|---|---|
| `SQLSERVER_CONNECTION_STRING` | Cadena ADO.NET. Vacía ⇒ modo offline con `data/dev-store.json`. |
| `REAP_BASE_URL` | p. ej. `https://mx.sandbox.api.reap.global` o `https://sandbox.api.reap.global` |
| `REAP_API_KEY` | Llave de Reap. Vacía ⇒ **MOCK**. Nunca la subas al repo. |
| `REAP_VERSION` | Header `Reap-Version` (default `2025-02-14`). |
| `REAP_AUTH_STYLE` | `bearer` (default, `Authorization: Bearer <key>`, según docs de Reap) o `x-api-key`. |
| `REAP_SIMULATE_CHECKOUT` | Solo sandbox: `COMPLETED` envía `X-Simulate-Checkout`. Vacío en producción. |
| `REAP_COUNTRY` / `REAP_CURRENCY` | Contexto de búsqueda (default `MX` / `MXN`). |
| `REAP_SHIPPING_ADDRESS_JSON` | (Opcional) JSON con `shippingAddress` si el comercio exige envío. |
| `APP_BASE_URL` | URL pública de la app para los `returnUrl` de Reap (default: origen de la petición). |
| `MOCK_QUOTE_TTL_SECONDS` | Vida de la cotización en MOCK (default 180 s) — pon `20` para demostrar expiración. |

### SQL Server 2025

```bash
# Docker (Linux):
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=<StrongPwd!>" -p 1433:1433 -d mcr.microsoft.com/mssql/server:2025-latest

sqlcmd -S localhost,1433 -U sa -P '<StrongPwd!>' -C -i sql/001_schema.sql
sqlcmd -S localhost,1433 -U sa -P '<StrongPwd!>' -C -i sql/002_seed_demo.sql
# opcional (IA/MCP):
sqlcmd -S localhost,1433 -U sa -P '<StrongPwd!>' -C -i sql/003_ai_learning_optional.sql
```

`.env.local`:

```
SQLSERVER_CONNECTION_STRING=Server=localhost,1433;Database=Katerbot;User Id=sa;Password=<StrongPwd!>;Encrypt=true;TrustServerCertificate=true
```

> Recomendado: crea un login de aplicación con permisos solo de `db_datareader`/`db_datawriter` en lugar de `sa`.

## 4. Ejecutar

```bash
npm run dev          # http://localhost:3000
# producción
npm run build && npm start
```

Sin SQL Server ni llave de Reap todo funciona en modo offline + MOCK (las insignias del header lo indican).

## 5. API

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/status` | Modo BD (sqlserver/memory), modo Reap (live/mock), presupuesto y gasto semanal |
| GET/POST | `/api/items` | Inventario con `days_to_depletion`, `estimated_depletion_date`, `days_to_expiry` / alta manual (+ `budget_check`) |
| GET/PUT/DELETE | `/api/items/:id` | CRUD de un alimento |
| GET/POST | `/api/consumption` | Logs / registrar consumo (resta stock, re-aprende consumo diario, recalcula alertas) |
| DELETE | `/api/consumption/:id` | Borrar log |
| GET | `/api/alerts` | Recalcula y devuelve alertas abiertas |
| PATCH | `/api/alerts/:id` | Resolver alerta |
| GET/PUT | `/api/budget` | Presupuesto semanal, moneda, días de alerta |
| POST | `/api/agent/replenish` | **Agente**: propuesta (productos, cantidades, motivos, presupuesto). No compra. |
| GET/POST | `/api/orders` | Historial `reap_orders` / crear pedido DRAFT tras confirmar el resumen |
| GET | `/api/orders/:id` | Detalle |
| POST | `/api/reap/enrollments` · GET | Reap `POST /agentic/enrollments` (reusa si ya está ACTIVE) · refrescar estado |
| POST | `/api/orders/:id/search` | Reap `POST /agentic/products/search` por línea; elige la variante más barata disponible |
| POST | `/api/orders/:id/quote` | Reap `POST /agentic/quotes` (también re-cotiza tras expirar) |
| POST | `/api/orders/:id/checkout` | Reap `POST /agentic/checkouts` (valida expiración y enrollment ACTIVE) |
| POST | `/api/orders/:id/sync` | Reap `GET /agentic/checkouts/:id` tras volver de la aprobación |
| POST | `/api/orders/:id/cancel` | Cancelar antes de pagar |
| POST | `/api/demo/reset` | Recargar datos demo |

Errores: `{ "error": { "code": "QUOTE_EXPIRED", "message": "…" } }` con el status HTTP correspondiente.

### Reglas

- **Agotamiento**: `days_to_depletion = quantity / daily_consumption_estimate` (columna calculada en SQL y en `calc.ts`).
- **Alertas**: caduca en ≤ 3 días · se agota en ≤ 3 días · gasto semanal (compras de 7 días + pedidos Reap completados) > presupuesto. Al agregar un alimento se devuelve `budget_check` (¿esta compra rebasa el presupuesto?). Los días son configurables (`budget_settings.alert_days`).
- **Aprendizaje del consumo**: cada log mezcla 50/50 la estimación actual con el promedio observado en 7 días.
- **Agente** (`katerbot-rules-v1`): prioriza agotamiento > caducidad > historial de compras; dimensiona para ~5 días (el stock que caduca se considera inutilizable); redondea a empaques (huevo ×12, pan ×6); marca como *opcional* lo que no cabe en el presupuesto restante; da motivos ES/EN.

## 6. Integración con Reap

Basado en la documentación pública (docs.reap.global, `Reap-Version: 2025-02-14`):

Headers en cada llamada LIVE:
- `Authorization: Bearer <REAP_API_KEY>` (o `X-API-Key` si `REAP_AUTH_STYLE=x-api-key`)
- `Reap-Version: 2025-02-14`
- `Idempotency-Key: <uuid>` en todos los `POST` que crean (enrollment, quote, checkout). Checkout usa la clave determinista `katerbot-checkout-<orderId>-<quoteId>` ⇒ un reintento nunca cobra dos veces.
- `X-Simulate-Checkout: COMPLETED` solo si `REAP_SIMULATE_CHECKOUT` está definido (sandbox).

| Paso | Request enviado | Campos usados de la respuesta |
|---|---|---|
| `POST /agentic/enrollments` | `{ source: "EXTERNAL", owner: { type: "CLIENT_REFERENCE", reference }, email, presentation: { type: "REDIRECT", returnUrl } }` | `id`, `status` (`REQUIRES_ACTION`/`ACTIVE`/…), `nextAction.url` |
| `GET /agentic/enrollments/:id` | — | `status` |
| `POST /agentic/products/search` | `{ query, context: { country, currency }, filters: { availability: "AVAILABLE_ONLY" }, pagination: { limit: 5 } }` | `products[].id`, `merchant.name`, `previewVariant.{id, price, available}` |
| `POST /agentic/quotes` | `{ items: [{ variantId, quantity }], email, shippingAddress? }` | `id`, `amountBreakdown.{itemsSubtotal, shipping, tax, finalAmount}`, `expiresAt` |
| `POST /agentic/checkouts` | `{ quoteId, enrollmentId, presentation: { type: "REDIRECT", returnUrl } }` | `id`, `status`, `nextAction.url`, `amount` |
| `GET /agentic/checkouts/:id` | — | `status`, `orderId`, `finalAmount` |

**Supuestos (verificar en tu sandbox):**
1. Para `source: "EXTERNAL"` los nombres exactos del owner (`owner.type = "CLIENT_REFERENCE"`, `owner.reference`) y `email` se infirieron de la guía “How it works”; la referencia de API documenta en detalle `REAP_CARD`. Si tu proyecto usa Reap cards, cambia el body en `src/app/api/reap/enrollments/route.ts` a `{ source: "REAP_CARD", cardId, presentation }`.
2. La respuesta de enrollment expone la URL hospedada de captura de tarjeta en `nextAction.url` (igual que checkout).
3. Se usa directamente `previewVariant` de la búsqueda como variante comprable (se omiten `/products/details` y `/products/variant`; válido para productos sin opciones).
4. La opción de envío preseleccionada en la cotización se acepta tal cual (no se llama `/quotes/:id/shipping-option`).
5. Errores con forma `{ error: { code, message, detail } }`.
6. El precio estimado del agente usa el precio histórico del inventario; el monto real es siempre `finalAmount` de Reap (eso es lo que se guarda).

### Seguridad de datos de pago

- La tarjeta se captura **solo** en la página hospedada de Reap.
- `reap_orders` y `users` no tienen columnas para PAN, CVV ni OTP; solo `enrollment_id`, `quote_id`, `checkout_id`, `order_reference`, `status`, monto y moneda.
- `src/lib/reap/sanitize.ts` elimina claves sensibles (`cardNumber`, `cvv`, `otp`, …) y cadenas tipo PAN de cualquier respuesta antes de guardarla o enviarla al navegador.
- El paso 10 de `/demo` verifica que el registro guardado no contenga datos de tarjeta.

## 7. Guion de demo (3–4 min)

1. Abre **`/demo`** → explica el flujo con el diagrama. Muestra las insignias **Reap MOCK/LIVE** y **BD**.
2. Paso 0 *Datos demo* → leche, pan, huevos, pollo, arroz, fruta.
3. Paso 1 *Agregar alimento* (Yogur) → muestra `days_to_depletion` y `budget_check`.
4. Paso 2 *Registrar consumo* de leche → baja stock y re-aprende el consumo diario.
5. Paso 3 *Alertas* → Leche/Pollo caducan, Pan/Pollo se agotan.
6. Paso 4 *Propuesta del agente* → cantidades, motivos y qué queda fuera del presupuesto (Pollo opcional).
7. Paso 5 → marca “Confirmo este resumen” (humano en el ciclo) → pedido DRAFT.
8. Pasos 6–9 → Reap enrollment → search → quote (total + `expiresAt`) → checkout.
9. Paso 10 → `reap_orders` guardado con IDs y estado: **PASS — no PAN / CVV / OTP**.
10. Ve a **Despensa**: inventario reabastecido, alertas actualizadas, pedido en el historial. Repite desde la UI con “Generar propuesta → Revisar resumen → Confirmar y cotizar → Aprobar y pagar”, y muestra **Cancelar** y la **expiración** (arranca con `MOCK_QUOTE_TTL_SECONDS=20`).

## 8. IA / MCP (opcional)

El agente de la demo es determinista (reglas) para que funcione offline. Para aprender de pedidos anteriores con IA:
1. Ejecuta `sql/003_ai_learning_optional.sql` (tabla `order_learning` con `VECTOR(1536)`, vista `v_order_history`, SP `usp_similar_orders` con `VECTOR_DISTANCE`).
2. Genera embeddings (SQL Server 2025 `AI_GENERATE_EMBEDDINGS` con `CREATE EXTERNAL MODEL`, o desde la app).
3. Expón la vista/SP mediante un servidor MCP de SQL Server para que un LLM los consulte como herramienta y complemente `buildProposal()` en `src/lib/agent.ts`.

## 9. Limitaciones conocidas

- Un solo usuario demo (sin autenticación) — fuera del alcance del hackathon.
- El modo offline guarda en `data/dev-store.json` (ignorado por git).
- El repo SQL Server se compiló y tipó pero no se probó contra una instancia real en este entorno; el flujo completo se probó end-to-end en modo offline + MOCK.
