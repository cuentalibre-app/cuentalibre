CREATE TABLE "contact" (
	"organization_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"role" text NOT NULL,
	"name" text NOT NULL,
	"tax_id" text NOT NULL,
	"address" text,
	"postal_code" text,
	"city" text,
	"province" text,
	"country" text,
	"email" text,
	"phone" text,
	"mobile" text,
	"fax" text,
	"website" text,
	"vies" boolean,
	"discount" numeric(5, 2),
	"withholding" text,
	"payment_method_id" text,
	"language" text,
	"number_format" text,
	"bank_accounts" jsonb,
	"e_invoice" jsonb,
	"custom1" text,
	"custom2" text,
	"notes" text,
	"tags" text[],
	"attachments" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "contact_organization_id_id_pk" PRIMARY KEY("organization_id","id"),
	CONSTRAINT "contact_role_check" CHECK ("contact"."role" in ('client', 'supplier'))
);
--> statement-breakpoint
CREATE TABLE "change_log" (
	"seq" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "change_log_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"organization_id" uuid NOT NULL,
	"entity" text NOT NULL,
	"record_id" uuid NOT NULL,
	"op" text NOT NULL,
	"user_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact" ADD CONSTRAINT "contact_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_log" ADD CONSTRAINT "change_log_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_log" ADD CONSTRAINT "change_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_organization_id_role_index" ON "contact" USING btree ("organization_id","role");--> statement-breakpoint
CREATE INDEX "change_log_organization_id_seq_index" ON "change_log" USING btree ("organization_id","seq");