export const ISSUE_TYPES = [
  'CONNECTOR_DAMAGED',
  'PAYMENT_TERMINAL_BROKEN',
  'CHARGER_OFFLINE',
  'OTHER',
] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];
