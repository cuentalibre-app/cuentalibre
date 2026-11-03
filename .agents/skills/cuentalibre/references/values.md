# Values

## Operation types

| Value           |                                                                     | Sales | Purchases |
| --------------- | ------------------------------------------------------------------- | ----- | --------- |
| `national`      | National.                                                           | ✓     | ✓         |
| `exempt`        | National, VAT-exempt (healthcare, regulated education, insurance…). | ✓     | ✓         |
| `notSubject`    | National, not subject to VAT.                                       | ✓     | ✓         |
| `reverseCharge` | Reverse charge (inversión del sujeto pasivo).                       | ✓     | ✓         |
| `intraEu`       | Intra-EU, with a VIES-registered counterparty.                      | ✓     | ✓         |
| `export`        | Export.                                                             | ✓     |           |
| `import`        | Import (add `customsDocument`).                                     |       | ✓         |

## IRPF withholdings

| Value                            | Rate   |                                                          |
| -------------------------------- | ------ | -------------------------------------------------------- |
| `none`                           | 0 %    |                                                          |
| `professional`                   | 15 %   | Professionals.                                           |
| `newProfessional`                | 7 %    | Professionals the year they start and the two following. |
| `modules`                        | 1 %    | Business activities under modules, livestock.            |
| `farming`                        | 2 %    | Farming.                                                 |
| `rental`                         | 19 %   | Rentals and returns on capital.                          |
| `imageRights`                    | 24 %   | Image rights.                                            |
| `ceutaProfessional`              | 6 %    | Ceuta and Melilla.                                       |
| `ceutaNewProfessional`           | 2,8 %  | Ceuta and Melilla.                                       |
| `ceutaRental`                    | 7,6 %  | Ceuta and Melilla.                                       |
| `legacyProfessional2014`         | 21 %   | Historical, for old invoices only.                       |
| `legacyNewProfessional2015`      | 9 %    | 〃                                                       |
| `legacyRental2009`               | 18 %   | 〃                                                       |
| `legacyRental2015`               | 19,5 % | 〃                                                       |
| `legacyRentalJuly2015`           | 20 %   | 〃                                                       |
| `legacyCeutaProfessional2014`    | 10,5 % | 〃                                                       |
| `legacyCeutaProfessional2015`    | 9,5 %  | 〃                                                       |
| `legacyCeutaProfessional2018`    | 7,5 %  | 〃                                                       |
| `legacyCeutaNewProfessional2015` | 4,5 %  | 〃                                                       |
| `legacyCeutaNewProfessional2018` | 3,5 %  | 〃                                                       |

## Income accounts (`incomeType`)

`700` sale of goods · `705` services · `7098` other services · `7099` other sales of goods · `740` operating subsidies · `746` capital subsidies · `747` other subsidies · `752` rental income · `769` financial income.

## Expense accounts (`expenseType`)

| Account |                                                      | Typical use                             |
| ------- | ---------------------------------------------------- | --------------------------------------- |
| `600`   | Purchases of goods                                   | Goods for resale                        |
| `602`   | Other supplies                                       |                                         |
| `607`   | Work by other companies                              | Subcontracting                          |
| `621`   | Rentals and royalties                                | Office, coworking, leasing              |
| `622`   | Repairs and maintenance                              |                                         |
| `623`   | Independent professionals                            | Gestoría, lawyer, designer              |
| `6231`  | Professionals without economic activity registration |                                         |
| `624`   | Transport                                            | Shipping, couriers                      |
| `625`   | Insurance                                            |                                         |
| `626`   | Bank services                                        | Fees                                    |
| `627`   | Advertising and PR                                   | Ads, promotion                          |
| `628`   | Utilities (water, power, gas)                        |                                         |
| `629`   | Other services                                       | Default when nothing fits               |
| `6291`  | Communications                                       | Internet, mobile                        |
| `6292`  | Travel and accommodation                             | Trains, flights, hotels, taxis, parking |
| `6293`  | Office supplies                                      |                                         |
| `6294`  | IT equipment                                         | Small hardware, peripherals             |
| `6295`  | Self-employed meals paid electronically              |                                         |
| `6297`  | Memberships and subscriptions                        | SaaS, professional associations         |
| `631`   | Other taxes                                          | IBI, waste tax                          |
| `640`   | Wages                                                |                                         |
| `641`   | Severance                                            |                                         |
| `642`   | Employer social security                             |                                         |
| `6421`  | Employees' social security                           |                                         |
| `6422`  | Owner's social security                              | Cuota de autónomos                      |
| `649`   | Other social expenses                                |                                         |
| `660`   | Financial expenses                                   |                                         |
| `662`   | Long-term debt interest                              |                                         |
| `663`   | Short-term debt interest                             |                                         |
| `680`   | Amortization of intangible assets                    |                                         |
| `681`   | Amortization of tangible assets                      |                                         |
| `682`   | Amortization of real estate investments              |                                         |

## Rental location (`rentalLocation`)

`spain` · `basqueCountry` · `navarre` · `noCadastralRef` · `abroad`.

## Investment asset categories (`asset.category`)

Maximum yearly rate / maximum years: `buildings` 3 %/68 · `installations` 10 %/20 · `machinery` 12 %/18 · `transport` 16 %/14 · `itEquipment` 26 %/10 · `software` 33 %/6 · `tools` 30 %/8 · `cattle` 16 %/14 · `horses` 8 %/25 · `citrus` 4 %/50 · `olives` 2 %/100 · `research`, `development`, `concessions`, `industrialProperty`, `goodwill`, `leaseRights` 100 %/100.

`asset.condition`: `new`; `used` and `accelerated` may apply twice the highest rate; `lowValue` (up to 300 € each) and `free` are written off the year they are bought.

## Units (`unit`)

`uds` units · `dec` tens · `cent` hundreds · `mill` thousands · `mg` · `g` · `kg` · `t` · `ml` · `cl` · `dl` · `l` · `m3` · `min` · `h` · `d` days · `1/2d` half days · `jornadas` · `1/2j` half jornadas · `semana` · `mes` · `trimestre` · `semestre` · `año` · `letra` · `palabra` · `frase` · `página` · `mm` · `cm` · `m` · `km`.

## Statuses

- Sales documents: invoices and drafts `pending`, `paid`; quotes and delivery notes `created`, `sent`, `accepted`, `rejected`, `invoiced`.
- Email: `queued`, `sent`, `failed`.

## Quarters

`YYYY-T1` January–March · `T2` April–June · `T3` July–September · `T4` October–December.
