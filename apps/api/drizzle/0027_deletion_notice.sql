CREATE TABLE "deletion_notice" (
	"organization_id" uuid NOT NULL,
	"read_only_since" timestamp with time zone NOT NULL,
	"notice" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deletion_notice_organization_id_read_only_since_notice_pk" PRIMARY KEY("organization_id","read_only_since","notice")
);
--> statement-breakpoint
ALTER TABLE "deletion_notice" ADD CONSTRAINT "deletion_notice_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;