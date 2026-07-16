import { useDeferredValue, useMemo } from "react";
import { useSuspenseQuery, type UseSuspenseQueryOptions } from "@tanstack/react-query";

export function useSuspenseQueryDeferred<T>(options: UseSuspenseQueryOptions<T>) {
  // Stabilise the query key with deep equality so filter/param changes don't
  // suspend/unmount the existing UI — the old data stays rendered while new data loads.
  const stableQueryKey = useMemo(
    () => options.queryKey,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(options.queryKey)],
  );
  const deferredQueryKey = useDeferredValue(stableQueryKey);
  const query = useSuspenseQuery({ ...options, queryKey: deferredQueryKey });
  return { ...query, isSuspending: stableQueryKey !== deferredQueryKey };
}
