CREATE TABLE "catalog_family" (
	"organization_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "catalog_family_organization_id_id_pk" PRIMARY KEY("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "product" (
	"organization_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"family_id" uuid,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"private_notes" text NOT NULL,
	"unit" text,
	"tags" text[] NOT NULL,
	"active" boolean NOT NULL,
	"sku" text NOT NULL,
	"supplier_ref" text NOT NULL,
	"price" numeric(18, 6) NOT NULL,
	"discount" numeric(9, 6) NOT NULL,
	"vat_rate" numeric(6, 4) NOT NULL,
	"surcharge_rate" numeric(6, 4) NOT NULL,
	"cost" numeric(18, 6),
	"cost_vat_rate" numeric(6, 4) NOT NULL,
	"cost_surcharge_rate" numeric(6, 4) NOT NULL,
	"custom" text[] NOT NULL,
	"stock" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "product_organization_id_id_pk" PRIMARY KEY("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "stock_movement" (
	"organization_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" numeric(18, 6) NOT NULL,
	"at" text NOT NULL,
	"kind" text NOT NULL,
	"reason" text,
	"comments" text,
	"document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "stock_movement_organization_id_id_pk" PRIMARY KEY("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "filed_return" (
	"organization_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"form" text NOT NULL,
	"period" text NOT NULL,
	"boxes" jsonb NOT NULL,
	"result" bigint NOT NULL,
	"filed_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "filed_return_organization_id_id_pk" PRIMARY KEY("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "organization_setting" (
	"organization_id" uuid NOT NULL,
	"section" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_setting_organization_id_section_pk" PRIMARY KEY("organization_id","section")
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"organization_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "tag_organization_id_id_pk" PRIMARY KEY("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "bank_movement" (
	"organization_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"date" date NOT NULL,
	"concept" text NOT NULL,
	"reference" text NOT NULL,
	"amount" bigint NOT NULL,
	"balance" bigint,
	"source" text NOT NULL,
	"payment_keys" text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "bank_movement_organization_id_id_pk" PRIMARY KEY("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "manual_payment" (
	"organization_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"date" date NOT NULL,
	"amount" bigint NOT NULL,
	"payment_method_id" uuid NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "manual_payment_organization_id_id_pk" PRIMARY KEY("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "payment_method" (
	"organization_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"number" text NOT NULL,
	"account_id" uuid,
	"active" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "payment_method_organization_id_id_pk" PRIMARY KEY("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "treasury_account" (
	"organization_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"number" text NOT NULL,
	"active" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "treasury_account_organization_id_id_pk" PRIMARY KEY("organization_id","id")
);
--> statement-breakpoint
ALTER TABLE "catalog_family" ADD CONSTRAINT "catalog_family_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_family" ADD CONSTRAINT "catalog_family_organization_id_parent_id_catalog_family_organization_id_id_fk" FOREIGN KEY ("organization_id","parent_id") REFERENCES "public"."catalog_family"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_organization_id_family_id_catalog_family_organization_id_id_fk" FOREIGN KEY ("organization_id","family_id") REFERENCES "public"."catalog_family"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_organization_id_product_id_product_organization_id_id_fk" FOREIGN KEY ("organization_id","product_id") REFERENCES "public"."product"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filed_return" ADD CONSTRAINT "filed_return_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_setting" ADD CONSTRAINT "organization_setting_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_movement" ADD CONSTRAINT "bank_movement_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_movement" ADD CONSTRAINT "bank_movement_organization_id_account_id_treasury_account_organization_id_id_fk" FOREIGN KEY ("organization_id","account_id") REFERENCES "public"."treasury_account"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payment" ADD CONSTRAINT "manual_payment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_payment" ADD CONSTRAINT "manual_payment_organization_id_payment_method_id_payment_method_organization_id_id_fk" FOREIGN KEY ("organization_id","payment_method_id") REFERENCES "public"."payment_method"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_method" ADD CONSTRAINT "payment_method_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_method" ADD CONSTRAINT "payment_method_organization_id_account_id_treasury_account_organization_id_id_fk" FOREIGN KEY ("organization_id","account_id") REFERENCES "public"."treasury_account"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_account" ADD CONSTRAINT "treasury_account_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_movement_organization_id_product_id_index" ON "stock_movement" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE INDEX "filed_return_organization_id_form_period_index" ON "filed_return" USING btree ("organization_id","form","period");--> statement-breakpoint
CREATE INDEX "bank_movement_organization_id_account_id_date_index" ON "bank_movement" USING btree ("organization_id","account_id","date");