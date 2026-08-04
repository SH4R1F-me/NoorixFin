/**
 * Stand-ins for React Native / Supabase modules pulled in transitively.
 *
 * `lib/api.ts` imports `lib/supabase.ts` for the access token, which reaches
 * react-native. None of that is under test here — the sync engine's SQL and
 * control flow are.
 */
export const AppState = {
  currentState: 'active',
  addEventListener: () => ({ remove: () => {} }),
};
export const Platform = { OS: 'ios', select: (o: Record<string, unknown>) => o.ios };

export const createClient = () => ({
  auth: {
    getSession: async () => ({ data: { session: { access_token: 'test-token' } } }),
    startAutoRefresh: async () => {},
    stopAutoRefresh: async () => {},
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
});

export default {};
