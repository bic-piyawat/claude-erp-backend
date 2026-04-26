-- Migration: user_profile_fields
-- Adds firstName, lastName, avatarUrl to the users table.
-- Three-step pattern (add nullable -> backfill -> enforce NOT NULL) so it
-- applies cleanly to an already-populated table.
--
-- Rollback (down) SQL — apply manually if reverting:
--   ALTER TABLE `users`
--     DROP COLUMN `firstName`,
--     DROP COLUMN `lastName`,
--     DROP COLUMN `avatarUrl`;

-- Step 1: add the new columns as nullable.
ALTER TABLE `users`
    ADD COLUMN `firstName` VARCHAR(191) NULL,
    ADD COLUMN `lastName`  VARCHAR(191) NULL,
    ADD COLUMN `avatarUrl` VARCHAR(191) NULL;

-- Step 2: backfill existing rows. Derive first/last from the email local-part
-- (e.g. "founder@acme.test" -> firstName="founder", lastName="User"; or
-- "qa.stage.founder@acme.test" -> firstName="qa", lastName="founder").
UPDATE `users`
SET `firstName` = SUBSTRING_INDEX(SUBSTRING_INDEX(`email`, '@', 1), '.', 1),
    `lastName`  = COALESCE(
        NULLIF(
            SUBSTRING_INDEX(SUBSTRING_INDEX(`email`, '@', 1), '.', -1),
            SUBSTRING_INDEX(SUBSTRING_INDEX(`email`, '@', 1), '.', 1)
        ),
        'User'
    )
WHERE `firstName` IS NULL;

-- Step 3: enforce NOT NULL on the populated columns.
ALTER TABLE `users`
    MODIFY `firstName` VARCHAR(191) NOT NULL,
    MODIFY `lastName`  VARCHAR(191) NOT NULL;
