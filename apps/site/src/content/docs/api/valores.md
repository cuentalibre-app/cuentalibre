---
title: "Valores"
description: "Los códigos que admiten los campos: tipos de operación, retenciones y cuentas contables."
section: api
order: 9
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
| `legacy…`                                                  |                   | Tipos históricos, para facturas antiguas.          |

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
