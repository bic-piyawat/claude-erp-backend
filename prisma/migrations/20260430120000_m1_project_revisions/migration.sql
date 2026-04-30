-- M1 — Project schema revisions (PRJ-042, PRJ-049, PRJ-054, PRJ-061)
--
-- This migration:
--   1. Widens Project.status to allow OLD + NEW enum values transiently.
--   2. Backfills status from current Stage names (PRJ-061 mapping).
--   3. Defensively remaps any legacy enum values still on the column.
--   4. Renames Project.estimatedRevenue -> Project.totalProjectPrice (data preserving).
--   5. Adds Project.customerPoIssuedDate (nullable).
--   6. Narrows Project.status to the final 8-member enum, default DRAFT.
--
-- The transient widened-enum window lives entirely inside this single migration file
-- (no operator gap), as agreed for the auto-deploy-on-merge model.

-- Step 1: widen Project.status to allow OLD + NEW transiently
ALTER TABLE `Project`
  MODIFY COLUMN `status` ENUM(
    'ACTIVE','CLOSED_WON','CLOSED_LOST','ON_HOLD',
    'DRAFT','PROPOSED','QUOTATION_SENT','UNDER_NEGOTIATION','AWAITING_PO','WON','LOST'
  ) NOT NULL DEFAULT 'ACTIVE';

-- Step 2: backfill from current stage names (PRJ-061)
UPDATE `Project` p
LEFT JOIN `Stage` s ON s.id = p.stageId
SET p.status = CASE
  WHEN s.name = 'Lead'              THEN 'DRAFT'
  WHEN s.name = 'Qualification'     THEN 'DRAFT'
  WHEN s.name = 'Proposal'          THEN 'PROPOSED'
  WHEN s.name = 'Negotiation'       THEN 'UNDER_NEGOTIATION'
  WHEN s.name = 'Closed Won'        THEN 'WON'
  WHEN s.name = 'Closed Lost'       THEN 'LOST'
  ELSE 'DRAFT'
END;

-- Step 3: defensive remap of legacy enum values still on the column
UPDATE `Project` SET status = 'WON'   WHERE status = 'CLOSED_WON';
UPDATE `Project` SET status = 'LOST'  WHERE status = 'CLOSED_LOST';
UPDATE `Project` SET status = 'DRAFT' WHERE status = 'ACTIVE';

-- Step 4: rename estimatedRevenue -> totalProjectPrice (PRJ-049)
ALTER TABLE `Project`
  CHANGE COLUMN `estimatedRevenue` `totalProjectPrice` DOUBLE NULL;

-- Step 5: add customerPoIssuedDate (PRJ-054)
ALTER TABLE `Project`
  ADD COLUMN `customerPoIssuedDate` DATETIME(3) NULL;

-- Step 6: narrow status enum to final form, change default
ALTER TABLE `Project`
  MODIFY COLUMN `status` ENUM(
    'DRAFT','PROPOSED','QUOTATION_SENT','UNDER_NEGOTIATION','AWAITING_PO','WON','LOST','ON_HOLD'
  ) NOT NULL DEFAULT 'DRAFT';
