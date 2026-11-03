---
title: "Conectar un agente"
description: "Deja que un asistente de IA o una automatización lea y escriba tu contabilidad con la API de cuentalibre, sin perder el control."
section: integrations
order: 1
---

Un agente de IA puede llevar parte del trabajo por ti: registrar los gastos de un ticket, preparar las facturas del mes, decirte qué clientes te deben dinero o cuánto IVA llevas este trimestre. Lo hace con la [API de cuentalibre](/docs/api), la misma que usa la aplicación, así que sigue sus mismas reglas.

Sirve cualquier agente que sepa hacer peticiones HTTP: asistentes de terminal como Claude Code o Codex, asistentes con acciones como los GPT de ChatGPT, o automatizaciones como n8n, Make o Zapier.

## 1. Crea una clave para el agente

En la aplicación, ve a **Configuración › API y agentes** y crea una clave solo para este agente, con un nombre que lo identifique («Claude Code», «n8n gastos»…). Si es para una prueba, ponle caducidad.

La clave empieza por `fsk_` y solo se muestra una vez: cópiala en ese momento.

- **Actúa como tú** en la empresa que tienes activa al crearla: puede leer y cambiar todo lo que tú puedes. Si llevas varias empresas, crea una clave en cada una.
- **Una clave por agente.** Si una se filtra o el agente hace algo que no esperabas, revocas solo esa y el resto sigue funcionando.
- **No la pegues en el chat.** Pásasela al agente como variable de entorno (`CUENTALIBRE_API_KEY`) o en el gestor de secretos de la herramienta.

## 2. Dale la documentación

El agente necesita saber qué rutas hay y qué forma tienen los datos. Tienes dos formatos:

- **[`https://cuentalibre.es/docs/api.md`](/docs/api.md)**: toda la referencia de la API en un solo archivo Markdown, pensado para que un agente lo lea de una vez.
- **`https://api.cuentalibre.es/v1/openapi.json`**: la descripción OpenAPI 3.1. Muchas herramientas la importan y convierten cada ruta en una acción del agente.

Si usas cuentalibre en tu propio servidor, cambia `api.cuentalibre.es` por la dirección de tu API.

## 3. Ponle reglas

Un agente sin reglas puede emitir una factura que no querías o borrar un gasto. Dale unas instrucciones como estas y adáptalas:

```text
Usa la API de cuentalibre (https://api.cuentalibre.es/v1) con la cabecera
"Authorization: Bearer $CUENTALIBRE_API_KEY". La referencia está en
https://cuentalibre.es/docs/api.md.

- Antes de emitir una factura (POST /v1/invoices), de borrar algo o de cambiar
  una factura emitida, enséñame lo que vas a hacer y espera mi confirmación.
- Los precios de las líneas van en euros; los importes de pagos y gastos, en
  céntimos (12100 son 121,00 €).
- Los tipos de IVA, de recargo y los descuentos van en fracción: 0.21 es el 21 %.
- Al crear un registro, genera tú el id (un UUID), para poder repetir la petición
  sin duplicarlo.
- Si la API responde con un error, lee "error.code" y explícamelo; no lo
  intentes esquivar.
```

## Según la herramienta

### Agentes de terminal

Claude Code, Codex y similares hacen peticiones con `curl` o con código. Guarda la clave en el entorno y pon las reglas en el archivo de instrucciones del proyecto (`CLAUDE.md`, `AGENTS.md`…):

```sh
export CUENTALIBRE_API_KEY="fsk_…"
```

### Asistentes con acciones

En un GPT de ChatGPT o en otra herramienta que importe OpenAPI, añade una acción a partir de `https://api.cuentalibre.es/v1/openapi.json` y configura la autenticación como **Bearer** con tu clave. Pega las reglas en las instrucciones del asistente.

### Automatizaciones

En n8n, Make o Zapier, usa el paso de petición HTTP con la cabecera `Authorization: Bearer fsk_…`. Por ejemplo, para registrar como gasto cada ticket que llegue a una carpeta: sube el archivo con `POST /v1/files` y crea el gasto con `POST /v1/expenses`, adjuntándolo en `attachments`.

## Ideas para empezar

- **Gastos a partir de tickets:** el agente lee la foto o el PDF, sube el archivo y crea el gasto con su importe, su fecha y su cuenta (`629`, `6291`, `6422`…).
- **Facturas del mes:** prepara como borradores las facturas de tus clientes habituales y te las enseña antes de emitirlas.
- **Cobros pendientes:** lista las facturas en `pending` con su vencimiento y redacta los recordatorios.
- **Repaso del trimestre:** suma ingresos, gastos e IVA de un trimestre a partir de los documentos, para que llegues al cierre sin sorpresas.

## Qué puede salir mal y cómo evitarlo

- **Operaciones que no se deshacen.** Una factura emitida toma su número de la serie, y con el trimestre cerrado solo se puede [rectificar](/docs/api/ventas#rectificar-una-factura). Haz que el agente te pida confirmación antes de emitir.
- **Trimestres cerrados.** La API no deja cambiar nada de un trimestre cerrado (`409 quarter_closed`), aunque el agente lo intente.
- **Revisa lo que hace.** Los cambios del agente aparecen en la aplicación al momento. Échales un vistazo las primeras veces.
- **Revoca la clave** en Configuración › API y agentes en cuanto dejes de usar el agente.

Todavía no hay un servidor MCP de cuentalibre. Cuando lo haya, lo explicaremos aquí; mientras tanto, la API y su documento OpenAPI sirven para cualquier agente.
