-- The ledger accounts page is gone: nothing exported with them
DELETE FROM "organization_setting" WHERE "section" = 'ledgerAccounts';
