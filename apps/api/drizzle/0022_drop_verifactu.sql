-- cuentalibre ships without VERI*FACTU for now: its records, chain state and census checks go,
-- with the settings and background jobs that belonged to it.
DELETE FROM "outbox" WHERE "topic" IN ('verifactu', 'census');--> statement-breakpoint
DELETE FROM "organization_setting" WHERE "section" IN ('verifactu', 'verifactuCheck');--> statement-breakpoint
DROP TABLE "tax_id_check" CASCADE;--> statement-breakpoint
DROP TABLE "verifactu_record" CASCADE;--> statement-breakpoint
DROP TABLE "verifactu_state" CASCADE;
