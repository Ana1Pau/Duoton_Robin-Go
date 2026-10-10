# Robin: conversación con IA

## Estado

La interfaz ya incluye chat, historial por contexto, nueva conversación, estado de conexión y manejo de errores. El servidor local sirve la app y expone `GET /api/agent/status` y `POST /api/agent/chat`. No hay proveedor activo por defecto. El sitio publicado continúa siendo estático: no ejecuta el servidor Node ni puede acceder a un modelo de tu computadora.

El adaptador preparado utiliza la API local de Ollama: https://docs.ollama.com/api/chat. No se instaló Ollama ni se descargó un modelo. No se hicieron llamadas a modelos reales ni APIs de pago. Elegir una API de otro proveedor requerirá adaptar `server/agent-chat.mjs` a su contrato.

## Ejecutar sin modelo

Requiere Node.js 20.6 o superior. Desde la carpeta del proyecto:

```sh
npm run start:local
```

Abre http://127.0.0.1:4173. La demo guiada funciona; Chat con IA indica que falta conexión. No necesitas `npm install`: el servidor usa módulos nativos de Node.

## Activar después de elegir Ollama

1. Instala Ollama y descarga un modelo compatible con salida JSON estructurada, adecuado a la memoria de tu computadora. El nombre no se elige ni descarga automáticamente.
2. Copia `.env.example` a `.env` (archivo ignorado por Git).
3. Configura únicamente en el servidor:

```dotenv
ROBIN_AI_ENABLED=true
ROBIN_AI_PROVIDER=ollama
ROBIN_AI_MODEL=nombre-exacto-del-modelo-instalado
ROBIN_AI_BASE_URL=http://127.0.0.1:11434
```

4. Con Ollama iniciado, ejecuta:

```sh
node --env-file=.env server/local-server.mjs
```

5. Abre la app local, selecciona Chat con IA y prueba: «Necesito organizar los gastos del equipo, ¿qué información necesitas?». Sigue con «Somos cinco personas y gastamos en transporte y software». Robin recibe el historial reciente del contexto activo.

## Contrato

```json
{"mode":"company","messages":[{"role":"user","content":"Ayúdame a organizar mis gastos"}]}
```

Respuesta: `reply` (texto plano), `action` (identificador permitido), `href` (ruta fija) y `executed:false`. Las acciones solo ofrecen enlaces a pantallas existentes. No se pasan claves al navegador. El historial vive en memoria de la página y se borra al recargar. Se envían hasta 12 mensajes por solicitud, máximo 2,000 caracteres cada uno; las respuestas guardadas en historial se recortan a ese límite.

## Límites

Comprender una instrucción no equivale a ejecutar una compra. El modelo no recibe la base de datos, no conoce saldos reales y no realiza pagos. Para consultar datos reales faltan herramientas del agente con permisos por empresa y una base autenticada. Para ejecutar acciones faltan propuestas persistentes, validación de presupuesto y aprobación en el servidor.

El servidor está restringido a 127.0.0.1, con validación de origen/host, una solicitud simultánea, límite de tamaño y tiempo de respuesta. No es un servidor público: antes de desplegarlo deben añadirse autenticación, autorización por empresa, límites por usuario y la configuración del proveedor. Para probar en celular o conectar el sitio publicado se necesita una etapa adicional de conectividad segura; este servidor no expone tu computadora a Internet.
