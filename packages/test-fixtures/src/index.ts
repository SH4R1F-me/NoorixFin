/**
 * @myfin/test-fixtures — Reusable test data
 * Based on Blueprint §9 canonical data model
 * Updated for simplified 2-role system (DEC-007)
 */

import type { Profile, Workspace, WorkspaceMember } from '@myfin/domain';

// ─── Users ───────────────────────────────────────────────────────────

export const TEST_USER_A = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  email: 'alice@example.com',
  password: 'TestPassword123!',
};

export const TEST_USER_B = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  email: 'bob@example.com',
  password: 'TestPassword456!',
};

// ─── Profiles ────────────────────────────────────────────────────────

export const PROFILE_A: Profile = {
  id: TEST_USER_A.id,
  displayName: 'Alice',
  avatarPath: null,
  locale: 'bn',
  timezone: 'Asia/Dhaka',
  baseCurrency: 'BDT',
  weekStartsOn: 6, // Saturday
  amountPrivacyDefault: false,
  isSuperAdmin: true, // Alice is SUPER_ADMIN
  onboardingStatus: 'COMPLETED',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

export const PROFILE_B: Profile = {
  id: TEST_USER_B.id,
  displayName: 'Bob',
  avatarPath: null,
  locale: 'en',
  timezone: 'Asia/Riyadh',
  baseCurrency: 'SAR',
  weekStartsOn: 0, // Sunday
  amountPrivacyDefault: false,
  isSuperAdmin: false, // Bob is regular USER
  onboardingStatus: 'COMPLETED',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

// ─── Workspaces (PERSONAL only — DEC-007) ────────────────────────────

export const WORKSPACE_A_PERSONAL: Workspace = {
  id: '11111111-1111-1111-1111-111111111111',
  type: 'PERSONAL',
  name: 'Alice Personal',
  baseCurrency: 'BDT',
  timezone: 'Asia/Dhaka',
  createdBy: TEST_USER_A.id,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

export const WORKSPACE_B_PERSONAL: Workspace = {
  id: '22222222-2222-2222-2222-222222222222',
  type: 'PERSONAL',
  name: 'Bob Personal',
  baseCurrency: 'SAR',
  timezone: 'Asia/Riyadh',
  createdBy: TEST_USER_B.id,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

// ─── Members (all OWNER — DEC-007) ──────────────────────────────────

export const MEMBER_A_PERSONAL: WorkspaceMember = {
  workspaceId: WORKSPACE_A_PERSONAL.id,
  userId: TEST_USER_A.id,
  role: 'OWNER',
  status: 'ACTIVE',
  joinedAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

export const MEMBER_B_PERSONAL: WorkspaceMember = {
  workspaceId: WORKSPACE_B_PERSONAL.id,
  userId: TEST_USER_B.id,
  role: 'OWNER',
  status: 'ACTIVE',
  joinedAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};
