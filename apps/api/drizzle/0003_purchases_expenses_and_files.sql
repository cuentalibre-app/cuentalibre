CREATE TABLE "file" (
	"organization_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"content_type" text NOT NULL,
	"size" bigint NOT NULL,
	"storage_key" text NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "file_organization_id_id_pk" PRIMARY KEY("organization_id","id"),
	CONSTRAINT "file_storageKey_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "expense" (
	"organization_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"date" date NOT NULL,
	"number" text NOT NULL,
	"concept" text NOT NULL,
	"amount" bigint NOT NULL,
	"expense_type" text NOT NULL,
	"imputation" integer NOT NULL,
	"supplier_id" uuid,
	"other_payee" jsonb,
	"paid_on" date,
	"payment_method_id" text,
	"rental" boolean NOT NULL,
	"rental_location" text,
	"cadastral_ref" text,
	"private_notes" text NOT NULL,
	"tags" text[],
	"attachments" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "expense_organization_id_id_pk" PRIMARY KEY("organization_id","id"),
	CONSTRAINT "expense_imputation_check" CHECK ("expense"."imputation" between 0 and 100),
	CONSTRAINT "expense_payment_check" CHECK (("expense"."paid_on" is null) = ("expense"."payment_method_id" is null))
);
--> statement-breakpoint
CREATE TABLE "purchase_invoice" (
	"organization_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"number" text NOT NULL,
	"issued_on" date NOT NULL,
	"booked_on" date NOT NULL,
	"due_on" date,
	"expense_type" text NOT NULL,
	"imputation" integer NOT NULL,
	"vat_imputation" integer,
	"withholding" text NOT NULL,
	"operation_type" text NOT NULL,
	"operation_on" date,
	"customs_document" text,
	"cash_basis" boolean NOT NULL,
	"rental" boolean NOT NULL,
	"rental_location" text,
	"cadastral_ref" text,
	"rectifies_id" uuid,
	"private_notes" text NOT NULL,
	"tags" text[],
	"attachments" jsonb,
	"asset" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "purchase_invoice_organization_id_id_pk" PRIMARY KEY("organization_id","id"),
	CONSTRAINT "purchase_invoice_imputation_check" CHECK ("purchase_invoice"."imputation" between 0 and 100),
	CONSTRAINT "purchase_invoice_vat_imputation_check" CHECK ("purchase_invoice"."vat_imputation" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "purchase_line" (
	"organization_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
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
	CONSTRAINT "purchase_line_organization_id_invoice_id_position_pk" PRIMARY KEY("organization_id","invoice_id","position")
);
--> statement-breakpoint
CREATE TABLE "purchase_payment" (
	"organization_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"id" text NOT NULL,
	"date" date NOT NULL,
	"amount" bigint NOT NULL,
	"payment_method_id" text NOT NULL,
	CONSTRAINT "purchase_payment_organization_id_invoice_id_position_pk" PRIMARY KEY("organization_id","invoice_id","position")
);
--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file" ADD CONSTRAINT "file_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_organization_id_supplier_id_contact_organization_id_id_fk" FOREIGN KEY ("organization_id","supplier_id") REFERENCES "public"."contact"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoice" ADD CONSTRAINT "purchase_invoice_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoice" ADD CONSTRAINT "purchase_invoice_organization_id_supplier_id_contact_organization_id_id_fk" FOREIGN KEY ("organization_id","supplier_id") REFERENCES "public"."contact"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_invoice" ADD CONSTRAINT "purchase_invoice_organization_id_rectifies_id_purchase_invoice_organization_id_id_fk" FOREIGN KEY ("organization_id","rectifies_id") REFERENCES "public"."purchase_invoice"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_line" ADD CONSTRAINT "purchase_line_organization_id_invoice_id_purchase_invoice_organization_id_id_fk" FOREIGN KEY ("organization_id","invoice_id") REFERENCES "public"."purchase_invoice"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_payment" ADD CONSTRAINT "purchase_payment_organization_id_invoice_id_purchase_invoice_organization_id_id_fk" FOREIGN KEY ("organization_id","invoice_id") REFERENCES "public"."purchase_invoice"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expense_organization_id_date_index" ON "expense" USING btree ("organization_id","date");--> statement-breakpoint
CREATE INDEX "purchase_invoice_organization_id_booked_on_index" ON "purchase_invoice" USING btree ("organization_id","booked_on");