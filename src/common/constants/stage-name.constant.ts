import { ProjectStatus } from '@prisma/client';

/**
 * Standard stage display names. Seeded once per organization (see
 * `prisma/seed.runner.ts`) and surfaced in PRJ-061 status-backfill SQL.
 *
 * Stage rows themselves live in the `Stage` table — these constants are the
 * canonical name strings used when:
 *   - service code looks up a stage by name (e.g., the suggestedStage map
 *     for project status transitions)
 *   - seeds create the standard set
 *
 * Do NOT add free-text stages here. Custom stages are an org-level concern
 * stored in the database; this file is for the seeded standard set only.
 */
export const STANDARD_STAGE_NAME = {
  LEAD: 'Lead',
  QUALIFICATION: 'Qualification',
  PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negotiation',
  CLOSED_WON: 'Closed Won',
  CLOSED_LOST: 'Closed Lost',
} as const;

export type StandardStageName =
  (typeof STANDARD_STAGE_NAME)[keyof typeof STANDARD_STAGE_NAME];

/**
 * Advisory: when a project's Status changes, suggest a Stage that aligns with
 * the new operational state. Suggestion is non-binding (Status and Stage are
 * independent per PRJ-042 BA Q1) — the user picks via PRJ-059 toast.
 *
 * Per Cluster C=B: Status `ON_HOLD` does NOT have a suggested stage (the user
 * can hold a project at any pipeline position).
 */
export const STAGE_SUGGESTION_BY_STATUS: Partial<
  Record<ProjectStatus, StandardStageName>
> = {
  DRAFT: STANDARD_STAGE_NAME.LEAD,
  PROPOSED: STANDARD_STAGE_NAME.PROPOSAL,
  QUOTATION_SENT: STANDARD_STAGE_NAME.PROPOSAL,
  UNDER_NEGOTIATION: STANDARD_STAGE_NAME.NEGOTIATION,
  AWAITING_PO: STANDARD_STAGE_NAME.NEGOTIATION,
  WON: STANDARD_STAGE_NAME.CLOSED_WON,
  LOST: STANDARD_STAGE_NAME.CLOSED_LOST,
  // ON_HOLD intentionally omitted — see comment above.
};
