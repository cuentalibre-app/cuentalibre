CREATE TABLE "ai_reading" (
	"organization_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"month" text NOT NULL,
	"file_hash" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"source" text,
	"answer" jsonb,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_micros" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_reading_organization_id_id_pk" PRIMARY KEY("organization_id","id"),
	CONSTRAINT "ai_reading_source_check" CHECK ("ai_reading"."source" in ('text', 'image', 'pdf'))
);
--> statement-breakpoint
ALTER TABLE "ai_reading" ADD CONSTRAINT "ai_reading_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_reading_organization_id_month_index" ON "ai_reading" USING btree ("organization_id","month");--> statement-breakpoint
CREATE INDEX "ai_reading_organization_id_file_hash_index" ON "ai_reading" USING btree ("organization_id","file_hash");