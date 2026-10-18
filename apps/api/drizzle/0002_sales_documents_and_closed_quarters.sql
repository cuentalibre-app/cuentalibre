CREATE TABLE "closed_quarter" (
	"organization_id" uuid NOT NULL,
	"period" text NOT NULL,
	"closed_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "closed_quarter_organization_id_period_pk" PRIMARY KEY("organization_id","period")
);
--> statement-breakpoint
CREATE TABLE "sales_document" (
	"organization_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"kind" text NOT NULL,
	"number" text,
	"series" text NOT NULL,
	"client_id" uuid,
	"issued_on" date NOT NULL,
	"due_on" date,
	"income_type" text NOT NULL,
	"withholding" text NOT NULL,
	"operation_type" text NOT NULL,
	"operation_on" date,
	"cash_basis" boolean NOT NULL,
	"rental" boolean NOT NULL,
	"rental_location" text,
	"cadastral_ref" text,
	"rectifies_id" uuid,
	"supplies" bigint,
	"paid_on" date,
	"payment_method_id" text,
	"tags" text[],
	"language" text,
	"number_format" text,
	"status" text NOT NULL,
	"public_notes" text NOT NULL,
	"private_notes" text NOT NULL,
	"attachments" jsonb,
	"issued_at" timestamp with time zone,
	"client_snapshot" jsonb,
	"total_base" bigint,
	"total_vat" bigint,
	"total_surcharge" bigint,
	"total_withholding" bigint,
	"total" bigint,
	"vat_breakdown" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "sales_document_organization_id_id_pk" PRIMARY KEY("organization_id","id"),
	CONSTRAINT "sales_document_kind_check" CHECK ("sales_document"."kind" in ('invoice', 'draft', 'quote', 'deliveryNote')),
	CONSTRAINT "sales_document_invoice_check" CHECK ("sales_document"."kind" <> 'invoice' or ("sales_document"."number" is not null and "sales_document"."issued_at" is not null and "sales_document"."deleted_at" is null))
);
--> statement-breakpoint
CREATE TABLE "sales_line" (
	"organization_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"id" text NOT NULL,
	"concept" text NOT NULL,
	"detail" text,
	"unit_price" numeric(18, 6) NOT NULL,
	"quantity" numeric(18, 6) NOT NULL,
	"discount" numeric(9, 6) NOT NULL,
	"vat_rate" numeric(6, 4) NOT NULL,
	"surcharge_rate" numeric(6, 4),
	"service_from" date,
	"service_to" date,
	"product_id" text,
	"unit" text,
	CONSTRAINT "sales_line_organization_id_document_id_position_pk" PRIMARY KEY("organization_id","document_id","position")
);
--> statement-breakpoint
ALTER TABLE "change_log" ALTER COLUMN "record_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "closed_quarter" ADD CONSTRAINT "closed_quarter_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_document" ADD CONSTRAINT "sales_document_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_document" ADD CONSTRAINT "sales_document_organization_id_client_id_contact_organization_id_id_fk" FOREIGN KEY ("organization_id","client_id") REFERENCES "public"."contact"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_document" ADD CONSTRAINT "sales_document_organization_id_rectifies_id_sales_document_organization_id_id_fk" FOREIGN KEY ("organization_id","rectifies_id") REFERENCES "public"."sales_document"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_line" ADD CONSTRAINT "sales_line_organization_id_document_id_sales_document_organization_id_id_fk" FOREIGN KEY ("organization_id","document_id") REFERENCES "public"."sales_document"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_document_organization_id_issued_on_index" ON "sales_document" USING btree ("organization_id","issued_on");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_document_organization_id_kind_number_index" ON "sales_document" USING btree ("organization_id","kind","number") WHERE "sales_document"."number" is not null and "sales_document"."deleted_at" is null;