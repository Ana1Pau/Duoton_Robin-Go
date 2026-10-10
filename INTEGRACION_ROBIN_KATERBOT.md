# Integración Robin Go / Katerbot

## Qué se encontró

El ZIP sí contiene `sql/` y `src/lib/db/`; a diferencia de la rama GitHub revisada anteriormente. Es una aplicación Next.js para despensa, consumo, alertas, presupuesto semanal y pedidos REAP. La base existente está organizada por usuario demo, no por empresa.

## Qué cambió

- `public/robin/`: copia de la interfaz actual, tema oscuro y español.
- `src/lib/robin/store.mjs`: gastos y estados demo con almacenamiento JSON o consultas SQL parametrizadas.
- `sql/004_robin_go.sql`: tablas nuevas `robin_expenses` y `robin_demo_workspaces`. No borra datos.
- `src/app/api/robin/`: APIs del nuevo frontend.
- `src/middleware.ts`: restringe las APIs a uso local, sin abrir acceso público.
- REAP requiere habilitación explícita y revisión del adaptador; el simple hecho de tener una clave ya no activa llamadas.
- `.env.local` del ZIP no se copió ni se leyó. No se incluyeron datos de ejecución ni claves.

## Contrato implementado

| Método y ruta | Función |
|---|---|
| GET `/api/robin/status` | Configuración de IA y modo de guardado; no verifica la disponibilidad de SQL |
| GET `/api/robin/expenses` | Lista de gastos del usuario demo |
| POST `/api/robin/expenses` | Crea o edita un gasto por UUID; no procesa pagos |
| GET `/api/robin/workspace/company` | Estado de demostración de Empresa |
| GET `/api/robin/workspace/shopping` | Estado de demostración de Compras |
| PUT `/api/robin/workspace/:scope` | Guarda `{revision,state}`; responde 409 si la revisión ya cambió |
| POST `/api/robin/chat` | Conversación con LLM si está configurado; no ejecuta acciones |

Un gasto contiene `id`, `scope` (company o shopping), `title`, `merchant`, `category`, `date`, `currency`, `amountMinor` y `reference`. El servidor obliga a `source:manual` y `paymentVerified:false`. No recibe números de tarjeta.

Los estados demo son JSON con presupuesto, propuestas y resultados simulados. **No son la fuente de autoridad para pagos reales**: siguen calculados por la lógica local existente. Las revisiones detectan sobrescrituras entre pestañas, pero no convierten este prototipo en una aplicación multiusuario.

## Mapa de datos

| Función de Robin Go | Persistencia de este paquete |
|---|---|
| Día a día y gastos empresariales manuales | `robin_expenses` |
| Presupuestos, propuestas, reservas y conciliación simulados | `robin_demo_workspaces`, contexto company |
| Carrito y pedido simulado de compras | `robin_demo_workspaces`, contexto shopping |
| Despensa y reposición | Tablas originales de Katerbot |
| Pedidos del adaptador REAP original | `reap_orders`, separado de compras simuladas de Robin |
| Historial conversacional del chat | Memoria de la página; no se guarda en SQL |

## Qué falta para pagos y empresas reales

1. Normalizar empresas, membresías, roles, proveedores y presupuestos por área/moneda.
2. Trasladar al servidor creación de propuestas, aprobación, reserva y conciliación, con transacciones y auditoría. No confiar en los JSON del navegador para autorizar pagos.
3. Unificar pedidos de Robin con `reap_orders`. Hoy permanecen separados; no se duplica un pedido demo como pago real.
4. Auditar el adaptador REAP original contra la documentación vigente. Revisar particularmente el cuerpo de enrollment, variante de producto, envío, cotización y montos finales; no se da por compatible por contener endpoints con el mismo nombre.
5. Persistir claves de idempotencia por operación, confirmar estado mediante REAP después del retorno y separar sandbox/producción.
6. Conectar las herramientas del agente para consultar solo datos autorizados. El chat actual no recibe el presupuesto ni los registros SQL.
7. Agregar inicio de sesión y autorización por empresa antes de exponer el backend fuera de localhost.

## Validación que debe hacer el desarrollador

- `npm ci`, `npm run typecheck`, `npm run build`, `npm run test:robin`.
- Arrancar sin SQL; registrar un gasto, editarlo y reiniciar: debe conservarse.
- Configurar una base nueva de prueba; ejecutar migraciones y repetir con SQL.
- Abrir dos pestañas de Compras; guardar cambios desde ambas y comprobar el conflicto 409 en la segunda.
- Interrumpir SQL: mostrar error de guardado y no fingir persistencia ni cambiar a JSON.
- Confirmar que no hay llamadas a REAP o al LLM con la configuración predeterminada.
- Probar sandbox solo después de revisar el contrato y recibir credenciales autorizadas.

No hace falta sandbox para crear ni probar tablas, gastos o estados demo. Sí hace falta para verificar enrollment, cotización y checkout de REAP de extremo a extremo.
