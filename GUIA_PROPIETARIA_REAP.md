# Guía para la propietaria: coordinar REAP

[Volver al README](README.md)

## Qué pedir a REAP

- Acceso a Agentic Payments sandbox y credenciales con los permisos necesarios.
- Host/región y versión de API correspondientes a tu proyecto.
- Fuentes de tarjeta y flujo de enrollment disponibles.
- Datos de prueba autorizados y escenarios de aprobación, fallo y vencimiento.
- Comercios y productos disponibles para pruebas.
- Requisitos de URL HTTPS de retorno y orígenes de páginas alojadas.

Solicita confirmación de las capacidades contratadas: la demo empresarial no demuestra que REAP permita transferencias internacionales, escalado de nube o contabilización automática.

## Qué entregar al desarrollador

Comparte las respuestas de REAP y las credenciales mediante un canal seguro. Nunca pegues claves en el README, GitHub ni el navegador. El desarrollador configura el servidor y mantiene los pagos desactivados hasta acordar la prueba.

## Cómo revisar la primera prueba

1. Elige con el desarrollador un producto disponible en sandbox.
2. Revisa moneda, producto, envío y total antes de aprobar.
3. Completa el flujo alojado de prueba indicado por REAP.
4. Comprueba que Robin Go consulta el resultado y muestra el monto final confirmado.
5. Revisa que el pedido y el pago se registran una sola vez.
6. Repite con cancelación, fallo o vencimiento según los escenarios disponibles.

No uses tarjetas reales ni actives producción para estas pruebas.

## Qué puedes avanzar sin sandbox

El desarrollador puede crear la base, gastos, presupuestos y permisos sin acceso REAP. El LLM también se elige y configura por separado. Sandbox hace falta para probar la integración de pagos, no para construir toda la aplicación.

## Costos y autorizaciones

Esta entrega no contrata servicios ni activa consumo de IA. Antes de activar un proveedor, acuerda con el desarrollador límites de uso, costos y quién autoriza cada operación.
