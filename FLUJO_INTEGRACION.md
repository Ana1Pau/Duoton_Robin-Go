# Flujo de comunicación previsto

[Volver al README](README.md)

```mermaid
flowchart TD
    U[Cliente / usuario] <-->|Instrucciones y respuestas| APP[App Robin Go]
    APP <--> API[Servidor autenticado de Robin Go]
    API <--> AG[Agente Robin]
    AG <--> LLM[LLM: interpreta y propone]
    API <-->|Consulta y guarda datos autorizados| DB[(Base de datos)]
    API <-->|Cotizaciones y checkout| REAP[REAP]
    REAP <--> M[Mercader según integración]
    U -->|Autoriza en página alojada| REAP
```

1. El usuario expresa su intención.
2. El agente utiliza el LLM para entenderla y preguntar lo que falte.
3. El servidor consulta los datos permitidos y valida presupuesto y políticas.
4. La integración obtiene opciones y prepara una propuesta para revisión.
5. El usuario autoriza el cargo en el flujo alojado de REAP.
6. El servidor consulta el estado confirmado y registra resultado, importe y referencias.

El LLM no accede directamente a las credenciales ni confirma pagos. La redirección no prueba que una compra se completó. El intercambio REAP–mercader depende del contrato y capacidades de la integración elegida.

Este diagrama describe el destino de la integración. Hoy los datos son locales al navegador, los pagos son simulados y el LLM está pendiente de activación.
