# Robin Go

Robin es el agente de Robin Go para Empresa, Compras y Día a día. REAP es el proveedor de pagos previsto.

## Documentación

| Archivo | Para quién / contenido |
|---|---|
| [Guía del desarrollador](GUIA_DESARROLLADOR.md) | Arquitectura, ejecución local y trabajo pendiente |
| [Guía para la propietaria](GUIA_PROPIETARIA_REAP.md) | Qué solicitar a REAP y cómo coordinar las pruebas |
| [Integración REAP](REAP_INTEGRATION.md) | Configuración, límites y flujo preparado |
| [Cliente REAP del servidor](server/reap-client.mjs) | Código del adaptador; no es una API desplegada |
| [Configuración de ejemplo](.env.example) | Variables sin credenciales |
| [Chat de Robin](ROBIN_CHAT.md) | Servidor local, historial y activación posterior del LLM |
| [Base de datos](DATABASE.md) | Guardado actual y conexión compartida pendiente |
| [Flujo de comunicación](FLUJO_INTEGRACION.md) | Diagrama de la arquitectura prevista |

## Estado real

- La interfaz y la demo guiada están implementadas, con tema oscuro uniforme y textos en español.
- El acceso «Ajustar y revisar en Empresa» abre directamente el panel del plan.
- Incluye el código actualizado y las guías separadas en un mismo paquete.
- Los gastos manuales se guardan en IndexedDB de cada navegador.
- Chat con IA tiene conexión preparada, desactivada por defecto.
- No hay base SQL compartida ni pagos REAP reales conectados.
- El servidor local incluido no tiene autenticación para uso público y no debe exponerse a Internet.

## Ejecutar localmente

Requiere Node.js 20.6 o superior. Desde esta carpeta:

```sh
npm run start:local
```

Abre http://127.0.0.1:4173. No requiere instalar dependencias. Para comprobar la lógica:

```sh
npm test
```

## Subir a GitHub

Descomprime el paquete y sube su contenido al repositorio. Conserva `.gitignore` y `.env.example`. No subas `.env`, claves ni datos de tarjetas. Esta copia no incluye credenciales ni la configuración de despliegue del sitio existente.
