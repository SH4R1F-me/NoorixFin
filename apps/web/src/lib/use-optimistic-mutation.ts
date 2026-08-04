'use client';

/**
 * Optimistic mutation with mandatory rollback — DEC-012.
 *
 * The rule this encodes: **rollback is not optional.** A write that fails must
 * put the cache back exactly as it was and tell the user. A transaction that
 * silently vanishes from the list is worse than an error message, because the
 * user has no reason to re-enter it.
 *
 * Shape of the flow (TanStack Query's standard optimistic sequence):
 *   onMutate   → cancel in-flight refetches, snapshot, apply the optimistic change
 *   onError    → restore the snapshot verbatim, surface the failure
 *   onSettled  → invalidate so the server's copy becomes the truth
 *
 * `mutationFn` is a **Server Action**, not a fetch. Under DEC-009 the browser
 * holds no token, so it cannot call the API directly.
 *
 * ── What must NOT use this ───────────────────────────────────────────────────
 * Balances, net worth, and report figures. Those are derived server-side from
 * the ledger; guessing them client-side and correcting a moment later destroys
 * trust in a finance app. They get skeletons instead (see components/skeleton).
 * Use this only for user-authored rows: transactions, accounts, categories.
 */
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';

export interface OptimisticMutationOptions<TVariables, TResult, TCache> {
  /** Cache entry being optimistically updated. */
  queryKey: QueryKey;
  /** The Server Action performing the real write. */
  mutationFn: (variables: TVariables) => Promise<TResult>;
  /** Pure: given the current cache and the variables, return the new cache. */
  applyOptimistic: (current: TCache | undefined, variables: TVariables) => TCache | undefined;
  /** Called with the reason when the write fails and the cache has been restored. */
  onFailure?: (error: unknown, variables: TVariables) => void;
}

export function useOptimisticMutation<TVariables, TResult, TCache>({
  queryKey,
  mutationFn,
  applyOptimistic,
  onFailure,
}: OptimisticMutationOptions<TVariables, TResult, TCache>) {
  const queryClient = useQueryClient();

  return useMutation<TResult, unknown, TVariables, { previous: TCache | undefined }>({
    mutationFn,

    async onMutate(variables) {
      // An in-flight refetch that lands after the optimistic write would
      // overwrite it with pre-mutation data.
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<TCache>(queryKey);
      queryClient.setQueryData<TCache>(queryKey, (current) =>
        applyOptimistic(current, variables),
      );

      return { previous };
    },

    onError(error, variables, context) {
      // Restore verbatim — not a refetch, which could race or fail offline too.
      queryClient.setQueryData<TCache>(queryKey, context?.previous);
      onFailure?.(error, variables);
    },

    onSettled() {
      // Success or failure, the server is the authority on what is now true.
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}
