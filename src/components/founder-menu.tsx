import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";

export const FOUNDER_SECTIONS = [
  ["dashboard", "Dashboard"],
  ["challenges", "Challenges"],
  ["calendar", "Calendar / Schedule"],
  ["submissions", "Submissions"],
  ["voting", "Voting"],
  ["rankings", "Rankings"],
  ["points", "Points"],
  ["levels", "Levels"],
  ["verification", "Verification"],
  ["themes", "Themes"],
  ["users", "Users / Test users"],
  ["statistics", "Statistics"],
  ["settings", "Platform settings"],
] as const;

export type FounderSection = (typeof FOUNDER_SECTIONS)[number][0];

export function founderSection(value: unknown): FounderSection {
  const found = FOUNDER_SECTIONS.find((item) => item[0] === value);
  return found ? found[0] : "dashboard";
}

export function FounderMenuButton() {
  const [open, setOpen] = useState(false);
  const { t, founderLabel } = useI18n();
  const path = useRouterState({ select: (state) => state.location.pathname });
  return (
    <>
      <button
        type="button"
        aria-label={t("founderMenu")}
        aria-expanded={open}
        className="grid size-11 place-items-center rounded-full border border-line bg-paper/90 text-ink shadow-sm backdrop-blur"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="sheet-in flex h-full w-[min(100%,22rem)] flex-col bg-paper text-ink shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="font-display text-2xl">{t("founder")}</p>
              <button type="button" aria-label={t("closeFounder")} className="grid size-11 place-items-center" onClick={() => setOpen(false)}>
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 py-2" aria-label="Founder sections">
              {FOUNDER_SECTIONS.map(([id]) => (
                <Link
                  key={id}
                  to="/founder"
                  search={{ section: id }}
                  resetScroll={path !== "/founder"}
                  onClick={() => setOpen(false)}
                  className="flex min-h-12 items-center rounded-2xl px-3 text-base hover:bg-chip"
                >
                  {founderLabel(id)}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
