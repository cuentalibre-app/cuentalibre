-- Bank movements and reconciliation were dropped (#188); every environment holds test data only
DROP TABLE "bank_movement" CASCADE;
--> statement-breakpoint
DELETE FROM "change_log" WHERE "entity" = 'bank_movement';
