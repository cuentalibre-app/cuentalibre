---
title: "Mapa de la aplicación"
label: "Mapa"
description: "Dónde está cada sección y cada atajo de cuentalibre, en el ordenador y en el móvil."
section: guide
order: 10
---

<!-- Written from apps/web/src/components/layout/nav.ts. Don't edit it by hand: run `pnpm --filter @cuentalibre/web test -u`. -->

cuentalibre tiene las mismas funciones en el ordenador y en el móvil, pero las reparte de otra forma en la pantalla.

## En el ordenador

El menú de la izquierda tiene todas las secciones. Las que tienen varias pantallas se despliegan al pulsarlas. De arriba abajo:

- **Inicio**
- **Ventas**: Facturas emitidas, Borradores, Albaranes, Presupuestos, Exportar (solo en el ordenador) e Importar (solo en el ordenador).
- **Compras**: Facturas recibidas, Bienes de inversión, Gastos, Exportar (solo en el ordenador) e Importar (solo en el ordenador).
- **Impuestos**: Resumen, Calendario fiscal, IVA (303, 390), IRPF (130, 100) (solo autónomos), Retenciones (111, 190), Alquileres (115, 180), Terceras personas (347) e Intracomunitarias (349).
- **Bancos**
- **Contactos**: Clientes y Proveedores.
- **Catálogo**: Productos, Regularizar stock, Importar (solo en el ordenador) y Exportar (solo en el ordenador).
- **Informes**: Resumen y Pérdidas y ganancias.
- **Cierre de trimestres**
- **Configuración**

El botón **Crear**, arriba del menú, abre los atajos para crear:

- **Factura emitida**, **Factura recibida**, **Gasto**, **Bien de inversión**, **Albarán**, **Presupuesto**.
- **Cliente**, **Proveedor**, **Producto**.

Abajo del todo, el botón con tus iniciales abre tu cuenta: **Configuración**, el tema claro u oscuro y **Cerrar sesión**.

## En el móvil

Abajo hay una barra flotante con 5 botones de solo icono. De izquierda a derecha:

- **Inicio** (el primero).
- **Ventas** (el segundo): abre **Facturas emitidas**.
- **Accesos rápidos** (el del centro): abre **Facturas recibidas**, **Gastos**, **Clientes**.
- **Impuestos** (el cuarto): abre **Resumen**, desde el que se entra en cada modelo.
- **Más** (el último): abre la hoja **Más**, con el resto de secciones.

La hoja **Más** reúne, de arriba abajo:

- **Ventas**: Borradores, Albaranes y Presupuestos.
- **Compras**: Facturas recibidas, Bienes de inversión y Gastos.
- **Impuestos**: Calendario fiscal y Configurar impuestos.
- **Bancos**
- **Contactos**: Clientes y Proveedores.
- **Catálogo**: Productos y Regularizar stock.
- **Informes**: Resumen y Pérdidas y ganancias.
- **Cierre de trimestres**
- **Configuración**

Exportar e Importar no están en el móvil: se usan desde el ordenador.

Tu cuenta (**Configuración**, el tema y **Cerrar sesión**) se abre con el botón de tus iniciales, arriba en **Inicio**.

## En todas las pantallas

- Arriba de cada pantalla está su título y, al lado, sus acciones. En el ordenador, la principal es un botón con texto, como **Nueva factura**; en el móvil es un botón **+** arriba a la derecha.
- El botón **Asistente** (un icono de robot) abre este chat de ayuda: a la derecha en el ordenador y como una hoja en el móvil.
- En los listados, cada fila tiene un botón de tres puntos con sus acciones (descargar el PDF, enviar, cobrar, rectificar, eliminar…). En el móvil, las filas solo muestran ese botón.
- El periodo (un trimestre o el año) se elige en el selector de la parte de arriba de los listados, los impuestos y los informes.
