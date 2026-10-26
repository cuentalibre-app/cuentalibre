-- PDF signing was never built: drop the setting nothing reads (#25)
DELETE FROM "organization_setting" WHERE "section" = 'signing';
