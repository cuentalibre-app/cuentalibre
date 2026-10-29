-- Treasury accounts were folded into payment methods (#189); every environment holds test data only
ALTER TABLE "payment_method" DROP COLUMN "account_id";
--> statement-breakpoint
DROP TABLE "treasury_account" CASCADE;
--> statement-breakpoint
DELETE FROM "change_log" WHERE "entity" = 'treasury_account';
