---
title: "Pantallas de la aplicación"
label: "Pantallas"
description: "Qué hay en cada pantalla de cuentalibre: sus secciones, campos, botones y menús."
section: guide
order: 11
---

<!-- Written by apps/web/scripts/screens.ts from the demo. Don't edit it by hand: run `pnpm --filter @cuentalibre/web screens`. -->

Cada pantalla de cuentalibre, tal y como se ve en el ordenador: su título, sus botones y menús, y sus secciones con los campos que tienen. Los campos marcados como obligatorios llevan un asterisco en la aplicación. En el móvil las pantallas tienen lo mismo, con la acción principal en el botón **+** de arriba a la derecha.

## Inicio

Dirección: /

- «Subir gasto», «Nueva factura», «Avisos».
- Ingresos y gastos: «Mensual», «Beneficio acumulado».
- Beneficio neto estimado: «Cómo se estiman los impuestos».
- Últimas facturas emitidas: «Ver todas», Cobro del periodo:.
- Calendario fiscal: «Ver calendario», «Continuar cierre de trimestre».
- Principales clientes: «Ver todos».

## Facturas emitidas

Dirección: /ventas/facturas

- Botones de arriba: «Configurar facturas emitidas»; «Nueva factura».
- Menú de tres puntos de cada fila: «Ver factura», «Ver los datos de la factura», «Crear por copia», «Gestionar el cobro», «Adjuntar documentos», «Gestionar etiquetas», «Descargar PDF», «Exportar Facturae», «Enviar factura», «Generar factura rectificativa», «Eliminar factura».
- «Filtrar por estado», «Filtros», «CSV», «Descargar los PDF en un .zip».

## Borradores

Dirección: /ventas/borradores

- Botones de arriba: «Configurar borradores»; «Nueva factura borrador».
- Menú de tres puntos de cada fila: «Ver factura borrador», «Editar factura borrador», «Crear por copia», «Emitir factura», «Adjuntar documentos», «Gestionar etiquetas», «Descargar PDF», «Enviar factura borrador», «Eliminar factura borrador».
- «Filtros», «CSV», «Descargar los PDF en un .zip».

## Albaranes

Dirección: /ventas/albaranes

- Botones de arriba: «Configurar albaranes»; «Nuevo albarán».
- Menú de tres puntos de cada fila: «Ver albarán», «Editar albarán», «Crear por copia», «Convertir en factura», «Cambiar estado», «Adjuntar documentos», «Gestionar etiquetas», «Descargar PDF», «Enviar albarán», «Eliminar albarán».
- «Filtrar por estado», «Filtros por defecto», «Filtros», «CSV», «Descargar los PDF en un .zip».

## Presupuestos

Dirección: /ventas/presupuestos

- Botones de arriba: «Configurar presupuestos»; «Nuevo presupuesto».
- Menú de tres puntos de cada fila: «Ver presupuesto», «Editar presupuesto», «Crear por copia», «Convertir en factura», «Cambiar estado», «Adjuntar documentos», «Gestionar etiquetas», «Descargar PDF», «Enviar presupuesto», «Eliminar presupuesto».
- «Filtrar por estado», «Filtros por defecto», «Filtros», «CSV», «Descargar los PDF en un .zip».

## Exportaciones

Dirección: /exportar

- «Exportación de libros de registro», «Exportación avanzada».

## Importación de facturas y gastos

Dirección: /importar

- Elige el tipo de datos a importar, «Facturas emitidas», «Descargar Excel de ejemplo», «haz clic para buscarlo», «Continuar».

## Facturas recibidas

Dirección: /compras/facturas

- Botones de arriba: «Leer factura con IA»; «Nueva factura recibida».
- Menú de tres puntos de cada fila: «Editar factura», «Crear por copia», «Gestionar los pagos», «Adjuntar documentos», «Sin justificante adjunto», «Registrar un abono de esta factura», «Eliminar factura».
- «Filtrar por estado», «Filtros», «CSV».

## Bienes de inversión

Dirección: /compras/bienes-de-inversion

- Botones de arriba: «Nuevo bien de inversión».
- Menú de tres puntos de cada fila: «Editar factura», «Crear por copia», «Gestionar los pagos», «Adjuntar documentos», «Sin justificante adjunto», «Registrar un abono de esta factura», «Eliminar factura».
- «Filtrar por estado», «Filtros», «CSV».

## Gastos

Dirección: /compras/gastos

- Botones de arriba: «Leer ticket con IA»; «Nuevo gasto».
- Menú de tres puntos de cada fila: «Editar gasto», «Crear por copia», «Gestionar el pago», «Adjuntar documentos», «Sin justificante adjunto», «Eliminar gasto».
- «Filtrar por estado», «Filtros», «CSV».

## Impuestos

Dirección: /impuestos

- Botones de arriba: «Calendario fiscal»; «Configurar impuestos».
- Modelos: Trimestrales:, Anuales:.

