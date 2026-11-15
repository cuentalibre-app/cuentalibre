---
title: "Facturas emitidas"
label: "Facturas"
description: "Crea, emite, envía y cobra tus facturas, y corrígelas con una factura rectificativa."
section: guide
order: 2
---

Las facturas que emites a tus clientes están en **Ventas › Facturas emitidas**. Cuentan para el IVA y el IRPF del trimestre de su fecha.

## Crear y emitir una factura

1. Pulsa **Nueva factura** en **Ventas › Facturas emitidas**, o **Crear › Factura emitida**.
2. Elige el **Cliente**. Si aún no lo tienes, créalo desde el mismo desplegable con **Nuevo cliente**.
3. Revisa la **Fecha** y, si quieres, el **Vencimiento**, con los plazos rápidos o una fecha concreta.
4. Añade los **Conceptos**: descripción, cantidad, precio e IVA de cada uno. Para traer un producto del catálogo, búscalo desde el concepto. **Mostrar edición avanzada** deja poner un descuento, el recargo de equivalencia, una descripción detallada o el periodo en el que prestaste el servicio.
5. Si el cliente te retiene IRPF (una empresa o un autónomo que te contrata como profesional), elige la **Retención**.
6. Pulsa **Crear factura**: la factura queda emitida.

Al emitirla, la factura recibe el siguiente número de su serie y ya cuenta para tus impuestos. El número lo pone cuentalibre: las facturas de cada serie van numeradas de forma correlativa y en orden de fecha, así que no puedes emitir una factura con fecha anterior a la última de su serie.

En **Más formas de crear**, junto al botón, puedes emitirla y enviarla por email en un paso (**Crear y enviar**), o crearla y quedarte en ella (**Crear e ir a la pantalla de editar**).

Si ya la has cobrado, marca **Marcar factura como cobrada** antes de crearla, con la fecha y el método de cobro.

### Opciones avanzadas

En **Opciones avanzadas** están los casos menos habituales:

- **Tipo de operación:** nacional (lo normal), nacional exenta o no sujeta, inversión del sujeto pasivo, intracomunitaria o exportación. Decide cómo se trata el IVA y en qué casillas de los modelos 303, 349 y 390 aparece. Si el cliente es de otro país, se propone según su ficha.
- **Fecha de operación:** solo si es distinta de la fecha de la factura.
- **Factura emitida en criterio de caja:** solo si estás acogido a ese régimen especial de IVA.
- **Operación de arrendamiento de inmuebles:** si alquilas un local o una vivienda, con su situación y referencia catastral.

En **Notas** puedes añadir un texto que se imprime en la factura (y guardarlo como nota predefinida para reutilizarlo) y unas notas privadas que solo ves tú.

## Borradores

Un borrador es una factura sin número: puedes cambiarlo cuanto quieras y no cuenta en tus impuestos. Están en **Ventas › Borradores**, donde creas uno con **Nueva factura borrador** y lo guardas con **Crear factura borrador**.

Cuando esté listo, ábrelo y pulsa **Emitir factura**, o usa **Emitir factura** en el menú de acciones del listado. Si su fecha es anterior a la última factura de la serie, cámbiala antes de emitirlo.

## Enviar, descargar y otras acciones

Cada fila del listado tiene sus acciones a mano, y el resto en el menú **Más acciones** (los tres puntos):

- **Descargar PDF** o verlo en otra pestaña.
- **Enviar factura:** se envía por email con el PDF adjunto, a nombre de tu negocio. Puedes elegir una plantilla de texto, añadir destinatarios y ver los envíos anteriores. Para enviar desde cuentalibre necesitas tener tu email verificado.
- **Exportar Facturae:** la factura electrónica en formato Facturae, la que piden las administraciones públicas. Si al cliente le faltan datos, se te dice cuáles.
- **Gestionar el cobro**, **Adjuntar documentos** y **Gestionar etiquetas**.
- **Crear por copia:** una factura nueva con los mismos datos.

Para descargar varias a la vez, el listado tiene un botón que baja todos los PDF del periodo filtrado en un .zip.

## Registrar los cobros

Con **Gestionar el cobro** apuntas lo que te ha pagado el cliente: todo o una parte, con su fecha y su método de cobro. El estado de la factura sigue a sus cobros: **Pendiente**, **Cobro parcial**, **Cobrada** o **Vencida** si ha pasado el vencimiento sin cobrarse del todo. Los cobros aparecen también en **Bancos**.

Para corregir un cobro, quítalo y regístralo de nuevo.

## Corregir o borrar una factura emitida

Mientras su trimestre esté abierto, puedes abrir la factura (**Ver los datos de la factura**), cambiarla y pulsar **Guardar cambios**. Lo que no cambia es su número ni su serie, y la fecha no puede salir de su año ni quedar fuera de orden en la serie.

También puedes eliminarla si es la última de su serie y no tiene rectificativas; su número queda libre para la siguiente.

Cuando cierras el trimestre, sus facturas quedan bloqueadas: solo puedes cambiar sus cobros, etiquetas, adjuntos y notas privadas. Para corregir otra cosa, emite una factura rectificativa (o reabre el trimestre en **Cierre de trimestres**, si aún no has presentado sus impuestos).

## Rectificar una factura

Una factura rectificativa corrige otra ya emitida: un error, una devolución, un descuento posterior.

1. En el listado, abre **Más acciones** de la factura y elige **Generar factura rectificativa**.
2. Se crea una factura nueva en la serie rectificativa, con las cantidades de la original en negativo.
3. Elige el **Tipo de rectificación**: **Por diferencias** (solo lo que cambia, por ejemplo una devolución parcial) o **Por sustitución** (anula la original y la sustituye entera).
4. Elige el **Motivo** y ajusta los conceptos: para una corrección parcial, deja solo lo que se resta.
5. Pulsa **Crear factura**.

Una factura puede tener varias rectificativas, pero entre todas no pueden dejarla por debajo de cero: como mucho rectificas lo que queda. Si el cliente te devuelve el dinero, apúntalo como un cobro negativo.

Para deshacer una rectificativa, abre **Generar factura rectificativa** desde la propia rectificativa: se crea otra sobre la factura original, con las cantidades al revés.

## Series de numeración

Cada serie numera sus facturas por separado, empezando cada año en 1. Hay series normales y series rectificativas. Las gestionas en **Configuración › Facturas › Configurar series**: puedes crear otra serie, elegir cuál se usa por defecto o desactivar una.

La **máscara** decide el aspecto del número: `AAAA` es el año con cuatro cifras, `AA` con dos y `####` el contador, con tantas cifras como almohadillas. Por ejemplo, `F-AA-###` numera F-26-001, F-26-002… La máscara no se puede cambiar una vez la serie tiene facturas o borradores.

## El aspecto de tus facturas

En **Configuración › Facturas** eliges la plantilla del PDF, la fuente y los colores, subes tu logotipo y escribes el pie fijo que llevan todas las facturas (por ejemplo, los datos del Registro Mercantil). También decides si se muestran las unidades, la forma de pago o las fechas de prestación del servicio.

El idioma y el formato de los números de cada factura siguen los de la ficha del cliente.
