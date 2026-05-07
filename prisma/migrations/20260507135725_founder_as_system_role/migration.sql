-- Migration: founder_as_system_role
--
-- FOUNDER becomes a system-level (User-level) role rather than a per-org
-- Membership role. The platform admin (User.isFounder = true) can act in
-- any organization, regardless of the active-org Membership.role.
--
-- This migration:
--   1. Adds the User.isFounder column (default false).
--   2. Backfills isFounder=true for any user who currently holds a FOUNDER
--      Membership in any organization.
--   3. Migrates existing FOUNDER memberships to SUPER_ADMIN so those users
--      retain their org-admin powers within the orgs they founded.
--
-- The migration is idempotent: re-running on already-migrated data is a
-- no-op (the WHERE clauses no longer match).
--
-- Note: Membership.role is a String column (not the Role enum), so plain
-- string literals 'FOUNDER' / 'SUPER_ADMIN' are correct here.

-- AlterTable: add the new system-level founder flag.
ALTER TABLE `users` ADD COLUMN `isFounder` BOOLEAN NOT NULL DEFAULT false;

-- Backfill: every user who has at least one Membership with role='FOUNDER'
-- becomes a system founder.
UPDATE `users` u
SET u.`isFounder` = true
WHERE EXISTS (
  SELECT 1 FROM `memberships` m
  WHERE m.`userId` = u.`id` AND m.`role` = 'FOUNDER'
);

-- Migrate FOUNDER memberships to SUPER_ADMIN so the per-org admin
-- privileges these users had inside specific orgs are preserved.
UPDATE `memberships` SET `role` = 'SUPER_ADMIN' WHERE `role` = 'FOUNDER';