## Calendario fiscal

Dirección: /impuestos/calendario

- «Mis modelos», «Todos los modelos», «Cuadrícula», «Lista».

## IVA

Dirección: /impuestos/iva

- Botones de arriba: «Calcular datos modelo 303»; «Calcular datos modelo 390».
- Modelo 303: «Cl@ve PIN».
- Modelo 390: «Calendario del Contribuyente de la Agencia Tributaria».

## IRPF

Dirección: /impuestos/irpf

- Botones de arriba: «Calcular datos modelo 130»; «Calcular datos modelo 100».
- Modelo 130: «Cl@ve PIN».
- Modelo 100 - Declaración de la renta anual: «Calendario del Contribuyente de la Agencia Tributaria».

## Retenciones

Dirección: /impuestos/retenciones

- Botones de arriba: «Calcular datos modelo 111»; «Calcular datos modelo 190».
- Modelo 111: «Cl@ve PIN».
- Modelo 190: «Calendario del Contribuyente de la Agencia Tributaria».

## Retenciones de alquileres

Dirección: /impuestos/alquileres

- Botones de arriba: «Calcular datos modelo 115»; «Calcular datos modelo 180».
- Modelo 115: «Cl@ve PIN».
- Modelo 180: «Calendario del Contribuyente de la Agencia Tributaria».

## Operaciones con terceras personas

Dirección: /impuestos/terceras-personas

- Botones de arriba: «Calcular datos modelo 347».
- Modelo 347: «Cl@ve PIN», «Calendario del Contribuyente de la Agencia Tributaria».

## Operaciones intracomunitarias

Dirección: /impuestos/intracomunitarias

- Botones de arriba: «Calcular datos modelo 349».

## Bancos y caja

Dirección: /bancos

- Botones de arriba: «Nuevo cobro / pago manual».
- Menú de tres puntos de cada fila: «Ir al documento», «Se elimina desde su documento».
- Cuentas y formas de pago: «Ingreso/Transferencia», «Cuenta principal», «Tarjeta de empresa», «PayPal», «Efectivo», «Nueva forma de pago».
- Cobros y pagos de los últimos 12 meses: «Tipo de documento vinculado», «Método de cobro / pago», «CSV».

## Clientes

Dirección: /contactos/clientes

- Botones de arriba: «Nuevo cliente».
- Menú de tres puntos de cada fila: «Ver ficha», «Editar contacto», «Nueva factura», «Nuevo presupuesto», «Nuevo albarán», «Adjuntar archivos», «Gestionar etiquetas», «Descargar vCard», «Crear por copia», «Copiar como proveedor», «Eliminar contacto».
- «Filtros», «CSV».

## Proveedores

Dirección: /contactos/proveedores

- Botones de arriba: «Nuevo proveedor».
- Menú de tres puntos de cada fila: «Ver ficha», «Editar contacto», «Nueva factura recibida», «Nuevo gasto», «Adjuntar archivos», «Gestionar etiquetas», «Descargar vCard», «Crear por copia», «Copiar como cliente», «Eliminar contacto».
- «Filtros», «CSV».

## Catálogo de productos y servicios

Dirección: /catalogo/productos

- Botones de arriba: «Nuevo producto o servicio»; «Opciones del catálogo»: «Importar productos», «Exportar catálogo», «Configuración del catálogo», «Borrar elementos del catálogo».
- Menú de tres puntos de cada fila: «Editar», «Crear por copia», «Regularizar stock», «Ver movimientos de stock», «Desactivar», «Eliminar».
- «Filtros», «Exportar».

## Regularización de stock

Dirección: /catalogo/regularizar-stock

- Botones de arriba: «Nueva regularización».
- «Producto», «Filtros».

## Importar productos o servicios

Dirección: /catalogo/importar

- Botones de arriba: «Volver a productos»; «Listar elementos del catálogo».
- Elige el tipo de datos a importar, «Productos o servicios de catálogo», «Descargar Excel de ejemplo», «haz clic para buscarlo», «Continuar».

## Exportar catálogo

Dirección: /catalogo/exportar

- Botones de arriba: «Volver a productos».
- Exportación de catálogo: Formato de exportación, «Exportar».

## Informes

Dirección: /informes

- Botones de arriba: «Pérdidas y ganancias».
- Ingresos por cliente: «Ver todos».

## Pérdidas y ganancias

Dirección: /informes/perdidas-y-ganancias

- Botones de arriba: «Volver a informes»; «Resumida»; «Extendida»; «Exportar PDF».

## Cierre de trimestres

Dirección: /cierre-trimestre

- 1T, 2T, 3T, 4T.

## Configuración

Dirección: /configuracion

