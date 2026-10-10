# Guía para el desarrollador

[Volver al README](README.md)

## Componentes existentes

- `dist/`: interfaz estática. `index.html` es el inicio unificado, `company.html` el espacio empresarial, `shopping.html` las compras, `expenses.html` los gastos y `reap.html` la preparación de pagos.
- `server/local-server.mjs`: sirve la app local y los endpoints del chat. Escucha únicamente en 127.0.0.1.
- `server/agent-chat.mjs`: adaptador preparado para Ollama, con historial limitado y acciones permitidas que solo abren pantallas.
- `server/reap-client.mjs`: cliente REAP de sandbox desactivado. Todavía no está conectado a endpoints propios.
- `tests/`: pruebas de lógica, contratos y respuestas simuladas; no validan una integración real con REAP ni un modelo real.

## Orden de integración

1. Elegir el motor de base de datos local y crear el esquema.
2. Implementar autenticación y autorización por empresa en el backend.
3. Crear endpoints para gastos, presupuestos, proveedores, propuestas, pedidos y pagos. Sustituir el guardado exclusivo en navegador donde corresponda.
4. Conectar el proveedor LLM elegido. La preparación incluida usa Ollama; otro proveedor requiere adaptar el cliente del servidor.
5. Dar al agente herramientas limitadas para consultar datos autorizados y preparar propuestas. El LLM no es la autoridad sobre presupuesto ni resultado del pago.
6. Configurar REAP sandbox según [REAP_INTEGRATION.md](REAP_INTEGRATION.md).
7. Conectar cotizaciones, envío y checkout; verificar el resultado desde el servidor después del retorno.
8. Probar errores, expiración, reintentos e idempotencia antes de considerar producción.

## Base de datos: entidades propuestas, todavía no implementadas

Empresas; usuarios y pertenencia a empresas; presupuestos; proveedores; gastos; propuestas y aprobaciones; referencias de enrollment; cotizaciones; checkouts; pedidos; claves de idempotencia; conciliaciones y auditoría.

Guardar importes con moneda y precisión definida. Relacionar cada recurso con su empresa/usuario. Las reservas y el consumo de presupuesto deben ser transaccionales para evitar sobreasignaciones. No almacenar PAN/CVC ni considerar pagada una operación únicamente por haber recibido la redirección.

## ¿Se necesita sandbox para crear la base?

No. El esquema, CRUD, permisos y pruebas iniciales pueden hacerse con datos ficticios. Sandbox es necesario después para probar enrollment, cotizaciones, checkouts y estados reales de prueba. Las credenciales pertenecen al servidor; la base almacena referencias y resultados, no datos completos de tarjeta.

## Criterios de entrega

- Un usuario no puede leer ni modificar datos de otra empresa.
- Una operación repetida no crea pagos ni registros duplicados.
- Una cotización vencida o modificada requiere nueva revisión.
- Un error REAP no se transforma en éxito de demo.
- Un retorno del checkout provoca una consulta de estado; no confirma por sí solo el cargo.
- El modelo no puede ejecutar comandos arbitrarios ni eludir aprobaciones.
- Documentar instalación, migraciones, respaldos y restauración de la base local.

El código actual solo prepara estos componentes; no cumple todavía los criterios de una integración de producción.
