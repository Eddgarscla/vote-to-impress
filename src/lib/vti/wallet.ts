/** Pure vote-wallet math. Balance never exceeds max. Empty clocks do not mint votes. */

export type SettledWallet = {
  balance: number;
  updatedAtMs: number;
  nextInMs: number | null;
};

export function settleWallet(input: {
  balance: number;
  updatedAtMs: number;
  nowMs: number;
  max: number;
  regen: number;
  intervalMinutes: number;
}): SettledWallet {
  const max = Math.max(1, Math.floor(input.max));
  const regen = Math.max(0, Math.floor(input.regen));
  const interval = Math.max(1, Math.floor(input.intervalMinutes)) * 60_000;
  let balance = Math.min(max, Math.max(0, Math.floor(input.balance)));
  if (balance >= max || regen <= 0) {
    return { balance, updatedAtMs: input.nowMs, nextInMs: null };
  }
  const updated = Number.isFinite(input.updatedAtMs) ? input.updatedAtMs : input.nowMs;
  const elapsed = Math.max(0, input.nowMs - updated);
  const ticks = Math.floor(elapsed / interval);
  let updatedAtMs = updated;
  if (ticks > 0) {
    balance = Math.min(max, balance + ticks * regen);
    updatedAtMs = updated + ticks * interval;
  }
  return {
    balance,
    updatedAtMs,
    nextInMs: balance >= max ? null : Math.max(0, interval - (input.nowMs - updatedAtMs)),
  };
}

export function formatVoteWait(nextInMs: number | null, lang: "en" | "es" = "en"): string {
  if (nextInMs == null) return "";
  const mins = Math.max(1, Math.ceil(nextInMs / 60_000));
  const prefix = lang === "es" ? "+1 en" : "+1 in";
  if (mins < 60) return `${prefix} ${mins} min`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest ? `${prefix} ${hours}h ${rest}m` : `${prefix} ${hours}h`;
}