- Ajustes de usuario: «Datos personales», «Credenciales de acceso».
- Ajustes de empresa: «Datos de la empresa», «Facturas», «Facturas borrador», «Presupuestos», «Albaranes», «Impuestos», «Usuarios», «Formas de cobro y pago», «Clientes y proveedores», «Catálogo», «Etiquetas», «Archivos».
- Otras opciones: «Filtros de listados», «Plantillas de correo», «API y agentes», «Importaciones», «Aviso legal», «Privacidad», «Cookies», «Términos».

## Nueva factura

Dirección: /ventas/facturas/nueva

- Botones de arriba: «Volver a facturas emitidas»; «Configurar factura»; «Nuevo cliente»; «Crear factura»; «Más formas de crear»: «Crear e ir a la pantalla de editar», «Crear y enviar», «Crear y generar recibo de cobro».
- Información de la factura: Cliente (obligatorio), «Selecciona el cliente», Número, (ayuda: Se asigna al emitir la factura: el siguiente de la serie, en orden de fecha.), Serie (obligatorio), «Facturas normales», Fecha (obligatorio), Vencimiento, «30 días», «60 días», «90 días», «Sin fecha», Tipo de ingreso, (ayuda: Cuenta del Plan General Contable (grupo 7) en la que se registra el ingreso.), «705. Prestación de servicios», Retención, (ayuda: IRPF que el cliente te retiene e ingresa a Hacienda en tu nombre.), «15 % · Profesionales».
- Conceptos: «Mostrar edición avanzada», «Seleccionar producto del catálogo», Base, Cantidad, «Restar una unidad, concepto 1», «Sumar una unidad, concepto 1», Descuento, «21 %», «Eliminar concepto 1», «Más opciones del concepto 1», «Añadir otro concepto».
- Notas: Notas en la factura, (ayuda: Se imprimen en el documento. Guarda las que repites como notas predefinidas.), «Nota predefinida», «Gestionar información de la nota», Notas privadas, «Solo las ves tú: no aparecen en el documento.», Etiquetas, «Añadir etiqueta».
- Opciones avanzadas: Fecha de operación, Tipo de operación, (ayuda: Decide cómo se trata el IVA y en qué casillas de los modelos 303, 349 y 390 aparece.), «Nacional», Factura emitida en criterio de caja, (ayuda: El IVA se declara cuando cobras, no cuando emites. Solo si estás acogido al régimen especial de criterio de caja.), Operación de arrendamiento de inmuebles, (ayuda: Alquiler de un local o vivienda. Se informa en los modelos 115, 180 y 347 con su situación y referencia catastral.), Marcar factura como cobrada.
- Otros: Idioma, «Idioma por defecto del cliente», Formato numérico, «Formato por defecto del cliente».

## Nueva factura recibida

Dirección: /compras/facturas/nueva

- Botones de arriba: «Volver a facturas recibidas»; «Nuevo proveedor»; «Registrar factura»; «Más formas de registrar»: «Registrar e ir a la pantalla de editar», «Registrar y añadir otra».
- «elige un archivo».
- Información de la factura: Proveedor (obligatorio), «Selecciona el proveedor», Número (obligatorio), «El número que figura en la factura del proveedor.», Fecha de la factura (obligatorio), Fecha contable (obligatorio), (ayuda: Decide el trimestre en el que se deduce. Si una factura te llega tarde, puedes contabilizarla en un trimestre posterior.), Vencimiento, «30 días», «60 días», «90 días», «Sin fecha», Tipo de gasto, (ayuda: Cuenta del Plan General Contable (grupo 6) en la que se registra el gasto.), «600. Compras de mercaderías (materiales)», Imputación, (ayuda: Parte de la factura que cuenta como gasto deducible. Por ejemplo, si trabajas en casa y dedicas el 20 % de la vivienda a la actividad, de la luz puedes deducir el 30 % de ese 20 %: un 6 %.), Retención, (ayuda: IRPF que retienes al proveedor (un profesional, un alquiler…) e ingresas tú a Hacienda con el modelo 111 o 115.), «Sin retención».
- Conceptos: «Mostrar edición avanzada», «Seleccionar producto del catálogo», Base, Cantidad, «Restar una unidad, concepto 1», «Sumar una unidad, concepto 1», Descuento, «21 %», «Eliminar concepto 1», «Más opciones del concepto 1», «Añadir otro concepto».
- Pagos: «Marcar como pagada», «Elegir movimiento bancario», «Nuevo método».
- Notas: Notas privadas, «Solo las ves tú.», Etiquetas, «Añadir etiqueta».

## Nuevo gasto

Dirección: /compras/gastos/nuevo

