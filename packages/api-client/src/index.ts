/**
 * @noorixfin/api-client — OpenAPI-generated API client
 * This will be auto-generated from the NestJS API's OpenAPI spec.
 * For now, placeholder exports.
 */

export const API_VERSION = 'v1';

/** Base API path */
export function getApiUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/${API_VERSION}`;
}
