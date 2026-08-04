/**
 * @noorixfin/domain — Shared domain types and constants
 * Based on NoorixFin Production Blueprint §9 (Canonical Data Model)
 */

// ─── Enums ───────────────────────────────────────────────────────────

/** Workspace types — simplified to PERSONAL only (DEC-007) */
export type WorkspaceType = 'PERSONAL';

/** Blueprint §9.2: workspace status */
export type WorkspaceStatus = 'ACTIVE' | 'PENDING_DELETION' | 'DELETED';

/** Workspace member role — simplified: all members are OWNER (DEC-007) */
export type MemberRole = 'OWNER';

/** System-level role — SUPER_ADMIN has full system access, USER manages own finances */
export type SystemRole = 'SUPER_ADMIN' | 'USER';

/** Member status — simplified: removed INVITED (no invitation system) */
export type MemberStatus = 'ACTIVE' | 'SUSPENDED' | 'LEFT';

/** Blueprint §9.3: ledger account classes */
export type AccountClass = 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE' | 'EQUITY';

/** Blueprint §9.3: ledger account subtypes */
export type AccountSubtype =
  | 'CASH'
  | 'BANK'
  | 'MOBILE_WALLET'
  | 'CREDIT_CARD'
  | 'LOAN'
  | 'SAVINGS'
  | 'CATEGORY'
  | 'SYSTEM';

/** Blueprint §9.3: normal balance direction */
export type NormalBalance = 'DEBIT' | 'CREDIT';

/** Blueprint §9.3: journal entry types */
export type EntryType =
  | 'INCOME'
  | 'EXPENSE'
  | 'TRANSFER'
  | 'ADJUSTMENT'
  | 'OPENING'
  | 'REVERSAL';

/** Blueprint §9.3: entry status */
export type EntryStatus = 'DRAFT' | 'PENDING' | 'POSTED' | 'VOIDED';

/** Blueprint §9.3: entry source */
export type EntrySource = 'MANUAL' | 'IMPORT' | 'RECURRING' | 'SYSTEM';

/** Blueprint §9.3: category kind */
export type CategoryKind = 'INCOME' | 'EXPENSE';

/** Blueprint §9.4: recurring rule behavior */
export type RecurringBehavior = 'REMIND_ONLY' | 'AUTO_CREATE_DRAFT';

/** Blueprint §9.4: calendar event type */
export type CalendarEventType = 'BILL' | 'INCOME' | 'GOAL' | 'CUSTOM';

/** Blueprint §9.4: calendar event status */
export type CalendarEventStatus = 'UPCOMING' | 'DUE' | 'PAID' | 'SKIPPED' | 'OVERDUE';

/** Blueprint §15.1: attachment scan status */
export type ScanStatus = 'PENDING' | 'CLEAN' | 'REJECTED';

/** Onboarding status */
export type OnboardingStatus =
  | 'LANGUAGE_SELECTED'
  | 'ACCOUNT_CREATED'
  | 'PREFERENCES_SET'
  | 'PERSONA_SELECTED'
  | 'WORKSPACE_CREATED'
  | 'FIRST_ACCOUNT_ADDED'
  | 'COMPLETED';

/** User persona selection (§5.2 step 4) */
export type UserPersona = 'INDIVIDUAL' | 'STUDENT' | 'FAMILY' | 'FREELANCER';

// ─── Core Interfaces ─────────────────────────────────────────────────

export interface Profile {
  id: string;
  displayName: string;
  avatarPath: string | null;
  locale: string;
  timezone: string;
  baseCurrency: string;
  weekStartsOn: number;
  amountPrivacyDefault: boolean;
  /** System-level admin flag (DEC-007) */
  isSuperAdmin: boolean;
  onboardingStatus: OnboardingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: string;
  type: WorkspaceType;
  name: string;
  baseCurrency: string;
  timezone: string;
  createdBy: string;
  status: WorkspaceStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: string;
  updatedAt: string;
}

export interface LedgerAccount {
  id: string;
  workspaceId: string;
  name: string;
  class: AccountClass;
  subtype: AccountSubtype;
  currencyCode: string;
  normalBalance: NormalBalance;
  includeInBudget: boolean;
  includeInNetWorth: boolean;
  openingDate: string;
  archivedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface Category {
  id: string;
  workspaceId: string | null;
  ledgerAccountId: string;
  kind: CategoryKind;
  parentId: string | null;
  translationKey: string | null;
  customName: string | null;
  icon: string;
  color: string;
  sortOrder: number;
  archivedAt: string | null;
}

export interface JournalEntry {
  id: string;
  workspaceId: string;
  entryType: EntryType;
  occurredAt: string;
  localDate: string;
  payee: string | null;
  note: string | null;
  status: EntryStatus;
  source: EntrySource;
  clientEntryId: string;
  idempotencyKeyHash: string | null;
  reversesEntryId: string | null;
  createdBy: string;
  postedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface JournalPosting {
  id: string;
  journalEntryId: string;
  ledgerAccountId: string;
  /** Minor-unit integer as decimal string per §8.1 */
  debitMinor: string;
  /** Minor-unit integer as decimal string per §8.1 */
  creditMinor: string;
  currencyCode: string;
  baseAmountMinor: string;
  fxRate: string | null;
  memo: string | null;
}

export interface Budget {
  id: string;
  workspaceId: string;
  name: string;
  cadence: 'WEEKLY' | 'MONTHLY';
  startDate: string;
  endDate: string | null;
  rolloverPolicy: 'NONE' | 'CARRY_FORWARD';
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface BudgetLine {
  id: string;
  budgetId: string;
  categoryId: string;
  plannedMinor: string;
  carryInMinor: string;
  carryOutMinor: string;
  alertThreshold: number | null;
}

export interface SavingsGoal {
  id: string;
  workspaceId: string;
  name: string;
  targetAmountMinor: string;
  currencyCode: string;
  targetDate: string | null;
  status: 'ACTIVE' | 'REACHED' | 'CANCELLED';
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface DebtDetail {
  id: string;
  ledgerAccountId: string;
  principalMinor: string;
  annualRate: string | null;
  minimumPaymentMinor: string | null;
  dueDay: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringRule {
  id: string;
  workspaceId: string;
  behavior: RecurringBehavior;
  recurrenceRule: string;
  timezone: string;
  nextOccurrence: string;
  status: 'ACTIVE' | 'PAUSED' | 'ENDED';
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  workspaceId: string;
  type: CalendarEventType;
  dueAt: string;
  timezone: string;
  recurrenceRule: string | null;
  reminderOffsets: number[];
  linkedRuleId: string | null;
  linkedEntryId: string | null;
  status: CalendarEventStatus;
}

export interface Tag {
  id: string;
  workspaceId: string;
  name: string;
}

export interface Attachment {
  id: string;
  journalEntryId: string;
  storagePath: string;
  checksum: string;
  mimeType: string;
  sizeBytes: number;
  scanStatus: ScanStatus;
  createdAt: string;
}

// ─── API Types ───────────────────────────────────────────────────────

export interface ApiError {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  requestId: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  cursor: string | null;
  hasMore: boolean;
}

// ─── Utility ─────────────────────────────────────────────────────────

/** Account class to normal balance mapping (standard accounting) */
export const ACCOUNT_CLASS_NORMAL_BALANCE: Record<AccountClass, NormalBalance> = {
  ASSET: 'DEBIT',
  LIABILITY: 'CREDIT',
  INCOME: 'CREDIT',
  EXPENSE: 'DEBIT',
  EQUITY: 'CREDIT',
};