- Botones de arriba: «Volver a gastos»; «Registrar gasto»; «Más formas de registrar»: «Registrar e ir a la pantalla de editar», «Registrar y añadir otro».
- «elige un archivo».
- Datos del gasto: «Cuota de autónomos», «Comisión bancaria», «Tasa o tributo», «Parking o taxi», Fecha (obligatorio), «Decide el trimestre en el que se deduce.», Concepto (obligatorio), Importe (obligatorio), (ayuda: Lo que has pagado, impuestos incluidos. Sin factura no se puede deducir el IVA, así que todo cuenta como gasto.), Tipo de gasto, (ayuda: Cuenta del Plan General Contable (grupo 6) en la que se registra el gasto.), «629. Otros servicios», Imputación, (ayuda: Parte del gasto que es deducible. Por ejemplo, si trabajas en casa y dedicas el 20 % de la vivienda a la actividad, de la luz puedes deducir el 30 % de ese 20 %: un 6 %.).
- Proveedor: Pagado a, «Nuevo proveedor», «Sin proveedor», Número, (ayuda: Número del recibo o justificante, si tiene. Evita registrar dos veces el mismo.), «Regístrala como factura recibida».
- Pago: Pagado, Fecha de pago (obligatorio), Método de pago (obligatorio), «Nuevo método», «Ingreso/Transferencia», «Elegir movimiento bancario».
- Notas: Notas privadas, «Solo las ves tú.», Etiquetas, «Añadir etiqueta».

## Nuevo bien de inversión

Dirección: /compras/bienes-de-inversion/nuevo

- Botones de arriba: «Volver a bienes de inversión»; «Nuevo proveedor»; «Registrar bien»; «Más formas de registrar»: «Registrar e ir a la pantalla de editar», «Registrar y añadir otro».
- «elige un archivo».
- Información de la factura: Proveedor (obligatorio), «Selecciona el proveedor», Número (obligatorio), «El número que figura en la factura del proveedor.», Fecha de la factura (obligatorio), Fecha contable (obligatorio), (ayuda: Decide el trimestre en el que se deduce. Si una factura te llega tarde, puedes contabilizarla en un trimestre posterior.), Vencimiento, «30 días», «60 días», «90 días», «Sin fecha», Tipo de gasto, (ayuda: Cuenta del Plan General Contable (grupo 6) en la que se registra el gasto.), «681. Amortización del inmovilizado material», Imputación, (ayuda: Parte de la factura que cuenta como gasto deducible. Por ejemplo, si trabajas en casa y dedicas el 20 % de la vivienda a la actividad, de la luz puedes deducir el 30 % de ese 20 %: un 6 %.), Retención, (ayuda: IRPF que retienes al proveedor (un profesional, un alquiler…) e ingresas tú a Hacienda con el modelo 111 o 115.), «Sin retención».
- Conceptos: «Mostrar edición avanzada», «Seleccionar producto del catálogo», Base, Cantidad, «Restar una unidad, concepto 1», «Sumar una unidad, concepto 1», Descuento, «21 %», «Eliminar concepto 1», «Más opciones del concepto 1», «Añadir otro concepto».
- Información sobre la amortización: Tipo de bien (obligatorio), (ayuda: Decide los coeficientes de amortización que permite la tabla simplificada de estimación directa.), «Seleccionar el tipo de bien», Identificador.
- Pagos: «Marcar como pagada», «Elegir movimiento bancario», «Nuevo método».
- Notas: Notas privadas, «Solo las ves tú.», Etiquetas, «Añadir etiqueta».

## Nuevo albarán

Dirección: /ventas/albaranes/nuevo

- Botones de arriba: «Volver a albaranes»; «Configurar albarán»; «Nuevo cliente»; «Crear albarán»; «Más formas de crear»: «Crear e ir a la pantalla de editar», «Crear y enviar».
- Información del albarán: Cliente (obligatorio), «Selecciona el cliente», Número (obligatorio), (ayuda: Número correlativo dentro de la serie. «Obtener número» propone el siguiente libre.), «Obtener número», Serie (obligatorio), «Albaranes», Fecha (obligatorio), Retención, (ayuda: IRPF que el cliente te retiene e ingresa a Hacienda en tu nombre.), «15 % · Profesionales».
- Conceptos: «Mostrar edición avanzada», «Seleccionar producto del catálogo», Base, Cantidad, «Restar una unidad, concepto 1», «Sumar una unidad, concepto 1», Descuento, «21 %», «Eliminar concepto 1», «Más opciones del concepto 1», «Añadir otro concepto».
- Notas: Notas en el albarán, (ayuda: Se imprimen en el documento. Guarda las que repites como notas predefinidas.), «Nota predefinida», «Gestionar información de la nota», Notas privadas, «Solo las ves tú: no aparecen en el documento.», Etiquetas, «Añadir etiqueta».
- Otros: Idioma, «Idioma por defecto del cliente», Formato numérico, «Formato por defecto del cliente».

## Nuevo presupuesto

Dirección: /ventas/presupuestos/nuevo

