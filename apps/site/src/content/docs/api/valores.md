---
title: "Valores"
description: "Los códigos que admiten los campos: tipos de operación, retenciones y cuentas contables."
section: api
order: 11
---

## Tipos de operación

| Valor           |                                                                     |
| --------------- | ------------------------------------------------------------------- |
| `national`      | Nacional.                                                           |
| `exempt`        | Nacional exenta de IVA (medicina, enseñanza reglada, seguros…).     |
| `notSubject`    | Nacional no sujeta a IVA.                                           |
| `reverseCharge` | Inversión del sujeto pasivo.                                        |
| `intraEu`       | Intracomunitaria, con un destinatario de la UE inscrito en el VIES. |
| `export`        | Exportación (solo ventas).                                          |
| `import`        | Importación (solo compras).                                         |

## Retenciones de IRPF

| Valor                                                      | Tipo              |                                                    |
| ---------------------------------------------------------- | ----------------- | -------------------------------------------------- |
| `none`                                                     | 0 %               | Sin retención.                                     |
| `professional`                                             | 15 %              | Profesionales.                                     |
| `newProfessional`                                          | 7 %               | Profesionales el año de alta y los dos siguientes. |
| `modules`                                                  | 1 %               | Actividades en módulos.                            |
| `farming`                                                  | 2 %               | Actividades agrícolas.                             |
| `rental`                                                   | 19 %              | Alquileres y rendimientos del capital.             |
| `imageRights`                                              | 24 %              | Derechos de imagen.                                |
| `ceutaProfessional`, `ceutaNewProfessional`, `ceutaRental` | 6 %, 2,8 %, 7,6 % | Tipos reducidos de Ceuta y Melilla.                |
| `legacy…`                                                  |                   | Tipos históricos, para facturas antiguas (abajo).  |

Tipos históricos, solo para facturas de antes de cada cambio: `legacyProfessional2014` (21 %), `legacyNewProfessional2015` (9 %), `legacyRental2009` (18 %), `legacyRental2015` (19,5 %), `legacyRentalJuly2015` (20 %), `legacyCeutaProfessional2014` (10,5 %), `legacyCeutaProfessional2015` (9,5 %), `legacyCeutaProfessional2018` (7,5 %), `legacyCeutaNewProfessional2015` (4,5 %) y `legacyCeutaNewProfessional2018` (3,5 %).

## Cuentas de ingresos

`700` Venta de mercaderías · `705` Prestación de servicios · `7098` Otras prestaciones de servicios · `7099` Otras ventas de mercaderías · `740` Subvenciones a la explotación · `746` Subvenciones al capital · `747` Otras subvenciones · `752` Ingresos por arrendamiento · `769` Ingresos financieros.

## Cuentas de gastos

| Cuenta |                                                            |
| ------ | ---------------------------------------------------------- |
| `600`  | Compras de mercaderías                                     |
| `602`  | Otros aprovisionamientos                                   |
| `607`  | Trabajos realizados por otras empresas                     |
| `621`  | Arrendamientos y cánones (alquileres)                      |
| `622`  | Reparaciones y conservación                                |
| `623`  | Servicios de profesionales independientes                  |
| `6231` | Servicios de profesionales sin alta en actividad económica |
| `624`  | Transportes                                                |
| `625`  | Primas de seguros                                          |
| `626`  | Servicios bancarios                                        |
| `627`  | Publicidad, propaganda y relaciones públicas               |
| `628`  | Suministros (agua, luz, gas)                               |
| `629`  | Otros servicios                                            |
| `6291` | Comunicaciones (internet, móvil…)                          |
| `6292` | Viajes, estancias y desplazamientos                        |
| `6293` | Material de oficina                                        |
| `6294` | Material informático                                       |
| `6295` | Manutención del autónomo pagada electrónicamente           |
| `6297` | Afiliaciones y suscripciones                               |
| `631`  | Otros tributos (IBI, tasa de basuras…)                     |
| `640`  | Sueldos y salarios                                         |
| `641`  | Indemnizaciones                                            |
| `642`  | Seguridad Social a cargo de la empresa                     |
| `6421` | Seguridad Social de los empleados                          |
| `6422` | Seguridad Social del titular (cuota de autónomos)          |
| `649`  | Otros gastos sociales                                      |
| `660`  | Gastos financieros                                         |
| `662`  | Intereses de deudas a largo plazo                          |
| `663`  | Intereses de deudas a corto plazo                          |
| `680`  | Amortización del inmovilizado intangible                   |
| `681`  | Amortización del inmovilizado material                     |
| `682`  | Amortización de las inversiones inmobiliarias              |

## Situación del inmueble

`rentalLocation` en los alquileres: `spain` (España, con referencia catastral), `basqueCountry` (País Vasco), `navarre` (Navarra), `noCadastralRef` (España, sin referencia catastral) y `abroad` (extranjero).

## Bienes de inversión

`asset.category` de una factura recibida, con el coeficiente anual máximo y el periodo máximo de amortización:

| Valor                | Coeficiente máximo | Años máximos |                                  |
| -------------------- | ------------------ | ------------ | -------------------------------- |
| `buildings`          | 3 %                | 68           | Edificios y construcciones       |
| `installations`      | 10 %               | 20           | Instalaciones                    |
| `machinery`          | 12 %               | 18           | Maquinaria                       |
| `transport`          | 16 %               | 14           | Elementos de transporte          |
| `itEquipment`        | 26 %               | 10           | Equipos informáticos             |
| `software`           | 33 %               | 6            | Aplicaciones informáticas        |
| `tools`              | 30 %               | 8            | Útiles y herramientas            |
| `cattle`             | 16 %               | 14           | Ganado vacuno, porcino, ovino…   |
| `horses`             | 8 %                | 25           | Ganado equino y frutales no cítricos |
| `citrus`             | 4 %                | 50           | Frutales cítricos y viñedos      |
| `olives`             | 2 %                | 100          | Olivar                           |
| `research`, `development`, `concessions`, `industrialProperty`, `goodwill`, `leaseRights` | 100 % | 100 | Inmovilizado intangible |

`asset.condition`: `new` (nuevo), `used` (usado) y `accelerated` (amortización acelerada) pueden aplicar hasta el doble del coeficiente máximo; `lowValue` (bienes de hasta 300 €) y `free` (libertad de amortización) se amortizan enteros el año de compra. `asset.method` es `rate` (coeficiente anual en `value`) o `years` (número de años en `value`).

## Unidades

`unit` de las líneas y los productos: `uds` (unidades), `dec` (decenas), `cent` (centenas), `mill` (millares), `mg`, `g`, `kg`, `t`, `ml`, `cl`, `dl`, `l`, `m3`, `min`, `h`, `d` (días), `1/2d` (medios días), `jornadas`, `1/2j` (medias jornadas), `semana`, `mes`, `trimestre`, `semestre`, `año`, `letra`, `palabra`, `frase`, `página`, `mm`, `cm`, `m` y `km`.

## Estados

| Qué                                        | Valores                                                       |
| ------------------------------------------ | ------------------------------------------------------------- |
| Facturas y borradores (`status`)           | `pending`, `paid`                                             |
| Presupuestos y albaranes (`status`)        | `created`, `sent`, `accepted`, `rejected`, `invoiced`         |
| Registro de VERI\*FACTU (`issued.verifactu.status`) | `pending`, `accepted`, `acceptedWithErrors`, `rejected` |
| Correos (`status`)                         | `queued`, `sent`, `failed`                                    |
