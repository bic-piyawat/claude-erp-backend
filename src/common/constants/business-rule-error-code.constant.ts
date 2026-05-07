/**
 * Error `code` strings included in HttpException payloads that the frontend
 * branches on (e.g., to show a specific toast or recovery flow).
 *
 * Important: the codebase consistently uses HTTP **422** UNPROCESSABLE_ENTITY
 * with `code: BUSINESS_RULE_VIOLATION` for business-rule failures — NOT 400.
 * Throwing pattern:
 *
 *   throw new HttpException(
 *     {
 *       statusCode: 422,
 *       code: BUSINESS_RULE_ERROR_CODE.BUSINESS_RULE_VIOLATION,
 *       message: 'Specific human-readable message',
 *     },
 *     HttpStatus.UNPROCESSABLE_ENTITY,
 *   );
 *
 * Five service files previously each declared their own
 * `const BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION'`. Consolidated
 * here so adding a new error code (e.g., BUDGET_LOCKED) is one place.
 *
 * See coding-standard/TDD-backend-nestjs-coding-standard.md → No Hardcoding
 * Policy for the pattern this file follows.
 */
export const BUSINESS_RULE_ERROR_CODE = {
  /** Generic business-rule failure (422). Most common. */
  BUSINESS_RULE_VIOLATION: 'BUSINESS_RULE_VIOLATION',
  /** Reserved for budget-lock writes (cost-item edits when project is WON). */
  BUDGET_LOCKED: 'BUDGET_LOCKED',
} as const;

export type BusinessRuleErrorCode =
  (typeof BUSINESS_RULE_ERROR_CODE)[keyof typeof BUSINESS_RULE_ERROR_CODE];