- Botones de arriba: «Volver a presupuestos»; «Configurar presupuesto»; «Nuevo cliente»; «Crear presupuesto»; «Más formas de crear»: «Crear e ir a la pantalla de editar», «Crear y enviar».
- Información del presupuesto: Cliente, «Sin datos de cliente», Número (obligatorio), (ayuda: Número correlativo dentro de la serie. «Obtener número» propone el siguiente libre.), «Obtener número», Serie (obligatorio), «Presupuestos», Fecha (obligatorio), Fecha de validez, «30 días», «60 días», «90 días», «Sin fecha», Retención, (ayuda: IRPF que el cliente te retiene e ingresa a Hacienda en tu nombre.), «15 % · Profesionales».
- Conceptos: «Mostrar edición avanzada», «Seleccionar producto del catálogo», Base, Cantidad, «Restar una unidad, concepto 1», «Sumar una unidad, concepto 1», Descuento, «21 %», «Eliminar concepto 1», «Más opciones del concepto 1», «Añadir otro concepto».
- Notas: Notas en el presupuesto, (ayuda: Se imprimen en el documento. Guarda las que repites como notas predefinidas.), «Nota predefinida», «Gestionar información de la nota», Notas privadas, «Solo las ves tú: no aparecen en el documento.», Etiquetas, «Añadir etiqueta».
- Otros: Idioma, «Idioma por defecto del cliente», Formato numérico, «Formato por defecto del cliente».

## Nuevo cliente

Dirección: /contactos/clientes/nuevo

- Botones de arriba: «Volver a clientes»; «Crear cliente»; «Más formas de crear»: «Crear y añadir otro».
- Datos de facturación: NIF (obligatorio), (ayuda: Se comprueba la letra o el dígito de control. Admite NIF, NIE y CIF, con o sin el prefijo ES.), Nombre o razón social (obligatorio), País, (ayuda: Decide cómo se valida el NIF y qué tipo de operación se propone en las facturas.), «España».
- Dirección: Código postal, Población, Provincia, «Ver en el mapa».
- Datos de contacto: Email, Teléfono, Móvil, Fax, Web.
- Condiciones por defecto: Descuento, «Se aplica a cada concepto nuevo del documento.», Retención, (ayuda: IRPF que te retiene este cliente. Las empresas y autónomos retienen a los profesionales; los particulares no.), «La del documento», Método de cobro, «El del documento», Idioma y formato numérico de sus documentos:, Idioma, «Idioma por defecto del documento», Formato numérico, «Formato por defecto del documento».
- Otros: Personalizado 1, Personalizado 2, Notas, «Solo las ves tú.», Etiquetas, «Añadir etiqueta».

## Nuevo proveedor

Dirección: /contactos/proveedores/nuevo

- Botones de arriba: «Volver a proveedores»; «Crear proveedor»; «Más formas de crear»: «Crear y añadir otro».
- Datos de facturación: NIF (obligatorio), (ayuda: Se comprueba la letra o el dígito de control. Admite NIF, NIE y CIF, con o sin el prefijo ES.), Nombre o razón social (obligatorio), País, (ayuda: Decide cómo se valida el NIF y qué tipo de operación se propone en las facturas.), «España».
- Dirección: Código postal, Población, Provincia, «Ver en el mapa».
- Datos de contacto: Email, Teléfono, Móvil, Fax, Web.
- Condiciones por defecto: Descuento, «Se aplica a cada concepto nuevo del documento.», Retención, (ayuda: IRPF que retienes a este proveedor, por ejemplo a un profesional como tu gestor.), «La del documento», Método de pago, «El del documento».
- Otros: Personalizado 1, Personalizado 2, Notas, «Solo las ves tú.», Etiquetas, «Añadir etiqueta».

## Nuevo producto o servicio

Dirección: /catalogo/productos/nuevo

- Botones de arriba: «Volver al catálogo»; «Crear producto»; «Más formas de crear»: «Crear y añadir otro».
- Información del producto: «Seleccionar una familia/subfamilia», Nombre (obligatorio), Descripción, Notas privadas, «No aparecen en la factura.», Tipo de unidad, «- No definido -», Etiquetas, «Añadir etiqueta», Producto visible (activo).
- Referencias: Código de producto (SKU), (ayuda: Código para identificar el producto dentro de tu propia empresa. Si lo rellenas, debe ser único: no puede usarlo ningún otro producto.), Referencia proveedor, «Código de producto de tu proveedor.».
- Precio de venta: «Mostrar edición avanzada», Precio unitario (base imponible) (obligatorio), Porcentaje de descuento, (ayuda: Descuento que se propone al añadir el producto a una factura.), Porcentaje de IVA (obligatorio), (ayuda: Valor por defecto en las facturas; se puede cambiar en cada una.), «21 %».
- Coste de adquisición: Coste unitario (base imponible), (ayuda: Lo que te cuesta adquirir el producto más lo necesario para tenerlo disponible (transporte, aduanas…). Indica la base imponible total de esos costes.), «Se propone al añadir el producto a una factura recibida.».
- Control de stock: Habilitar control de stock.

## Configuración de facturas

Dirección: /configuracion/facturas

