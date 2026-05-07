-- Convert vatRate from percent form (e.g. 7) to decimal form (e.g. 0.07) so
-- frontend and backend agree on the unit. Data UPDATE runs FIRST so existing
-- 7-valued rows become 0.07 BEFORE the new default takes effect on inserts.
-- The WHERE >= 1 guard makes the data step idempotent against re-runs.

UPDATE `Budget`
SET `vatRate` = `vatRate` / 100
WHERE `vatRate` >= 1;

UPDATE `OrganizationSettings`
SET `vatRate` = `vatRate` / 100
WHERE `vatRate` >= 1;

-- AlterTable
ALTER TABLE `Budget` MODIFY `vatRate` DOUBLE NOT NULL DEFAULT 0.07;

-- AlterTable
ALTER TABLE `OrganizationSettings` MODIFY `vatRate` DOUBLE NOT NULL DEFAULT 0.07;
