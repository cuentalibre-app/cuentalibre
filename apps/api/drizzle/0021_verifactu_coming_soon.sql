-- cuentalibre Cloud can't send VERI*FACTU records for its users yet (#222): every business goes back to exempt,
-- and the submissions and census checks waiting in the outbox are dropped.
WITH reset AS (
	UPDATE "organization_setting"
	SET "data" = jsonb_set("data", '{system}', '"exempt"')
	WHERE "section" = 'verifactu' AND "data"->>'system' = 'verifactu'
	RETURNING "organization_id"
)
INSERT INTO "change_log" ("organization_id", "entity", "record_id", "op")
SELECT "organization_id", 'organization_setting', 'verifactu', 'saveSettings' FROM reset;
--> statement-breakpoint
DELETE FROM "outbox"
WHERE "topic" IN ('verifactu', 'census') AND "done_at" IS NULL AND "failed_at" IS NULL;
