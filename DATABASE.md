# Registro de gastos local

Abre `expenses.html` desde Empresa o Compras. Registra gastos ya realizados, edita sus datos, filtra por ámbito y mes, y exporta los resultados a CSV. Los totales se muestran separados por moneda; no se calculan tipos de cambio.

Los datos se guardan en IndexedDB del navegador y permanecen entre sesiones. No hay servidor de base de datos, sincronización entre dispositivos ni verificación de pagos. Borrar los datos del sitio elimina los registros. Exporta los gastos antes de hacerlo. El CSV permite consultar o recuperar manualmente los datos; esta versión no incluye importación automática. Las compras y pagos simulados continúan separados de este registro.

## Repositorio de referencia

Se revisó https://github.com/fjacinto/caterbot/tree/db en el commit 918d2fe. Su README describe SQL Server, inventario, consumo y presupuestos, pero la rama no contiene los archivos `sql/` ni `src/lib/db/` que documenta. No se ha conectado SQL Server ni copiado archivos de credenciales del repositorio.

Para compartir gastos entre usuarios, el siguiente paso requiere un backend autenticado, esquema SQL, autorización por empresa y una instancia disponible. Las credenciales deben permanecer en el servidor. La integración REAP continúa en modo preparación; registrar un gasto no ejecuta ni confirma un cobro.
