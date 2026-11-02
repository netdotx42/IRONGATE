/** Bound outbound calls to Supabase so stalled auth/database calls fail safely. */
export const boundedFetch: typeof fetch = (input, init) =>
  fetch(input, {
    ...init,
    signal: AbortSignal.any([
      AbortSignal.timeout(7000),
      ...(init?.signal ? [init.signal] : []),
    ]),
  });
