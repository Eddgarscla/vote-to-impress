import { useEffect, useRef, useState } from "react";

const QUERY_TIMEOUT_MS = 12000;

export function useQuery<T>(key: string, fn: () => Promise<T>) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancel = false;
    setError(null);
    setLoading(true);
    setData(null);
    const timer = window.setTimeout(() => {
      if (cancel) return;
      setLoading(false);
      setError("This is taking too long. Try again.");
    }, QUERY_TIMEOUT_MS);
    fnRef.current()
      .then((value) => {
        if (cancel) return;
        window.clearTimeout(timer);
        setData(value);
        setError(null);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancel) return;
        window.clearTimeout(timer);
        setLoading(false);
        setError(e instanceof Error ? e.message : "Something went wrong");
      });
    return () => {
      cancel = true;
      window.clearTimeout(timer);
    };
  }, [key, tick]);

  return {
    data,
    error,
    loading: loading && data === null && !error,
    setData,
    reload: () => setTick((n) => n + 1),
  };
}