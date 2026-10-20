CREATE TABLE "email_message" (
	"organization_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"document_id" uuid,
	"to" text[] NOT NULL,
	"cc" text[] NOT NULL,
	"reply_to" text,
	"from_name" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"attachments" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"sent_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "email_message_organization_id_id_pk" PRIMARY KEY("organization_id","id"),
	CONSTRAINT "email_message_status_check" CHECK ("email_message"."status" in ('queued', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "outbox_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"organization_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"key" text,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_at" timestamp with time zone,
	"failed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "verifactu_record" (
	"organization_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"position" integer NOT NULL,
	"invoice_id" uuid NOT NULL,
	"issuer_tax_id" text NOT NULL,
	"number" text NOT NULL,
	"issued_on" date NOT NULL,
	"invoice_type" text NOT NULL,
	"total_tax" bigint NOT NULL,
	"total" bigint NOT NULL,
	"previous_hash" text,
	"hash" text NOT NULL,
	"generated_at" text NOT NULL,
	"data" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_code" text,
	"error" text,
	"csv" text,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verifactu_record_organization_id_id_pk" PRIMARY KEY("organization_id","id"),
	CONSTRAINT "verifactu_record_organizationId_position_unique" UNIQUE("organization_id","position"),
	CONSTRAINT "verifactu_record_organizationId_invoiceId_unique" UNIQUE("organization_id","invoice_id"),
	CONSTRAINT "verifactu_record_status_check" CHECK ("verifactu_record"."status" in ('pending', 'accepted', 'acceptedWithErrors', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "verifactu_state" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"next_send_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_message" ADD CONSTRAINT "email_message_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_message" ADD CONSTRAINT "email_message_sent_by_user_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_message" ADD CONSTRAINT "email_message_organization_id_document_id_sales_document_organization_id_id_fk" FOREIGN KEY ("organization_id","document_id") REFERENCES "public"."sales_document"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifactu_record" ADD CONSTRAINT "verifactu_record_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifactu_record" ADD CONSTRAINT "verifactu_record_organization_id_invoice_id_sales_document_organization_id_id_fk" FOREIGN KEY ("organization_id","invoice_id") REFERENCES "public"."sales_document"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verifactu_state" ADD CONSTRAINT "verifactu_state_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_message_organization_id_document_id_index" ON "email_message" USING btree ("organization_id","document_id");--> statement-breakpoint
CREATE INDEX "outbox_run_after_index" ON "outbox" USING btree ("run_after") WHERE "outbox"."done_at" is null and "outbox"."failed_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_organization_id_key_index" ON "outbox" USING btree ("organization_id","key") WHERE "outbox"."key" is not null and "outbox"."done_at" is null and "outbox"."failed_at" is null;--> statement-breakpoint
CREATE INDEX "verifactu_record_organization_id_position_index" ON "verifactu_record" USING btree ("organization_id","position") WHERE "verifactu_record"."status" = 'pending';