# Changelog

What changes in each version of cuentalibre for people who run it on their own server. To upgrade, see [Install on your server › Update](https://cuentalibre.es/docs/instalar#actualizar).

<!-- Generated on release from the PRs merged since the previous version; don't edit by hand. -->

## 1.3.4 (2026-11-24)

* Back up uploaded file versions nightly by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/156
* Encrypt Google OAuth tokens at rest by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/157
* State how long backups keep a deleted account's data by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/158
* Harden document reading, attachment caching and error logging by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/159

**Full Changelog**: https://github.com/cuentalibre-app/cuentalibre/compare/v1.3.3...v1.3.4

## 1.3.3 (2026-11-20)

* Make the tax ID optional at checkout by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/141

**Full Changelog**: https://github.com/cuentalibre-app/cuentalibre/compare/v1.3.2...v1.3.3

## 1.3.2 (2026-11-20)

* Prepare billing for live Stripe by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/137

**Full Changelog**: https://github.com/cuentalibre-app/cuentalibre/compare/v1.3.1...v1.3.2

## 1.3.1 (2026-11-20)

* Group self-hosting and Cloud under deploy/selfhost and deploy/cloud by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/138

**Full Changelog**: https://github.com/cuentalibre-app/cuentalibre/compare/v1.3.0...v1.3.1

## 1.3.0 (2026-11-20)

* Explain read-only deletion and period switches in the terms by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/131
* Delete organizations left read-only for 12 months, after reminder emails by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/132
* Rate-limit every API request, cap bodies and time out slow clients by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/133
* Charge VAT through Stripe Tax instead of a fixed 21 % rate by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/134
* Serve the Cloud API through a Cloudflare Tunnel instead of Caddy by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/136

**Full Changelog**: https://github.com/cuentalibre-app/cuentalibre/compare/v1.2.1...v1.3.0

## 1.2.1 (2026-11-18)

* Rework the panel beside the sign-in and sign-up forms by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/130

**Full Changelog**: https://github.com/cuentalibre-app/cuentalibre/compare/v1.2.0...v1.2.1

## 1.2.0 (2026-11-17)

* Announce the Three Kings launch offer on the site by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/125
* Update hono, @hono/node-server and nodemailer by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/126
* Trim fixed deadlines and guarantees from the legal pages by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/127
* Draw the site in the app's ink and cobalt by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/128

**Full Changelog**: https://github.com/cuentalibre-app/cuentalibre/compare/v1.1.0...v1.2.0

## 1.1.0 (2026-11-17)

* Answer the help chat from the docs, streamed from the API by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/105
* List OpenAI as a processor: document reading and help chat by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/106
* Let companies download the AEAT file of their tax forms by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/109
* Leave the income tax forms out for companies by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/111
* User guide, and the help chat answers from it by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/107
* Tell the help chat where everything is and what each screen has by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/112
* Show bank logos for payment methods, read from the IBAN by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/114
* Trim the help chat's prompt by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/115
* Refresh the app screenshots and install the skill with npx skills by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/117
* Trim AGENTS.md and stop turbo from injecting its agent block by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/116
* List the other sales lists in the phone's "Más" sheet by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/118
* Polish phone headers, save buttons and field help by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/119
* Give income, statuses and table headers more color by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/122
* Add the phone layout conventions to AGENTS.md by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/121
* Refresh the screenshots, fold the plan features on phones and explain the assistant in the demo by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/123
* Celebrate the welcome with an animated logo and confetti by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/124

**Full Changelog**: https://github.com/cuentalibre-app/cuentalibre/compare/v1.0.0...v1.1.0

## 1.0.0 (2026-11-15)

* Generate the changelog in English from merged PRs by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/87
* Read a VAT line from invoices without VAT by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/88
* Stop the app from zooming on a phone by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/89
* Validate contact tax IDs in the API like the web form by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/93
* Group informative returns by tax ID, not by contact by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/95
* Offer period years from the business's data by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/96
* Allow the trackpad back swipe; provider logos in linked accounts by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/97
* Make UI copy more direct by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/98
* Drop catalog settings that did nothing or repeated others by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/99
* Keep settings from promising what they don't do by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/100
* Give the app a denser, flatter dashboard look by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/102
* Help chat panel, and AI settings split into scan and chat by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/104

**Full Changelog**: https://github.com/cuentalibre-app/cuentalibre/compare/v0.1.4...v1.0.0

## 0.1.4 (2026-11-14)

* Open the demo in the same tab on phones by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/79
* Read received invoices and receipts with AI (API) by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/81
* Count and cache documents read with AI by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/83
* Fill in received invoices and expenses with AI by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/82
* Keep the keyboard down and the page unzoomed when a sheet opens on a phone by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/85
* Propose the expense type of a document read with AI by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/84
* Skip autoFocus on touch screens in every field by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/86

**Full Changelog**: https://github.com/cuentalibre-app/cuentalibre/compare/v0.1.3...v0.1.4

## 0.1.3 (2026-11-12)

* Keep the demo banner visible in Chrome on iPhone by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/78

**Full Changelog**: https://github.com/cuentalibre-app/cuentalibre/compare/v0.1.2...v0.1.3

## 0.1.2 (2026-11-12)

* Lead the landing with the free self-hosted edition by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/77
* Lead the landing with the free edition and add the /online page by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/76

**Full Changelog**: https://github.com/cuentalibre-app/cuentalibre/compare/v0.1.1...v0.1.2

## 0.1.1 (2026-11-11)

* Mobile redesign and UI harmony on shared primitives by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/53
* Restore the mobile redesign commits left out of #53 by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/54
* Mobile polish: draggable tab bar, compact lists, folded records by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/55
* Fit payment dialogs on phones and centre iOS date values by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/56
* Apply the Web Interface Guidelines audit fixes by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/57
* Fit settings tables and headers on phones by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/58
* Rework the phone home chart and summary; let charts drop their selection by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/59
* Phone sign-in in the app's look; no year bar labels by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/62
* Add link previews and home screen icons by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/63
* Lower the quarterly and yearly Cloud prices by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/64
* Fit the reports summary on phones by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/65
* Bring the site and the app closer together by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/67
* Give the payment method select an empty state by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/61
* Refresh the README screenshots by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/69
* Remove the company reports page and its made-up registry data by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/70
* Suggest Spanish streets and numbers as the address is typed by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/71
* Keep the top banners clear of the phone's status bar by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/72
* Point self-hosters at versioned releases instead of main by @jesuspb2 in https://github.com/cuentalibre-app/cuentalibre/pull/73

**Full Changelog**: https://github.com/cuentalibre-app/cuentalibre/compare/v0.1.0...v0.1.1

## 0.1.0 (2026-11-11)

First published version of cuentalibre to install on your own server. It's the same code that has run cuentalibre Cloud since 9 November 2026.

To install it, follow the guide [Install on your server](https://cuentalibre.es/docs/instalar).
