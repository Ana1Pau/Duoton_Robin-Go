# Preparación de REAP Agentic Payments

Estado: contrato preparado, simulación local publicada, sin credenciales, sin llamadas reales y sin servidor desplegado. `server/reap-client.mjs` es un cliente para el futuro backend; no es una API pública ni está servido desde `dist/`. `reap.html` muestra el estado y permite ensayar la secuencia. Los modos Empresa y Compras enlazan a esa página.

## Configuración pendiente

Copiar `.env.example` a un archivo de entorno local/secret manager del futuro servidor. No introducir secretos en chat, GitHub, `dist/` o sessionStorage.

- `REAP_ENABLED=false` hasta completar configuración y autorización de pruebas.
- `REAP_API_KEY`: clave de sandbox del proyecto.
- `REAP_VERSION`: valor vigente asignado/confirmado para el proyecto; sin valor inventado.
- `REAP_BASE_URL`: confirmar región. La guía usa `https://sandbox.api.reap.global`; la referencia API muestra `https://sg.sandbox.api.reap.global`. No elegir automáticamente.
- `REAP_RETURN_URL`: URL HTTPS de regreso; el ejemplo lleva a `reap.html?return=1`. Hoy muestra estado no verificado; no confirma pagos.
- `REAP_HOSTED_ORIGINS`: orígenes exactos de páginas alojadas confirmados por REAP.

También se requieren Agentic Payments habilitado, identidad del titular/owner, fuente de tarjeta y comercio/variante de sandbox disponibles. La compatibilidad de tarjeta y comercios debe confirmarse. No asumir habilitado `externalCheckout`: las guías y FAQ tienen distinta información de disponibilidad; se omite de este cliente inicial.

## Arquitectura siguiente

Navegador → backend propio autenticado → REAP sandbox. El backend debe verificar que enrollment/quote/checkout pertenecen al usuario y empresa, persistir claves de idempotencia por operación, guardar snapshots de aprobación, reservar presupuesto de forma atómica y guardar la relación entre recursos. El cliente preparado NO implementa esas capas. No exponerlo como proxy genérico ni activar solicitudes públicas solo por añadir una API key.

El catálogo y los cobros actuales siguen siendo fixtures. Al conectar, reemplazar el catálogo, las cotizaciones y los resultados por respuestas reales; nunca convertir silenciosamente un error API en una compra de demo exitosa.

## Flujo preparado

El cliente incluye enrollment, listado por owner, lectura de enrollment/mandate, búsqueda/detalle/variante, cotización, selección de envío, creación y lectura de checkout. Mantiene la idempotencia para las creaciones documentadas. No repite automáticamente solicitudes fallidas. Producción está bloqueada.

Las pantallas alojadas se abren mediante `nextAction`, y el servidor confirma después el recurso. `ACTIVE` habilita una tarjeta; `COMPLETED` habilita confirmar el pedido con su referencia y monto realmente cobrado. Quote usa expiración, no un estado inventado. `REQUIRES_ACTION`, `PROCESSING`, `FAILED` y `EXPIRED` tienen tratamientos distintos. Nuevos intentos fallidos/vencidos requieren nuevos recursos según la guía.

No construir UI para PAN/CVC. Los datos se ingresan en REAP; la app solo debe presentar metadatos enmascarados. La aprobación interna de presupuesto no sustituye el consentimiento alojado. Conservar la distinción entre enrollment y mandate; confirmar el contrato de creación de mandatos antes de automatizarlo.

La app guarda centavos. La conversión preparada cubre USD/EUR/MXN en dos decimales; otras monedas requieren configurar su precisión. Tomar el total final del proveedor, sin reconstruirlo sumando ejemplos de documentación.

## Prueba futura

Con acceso confirmado: configurar backend autenticado, registrar tarjeta en el host de REAP, leer ACTIVE, buscar variante, crear quote, seleccionar envío, revisar el total y crear checkout. Solo en sandbox puede enviarse `X-Simulate-Checkout: COMPLETED`. Leer el checkout al regresar. Validar también cotización vencida, total cambiado, tarjeta no activa y errores terminales. Las tarjetas publicadas por REAP son únicamente para su flujo Agentic Payments; no se copian a formularios propios ni se prueban fuera de ese entorno.

Transferencias bancarias, escalado real de nube, contabilización y cargos recurrentes quedan fuera de esta preparación. No se ha verificado una capacidad REAP para esas acciones a partir de este documento.

## Fuentes consultadas

- https://docs.reap.global/agentic-payments/overview
- https://docs.reap.global/agentic-payments/setup
- https://docs.reap.global/agentic-payments/one-time-purchases
- https://docs.reap.global/agentic-payments/lifecycle
- https://docs.reap.global/agentic-payments/faq
- https://docs.reap.global/api-reference/agentic/create-quote
- https://docs.reap.global/api-reference/agentic/create-checkout
- https://docs.reap.global/api-reference/versioning
