/**
 * Action codes recorded on `AuditLog.action`.
 *
 * Single source of truth for audit-log action strings. Anywhere you'd write
 * `action: 'STATUS_CHANGE'` — import from here so renames or additions are
 * a one-place edit and the type system catches typos at the call site.
 *
 * See coding-standard/TDD-backend-nestjs-coding-standard.md → No Hardcoding
 * Policy for the pattern this file follows.
 */
export const AUDIT_ACTION = {
  /** Project status transition via PATCH /projects/:id/status. */
  STATUS_CHANGE: 'STATUS_CHANGE',
  /** Budget locked when project transitions into WON. */
  BUDGET_LOCK: 'BUDGET_LOCK',
  /** Budget unlocked manually by SUPER_ADMIN/FOUNDER. */
  UNLOCK: 'UNLOCK',
  /** Product.lastPrice + lastUpdatedDate synced from cost-item snapshot at WON. */
  PRODUCT_LASTPRICE_SYNC: 'PRODUCT_LASTPRICE_SYNC',
  /** Cost-item bulk replace — one entry per affected item. */
  BULK_REPLACE: 'BULK_REPLACE',
  /** Master-sync apply — propagating master data into a project's budget. */
  SYNC_MASTER: 'SYNC_MASTER',
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];
