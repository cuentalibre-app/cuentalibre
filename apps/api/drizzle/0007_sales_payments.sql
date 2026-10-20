CREATE TABLE "sales_payment" (
	"organization_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"id" text NOT NULL,
	"date" date NOT NULL,
	"amount" bigint NOT NULL,
	"payment_method_id" text NOT NULL,
	CONSTRAINT "sales_payment_organization_id_document_id_position_pk" PRIMARY KEY("organization_id","document_id","position")
);
--> statement-breakpoint
ALTER TABLE "sales_payment" ADD CONSTRAINT "sales_payment_organization_id_document_id_sales_document_organization_id_id_fk" FOREIGN KEY ("organization_id","document_id") REFERENCES "public"."sales_document"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- An invoice marked as paid had one collection of its whole total. It takes the invoice's ID,
-- so bank movements reconciled with "sale:<invoice id>" still name it
INSERT INTO "sales_payment" ("organization_id", "document_id", "position", "id", "date", "amount", "payment_method_id")
SELECT "organization_id", "id", 0, "id"::text, coalesce("paid_on", "issued_on"), "total", "payment_method_id"
FROM "sales_document"
WHERE "kind" = 'invoice' AND "status" = 'paid' AND "total" IS NOT NULL AND "payment_method_id" IS NOT NULL;--> statement-breakpoint
-- Without a method there is no collection to record: the invoice is pending again
UPDATE "sales_document" SET "status" = 'pending'
WHERE "kind" = 'invoice' AND "status" = 'paid' AND "payment_method_id" IS NULL;--> statement-breakpoint
ALTER TABLE "sales_document" DROP COLUMN "paid_on";--> statement-breakpoint
ALTER TABLE "sales_document" DROP COLUMN "payment_method_id";