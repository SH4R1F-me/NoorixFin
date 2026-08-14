/** One API origin for every live browser and direct-contract request. */
export const E2E_API_URL =
  process.env.E2E_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';