- Botones de arriba: «Volver a configuración»; «Guardar cambios».
- Menú de tres puntos de cada fila: «Establecer por defecto», «Editar serie», «Desactivar serie», «Eliminar serie».
- Sistema de auto-numeración: «Nueva serie».
- Plantilla de factura: Clásica, Clásica Tradicional, Moderna, Moderna Tradicional, Elegante, Elegante Tradicional, Vanguardista, Fuente, «Arial», Color texto, Color líneas, Color fondo, «Restablecer», Idioma, «Español», Formato numérico, «España», Mostrar las unidades de producto, (ayuda: Imprime la unidad de medida de cada producto del catálogo junto a la cantidad.), No mostrar los impuestos cuando su importe sea cero, Mostrar fechas de prestación del servicio, Mostrar fecha de operación, Mostrar forma de pago.
- Logotipo de facturas, borradores, presupuestos y albaranes: «Arrastra aquí el logo o haz clic para buscarlo».
- Pie de factura fijo: Texto en todas las facturas.

## Configuración de facturas borrador

Dirección: /configuracion/facturas-borrador

- Botones de arriba: «Volver a configuración»; «Guardar cambios».
- Plantilla de factura borrador: Clásica, Clásica Tradicional, Moderna, Moderna Tradicional, Elegante, Elegante Tradicional, Vanguardista, Fuente, «Arial», Color texto, Color líneas, Color fondo, «Restablecer», Idioma, «Español», Formato numérico, «España», Mostrar las unidades de producto, (ayuda: Imprime la unidad de medida de cada producto del catálogo junto a la cantidad.), Mostrar fechas de prestación del servicio, Mostrar los precios de los productos/servicios, «Sin precios, el PDF lista solo los conceptos y cantidades.», Mostrar los impuestos, (ayuda: Sin impuestos, el PDF muestra solo la base imponible como total.), Pero esconder los impuestos cuando su importe sea 0.
- Logotipo de facturas borrador: «Configuración de facturas».
- Pie de factura borrador fijo: Texto en todas las facturas borrador.

## Nueva factura borrador

Dirección: /ventas/borradores/nuevo

- Botones de arriba: «Volver a borradores»; «Configurar factura borrador»; «Nuevo cliente»; «Emitir factura»; «Crear factura borrador»; «Más formas de crear»: «Crear e ir a la pantalla de editar», «Crear y enviar».
- Información de la factura borrador: Cliente, «Selecciona el cliente», Número (obligatorio), (ayuda: Número correlativo dentro de la serie. «Obtener número» propone el siguiente libre.), «Obtener número», Serie (obligatorio), «Facturas borrador», Fecha (obligatorio), Fecha de validez, «30 días», «60 días», «90 días», «Sin fecha», Retención, (ayuda: IRPF que el cliente te retiene e ingresa a Hacienda en tu nombre.), «15 % · Profesionales».
- Conceptos: «Mostrar edición avanzada», «Seleccionar producto del catálogo», Base, Cantidad, «Restar una unidad, concepto 1», «Sumar una unidad, concepto 1», Descuento, «21 %», «Eliminar concepto 1», «Más opciones del concepto 1», «Añadir otro concepto».
- Notas: Notas en la factura borrador, (ayuda: Se imprimen en el documento. Guarda las que repites como notas predefinidas.), «Nota predefinida», «Gestionar información de la nota», Notas privadas, «Solo las ves tú: no aparecen en el documento.», Etiquetas, «Añadir etiqueta».
- Otros: Idioma, «Idioma por defecto del cliente», Formato numérico, «Formato por defecto del cliente».

## Configuración de albaranes

Dirección: /configuracion/albaranes

- Botones de arriba: «Volver a configuración»; «Guardar cambios».
- Plantilla de albarán: Clásica, Clásica Tradicional, Moderna, Moderna Tradicional, Elegante, Elegante Tradicional, Vanguardista, Fuente, «Arial», Color texto, Color líneas, Color fondo, «Restablecer», Idioma, «Español», Formato numérico, «España», Mostrar las unidades de producto, (ayuda: Imprime la unidad de medida de cada producto del catálogo junto a la cantidad.), Mostrar fechas de prestación del servicio, Mostrar los precios de los productos/servicios, «Sin precios, el PDF lista solo los conceptos y cantidades.».
- Logotipo de albaranes: «Configuración de facturas».
- Pie de albarán fijo: Texto en todos los albaranes.
- Facturar albaranes: Convertir albaranes en facturas conservando todas sus líneas.

## Filtros de listados

Dirección: /configuracion/filtros-de-listados

- Botones de arriba: «Volver a configuración»; «Guardar cambios».
- Filtro por defecto de los listados de albaranes: Por estado, No filtrar, Mostrar inicialmente solo albaranes pendientes, Por fecha, Mostrar inicialmente solo albaranes del mes en curso.
- Filtro por defecto de los listados de presupuestos: Mostrar inicialmente solo presupuestos pendientes, Mostrar inicialmente solo presupuestos del mes en curso.

## Configuración de presupuestos

