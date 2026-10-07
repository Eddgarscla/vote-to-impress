import { useEffect, useRef, useState } from "react";
import { useCurrentUserState, type CurrentUserState } from "./use-current-user";

const STALL_MS = 5000;

export type SessionBoot = CurrentUserState & {
  /** The session check did not settle after a retry. Show an error, not a spinner. */
  stalled: boolean;
  retry: () => void;
};

/**
 * Session read that cannot sit on `isPending` forever.
 *
 * Better Auth leaves `isPending` true when a `/get-session` fetch is aborted
 * (preview closed mid-request, a focus refetch cancelled by the rate limit).
 * Reopening the preview then paints the server loading shell and never leaves
 * it. This hook retries once, then surfaces a stall the UI can recover from.
 */
export function useSessionBoot(): SessionBoot {
  const state = useCurrentUserState();
  const refetchRef = useRef(state.refetch);
  refetchRef.current = state.refetch;
  const [attempt, setAttempt] = useState(0);
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    if (!state.isPending) return;
    const timer = window.setTimeout(() => {
      if (attempt === 0) {
        setAttempt(1);
        refetchRef.current();
        return;
      }
      setStalled(true);
    }, STALL_MS);
    return () => window.clearTimeout(timer);
  }, [state.isPending, attempt]);

  useEffect(() => {
    if (state.isPending) return;
    setStalled(false);
    setAttempt(0);
  }, [state.isPending]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!state.isPending) return;
      refetchRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
    };
  }, [state.isPending]);

  return {
    ...state,
    stalled: stalled && state.isPending,
    retry: () => {
      setStalled(false);
      setAttempt(0);
      refetchRef.current();
    },
  };
}
