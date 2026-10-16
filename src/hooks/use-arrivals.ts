import { useEffect, useRef } from "react";

/**
 * Keys that showed up after the first render, so a list can animate items that
 * just arrived (you joined, a request was saved) without animating the whole
 * list on page load. A key stays marked once it arrives, so a re-render mid-animation
 * doesn't strip the class and cut it short.
 */
export function useArrivals(keys: readonly string[]): ReadonlySet<string> {
  const known = useRef<Set<string> | null>(null);
  const arrived = useRef(new Set<string>());

  if (known.current) {
    for (const k of keys) if (!known.current.has(k)) arrived.current.add(k);
  }

  useEffect(() => {
    known.current = new Set(keys);
  });

  return arrived.current;
}
