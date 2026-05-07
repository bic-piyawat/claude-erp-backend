/**
 * VAT-related defaults.
 *
 * `vatRate` is stored as a decimal (e.g. 0.07 for 7%) per PR #20 — both
 * `Budget.vatRate` and `OrganizationSettings.vatRate` use the decimal form
 * so frontend and backend agree without converting at the boundary. The
 * profitability-service formula uses `1 + vatRate` directly (no /100).
 *
 * The fallback constant here is what the backend returns when settings rows
 * don't exist yet (org just created, no settings UI yet). The Prisma schema
 * also declares `@default(0.07)` on both columns, so new INSERTs get the
 * same value at the DB level.
 */
export const VAT = {
  /** Thai standard VAT rate, used as the fallback when settings are missing. */
  DEFAULT_RATE: 0.07,
} as const;
