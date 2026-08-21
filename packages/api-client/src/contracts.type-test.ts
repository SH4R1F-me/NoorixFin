/**
 * Compile-time contract suite for every mobile route and the financial/admin
 * writes most likely to cause data loss. `tsc --noEmit` is the test runner:
 * route removal, method drift, request DTO drift, or response-envelope drift
 * fails the static CI job before either application can ship.
 */
import type {
  ApiRuntimePath,
  ApiRuntimePathForMethod,
  ApiRuntimeRequestBody,
  ApiRuntimeResponse,
} from './index';

type Assert<T extends true> = T;

const workspaceId = '00000000-0000-4000-8000-000000000001';
const resourceId = '00000000-0000-4000-8000-000000000002';

// Every route invoked by apps/mobile (including the durable mutation queue).
export const mobileGetRoutes = [
  '/workspaces',
  `/workspaces/${workspaceId}/sync?cursor=eyJ2IjoxLCJzb3VyY2VzIjp7fX0`,
  `/workspaces/${workspaceId}/budget`,
  `/workspaces/${workspaceId}/goals`,
  '/me',
  `/me/exports/${resourceId}/download`,
  '/me/devices',
  '/me/notification-preferences',
  '/notifications/unread-count',
] as const satisfies readonly ApiRuntimePathForMethod<'GET'>[];

export const mobilePostRoutes = [
  '/me/exports',
  '/me/devices',
  '/me/devices/pairing/consume',
  `/notifications/${resourceId}/read`,
  '/notifications/read-all',
  `/workspaces/${workspaceId}/transactions`,
  `/workspaces/${workspaceId}/transactions/${resourceId}/reverse`,
] as const satisfies readonly ApiRuntimePathForMethod<'POST'>[];

export const mobileDeleteRoutes = [
  `/me/exports/${resourceId}`,
  `/me/devices/${resourceId}`,
  `/me/devices/current/${resourceId}`,
] as const satisfies readonly ApiRuntimePathForMethod<'DELETE'>[];

export const mobilePatchRoutes = [
  '/me/preferences',
] as const satisfies readonly ApiRuntimePathForMethod<'PATCH'>[];
export const mobilePutRoutes = [
  '/me/notification-preferences',
] as const satisfies readonly ApiRuntimePathForMethod<'PUT'>[];

// Critical web writes: ledger, planning, account security, and operator controls.
export const criticalWebRoutes = [
  `/workspaces/${workspaceId}/accounts`,
  `/workspaces/${workspaceId}/categories`,
  `/workspaces/${workspaceId}/transactions`,
  `/workspaces/${workspaceId}/budget`,
  `/workspaces/${workspaceId}/goals`,
  `/workspaces/${workspaceId}/calendar`,
  `/workspaces/${workspaceId}/recurring`,
  `/admin/users/${resourceId}/suspend`,
  '/admin/settings',
  '/admin/notifications',
] as const satisfies readonly ApiRuntimePath[];

export const createWorkspaceBody = {
  name: 'Personal finance',
  base_currency: 'SAR',
  timezone: 'Asia/Riyadh',
} satisfies ApiRuntimeRequestBody<'/workspaces', 'POST'>;

export const createTransactionBody = {
  type: 'EXPENSE',
  amount: '1250',
  account_id: resourceId,
  category_id: resourceId,
  idempotency_key: resourceId,
} satisfies ApiRuntimeRequestBody<`/workspaces/${string}/transactions`, 'POST'>;

export const updatePreferencesBody = {
  display_name: 'NoorixFin User',
  locale: 'en',
} satisfies ApiRuntimeRequestBody<'/me/preferences', 'PATCH'>;

export const notificationPreferencesBody = {
  preferences: [{ category: 'security', in_app: true, push: true, email: true, digest: 'NONE' }],
  quiet_hours_tz: 'Asia/Riyadh',
} satisfies ApiRuntimeRequestBody<'/me/notification-preferences', 'PUT'>;

// Response envelopes that mobile consumes without a runtime adapter.
export type WorkspaceListIsArray = Assert<
  ApiRuntimeResponse<'/workspaces', 'GET'> extends readonly unknown[] ? true : false
>;
export type WorkspaceListRejectsObject = Assert<
  { id: string } extends ApiRuntimeResponse<'/workspaces', 'GET'> ? false : true
>;
export type ProfileHasDisplayName = Assert<
  ApiRuntimeResponse<'/me', 'GET'> extends { display_name: string } ? true : false
>;
export type BudgetHasVisibility = Assert<
  ApiRuntimeResponse<`/workspaces/${string}/budget`, 'GET'> extends { visible: boolean }
    ? true
    : false
>;
export type GoalsHasArray = Assert<
  ApiRuntimeResponse<`/workspaces/${string}/goals`, 'GET'> extends {
    goals?: readonly unknown[];
  }
    ? true
    : false
>;
export type DevicesIsArray = Assert<
  ApiRuntimeResponse<'/me/devices', 'GET'> extends readonly unknown[] ? true : false
>;
export type NotificationPreferencesHaveRows = Assert<
  ApiRuntimeResponse<'/me/notification-preferences', 'GET'> extends {
    preferences: readonly unknown[];
  }
    ? true
    : false
>;
export type SyncHasCompositePayload = Assert<
  ApiRuntimeResponse<`/workspaces/${string}/sync`, 'GET'> extends {
    cursor: string;
    changes: unknown;
  }
    ? true
    : false
>;
export type SignedAttachmentHasUrl = Assert<
  ApiRuntimeResponse<
    `/workspaces/${string}/transactions/${string}/attachments/${string}`,
    'GET'
  > extends { url: string; expires_in: number }
    ? true
    : false
>;
export type UnreadCountHasCount = Assert<
  ApiRuntimeResponse<'/notifications/unread-count', 'GET'> extends { count: number } ? true : false
>;

declare const generatedProfile: ApiRuntimeResponse<'/me', 'GET'>;
declare const generatedBudget: ApiRuntimeResponse<`/workspaces/${string}/budget`, 'GET'>;
// @ts-expect-error callers cannot invent fields absent from the published profile response
generatedProfile.operator_role;
// @ts-expect-error callers cannot invent a response envelope around the published budget payload
generatedBudget.data;

// Negative compilation checks are intentional acceptance criteria.
// @ts-expect-error nonexistent routes must never reach a transport
export const invalidRoute: ApiRuntimePath = '/billing/checkout';
// @ts-expect-error a GET-only path cannot be sent as POST
export const invalidMethod: ApiRuntimePathForMethod<'POST'> = `/me/exports/${resourceId}/download`;
// @ts-expect-error amount is a minor-unit string, never a floating-point JSON number
export const invalidTransactionBody: ApiRuntimeRequestBody<
  `/workspaces/${string}/transactions`,
  'POST'
> = { type: 'EXPENSE', amount: 12.5, account_id: resourceId, idempotency_key: resourceId };
