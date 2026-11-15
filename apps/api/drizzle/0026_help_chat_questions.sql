CREATE TABLE "ai_chat_question" (
	"organization_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"day" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer,
	"cached_input_tokens" integer,
	"output_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_chat_question_organization_id_id_pk" PRIMARY KEY("organization_id","id")
);
--> statement-breakpoint
ALTER TABLE "ai_chat_question" ADD CONSTRAINT "ai_chat_question_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_chat_question_organization_id_day_index" ON "ai_chat_question" USING btree ("organization_id","day");