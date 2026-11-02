CREATE TABLE "tax_id_check" (
	"organization_id" uuid NOT NULL,
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"tax_id" text NOT NULL,
	"name" text NOT NULL,
	"result" text NOT NULL,
	"census_name" text NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	CONSTRAINT "tax_id_check_organization_id_id_pk" PRIMARY KEY("organization_id","id"),
	CONSTRAINT "tax_id_check_organizationId_taxId_name_unique" UNIQUE("organization_id","tax_id","name")
);
--> statement-breakpoint
ALTER TABLE "tax_id_check" ADD CONSTRAINT "tax_id_check_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;