Dirección: /configuracion/presupuestos

- Botones de arriba: «Volver a configuración»; «Guardar cambios».
- Plantilla de presupuesto: Clásica, Clásica Tradicional, Moderna, Moderna Tradicional, Elegante, Elegante Tradicional, Vanguardista, Fuente, «Arial», Color texto, Color líneas, Color fondo, «Restablecer», Idioma, «Español», Formato numérico, «España», Mostrar las unidades de producto, (ayuda: Imprime la unidad de medida de cada producto del catálogo junto a la cantidad.), Mostrar fechas de prestación del servicio, Mostrar los precios de los productos/servicios, «Sin precios, el PDF lista solo los conceptos y cantidades.», Mostrar los impuestos, (ayuda: Sin impuestos, el PDF muestra solo la base imponible como total.), Pero esconder los impuestos cuando su importe sea 0.
- Logotipo de presupuestos: «Configuración de facturas».
- Pie de presupuesto fijo: Texto en todos los presupuestos.

## Exportación de libros de registro

Dirección: /exportar/libros-registro

- Botones de arriba: «Volver a exportaciones».
- Ejercicio.
- Libros de registro de IVA e IRPF: Formato de exportación, «Exportar».
- Libros de registro en formato antiguo: Libro de facturas emitidas, facturas recibidas y bienes de inversión (para el IVA), Libro de ingresos y gastos (para el IRPF).

## Exportación avanzada

Dirección: /exportar/avanzada

- Botones de arriba: «Volver a exportaciones».
- Selecciona la información a exportar: Listado de facturas (emitidas, recibidas y bienes de inversión), Incluir el detalle de las facturas, Incluir el detalle de los pagos y cobros, Listado de amortizaciones de bienes de inversión, Listado de gastos, Presupuestos entre las fechas, Incluir el detalle de los presupuestos, Albaranes entre las fechas, Incluir el detalle de los albaranes, Listado de clientes y proveedores, Formato de exportación, «Exportar».

## Impuestos

Dirección: /configuracion/impuestos

- Botones de arriba: «Volver a configuración»; «Guardar cambios».
- Régimen fiscal: «Cambiar el tipo de empresa», Región fiscal, «España - Península y Baleares», Método de estimación de IRPF, (ayuda: Decide cómo se calcula el rendimiento de tu actividad en los modelos 130 y 100.), «Estimación directa simplificada», Régimen de IVA, «Régimen general».
- Actividades económicas: «Añadir actividad».
- Valores por defecto en facturas: IVA de las líneas nuevas, «21 %», Retención de IRPF, «15 % · Profesionales».
- Cuota de autónomos: Cuota mensual (RETA).
- Facturas a clientes sin identificar: Cliente «Clientes varios, «Sin seleccionar», «Crear cliente «Clientes varios»».

## Retenciones de alquileres (un trimestre)

Dirección: /impuestos/alquileres?periodo=2026-T4

- Botones de arriba: «115 · Trimestral»; «180 · Anual».
- «Fichero para la AEAT», «Presentar el 115».
- Casillas del modelo 115: Mostrar casillas a cero.
- Facturas de alquiler del trimestre: «Cl@ve PIN».

## Retenciones (un trimestre)

Dirección: /impuestos/retenciones?periodo=2026-T4

- Botones de arriba: «111 · Trimestral»; «190 · Anual».
- «Fichero para la AEAT», «Presentar el 111».
- Casillas del modelo 111: Mostrar casillas a cero.
- Perceptores del trimestre: «Cl@ve PIN».

## IVA (un trimestre)

Dirección: /impuestos/iva?periodo=2026-T4

- Botones de arriba: «303 · Trimestral»; «390 · Anual».
- «Fichero para la AEAT», «Presentar el 303».
- Casillas del modelo 303: Mostrar casillas a cero.
- Identificación: «NO», «SÍ».
- Documentos del trimestre: «Cl@ve PIN».

## IRPF (un trimestre)

Dirección: /impuestos/irpf?periodo=2026-T4

- Botones de arriba: «130 · Trimestral»; «100 · Anual».
- «Fichero para la AEAT», «Presentar el 130».
- Casillas del modelo 130: Mostrar casillas a cero.
- Documentos desde el 1 de enero: «Cl@ve PIN».

## Operaciones intracomunitarias (un trimestre)

Dirección: /impuestos/intracomunitarias?periodo=2026-T4

- Botones de arriba: «Trimestral»; «Bimensual»; «Mensual».
- «Fichero para la AEAT», «Presentar el 349».

## IVA (el año)

Dirección: /impuestos/iva?periodo=2026

- Botones de arriba: «303 · Trimestral»; «390 · Anual».
- «Fichero para la AEAT», «Presentar el 390».
- Casillas del modelo 390: Mostrar casillas a cero.
- Documentos del año: «Cl@ve PIN», «Calendario del Contribuyente de la Agencia Tributaria».

## IRPF (el año)

Dirección: /impuestos/irpf?periodo=2026

- Botones de arriba: «130 · Trimestral»; «100 · Anual».
- «Libros para Renta WEB», «Ir a Renta WEB».
- Apartado D1 y pagos a cuenta: Mostrar casillas a cero.
- Documentos del año: «Calendario del Contribuyente de la Agencia Tributaria».

## Retenciones (el año)

Dirección: /impuestos/retenciones?periodo=2026

- Botones de arriba: «111 · Trimestral»; «190 · Anual».
- «Cumplimentar el 190».
- Perceptores: «Cl@ve PIN», «Calendario del Contribuyente de la Agencia Tributaria».

## Retenciones de alquileres (el año)

Dirección: /impuestos/alquileres?periodo=2026

- Botones de arriba: «115 · Trimestral»; «180 · Anual».
- «Cumplimentar el 180».
- Arrendadores e inmuebles: «Cl@ve PIN», «Calendario del Contribuyente de la Agencia Tributaria».

## Operaciones con terceras personas (el año)

Dirección: /impuestos/terceras-personas?periodo=2026

- «Cumplimentar el 347».
- Declarados: «Configuración › Impuestos», «Cl@ve PIN», «Calendario del Contribuyente de la Agencia Tributaria».

## Formas de cobro y pago

Dirección: /configuracion/formas-de-cobro-y-pago

- Botones de arriba: «Volver a configuración»; «Nueva forma de pago».
- «Todas», «Activas», «Inactivas», «Editar», «Más opciones de Ingreso/Transferencia», «Más opciones de Cuenta principal», «Más opciones de Tarjeta de empresa», «Más opciones de PayPal», «Más opciones de Efectivo».

## Datos personales

Dirección: /configuracion/datos-personales

- Botones de arriba: «Volver a configuración».
- Datos personales: «Guardar cambios», «Elegir imagen de perfil», Nombre (obligatorio), Apellidos, Fecha de nacimiento, Teléfono, Género, «Mujer».
- Notificaciones y avisos: Notificaciones de la aplicación, Deseo recibir las enviadas por correo electrónico, Deseo recibir las enviadas mediante notificación push, Mensajes promocionales, Deseo recibir los enviados por correo electrónico, Deseo recibir los enviados mediante notificación push.

## Credenciales de acceso

Dirección: /configuracion/credenciales

- Botones de arriba: «Volver a configuración».
- Datos de acceso: «Cambiar contraseña», «Activar».
- Cuentas vinculadas: «Desvincular», «Vincular».

## Datos de la empresa

Dirección: /configuracion/empresa

- Botones de arriba: «Volver a configuración»; «Guardar cambios».
- Datos fiscales: «Autónomo», «Sociedad», NIF (obligatorio), (ayuda: Se comprueba la letra o el dígito de control. Es el que figura en tu alta censal (modelo 036 o 037).), Nombre (obligatorio), Primer apellido (obligatorio), Segundo apellido, Nombre a mostrar en las facturas.
- Dirección fiscal: Dirección, Código postal, Población, Provincia, «Ver en el mapa».
- Contacto: Email, Teléfono, Web, «Configuración de facturas».

## Gestión de usuarios

Dirección: /configuracion/usuarios

- Botones de arriba: «Volver a configuración»; «Nuevo usuario».
- Menú de tres puntos de cada fila: «Editar usuario», «Reenviar invitación», «Desactivar acceso», «Quitar acceso».

## Clientes y proveedores

Dirección: /configuracion/clientes-proveedores

- Botones de arriba: «Volver a configuración»; «Guardar cambios».
- Campos personalizados: Nombre del campo personalizado 1, Nombre del campo personalizado 2.

## Configuración del catálogo

Dirección: /configuracion/catalogo

- Botones de arriba: «Volver a configuración»; «Guardar cambios».
- Campos personalizados: Nombre del campo personalizado 1, Nombre del campo personalizado 2, Nombre del campo personalizado 3, Nombre del campo personalizado 4.
- Productos en facturas, presupuestos y albaranes: Copiar el nombre del producto, Copiar el código y el nombre del producto, Copiar la descripción del producto en la descripción detallada del concepto.
- Control de stock: Descontar stock en facturas, «Nunca», Descontar stock en albaranes, Valores por defecto:, Activar control de stock.
- Borrar catálogo: Borrar también todas las familias y subfamilias, «Borrar elementos».

## Gestión de etiquetas

Dirección: /configuracion/etiquetas

- Botones de arriba: «Volver a configuración»; «Nueva etiqueta».

## Archivos

Dirección: /configuracion/archivos

- Botones de arriba: «Volver a configuración».

## Plantillas de correo

Dirección: /configuracion/plantillas-correo

- Botones de arriba: «Volver a configuración»; «Nueva plantilla».

## API y agentes

Dirección: /configuracion/api

- Botones de arriba: «Volver a configuración».
