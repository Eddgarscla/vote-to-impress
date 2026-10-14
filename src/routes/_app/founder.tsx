import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { FOUNDER_SECTIONS, founderSection, type FounderSection } from "@/components/founder-menu";
import { TopBar } from "@/components/shell";
import { Button, ErrorNote, Field, LoadingBlock, NumberField, TextArea, TextInput } from "@/components/ui";
import {
  getFounderDesk,
  reviewVerification,
  revokeVerification,
  saveFounderChallenge,
  saveLevelLadder,
  setChallengeState,
} from "@/lib/vti/admin";
import {
  removeStage,
  removeTwist,
  saveGenderOptions,
  saveRewardBands,
  saveStage,
  saveThemeMeta,
  saveTwist,
  saveVoteRules,
} from "@/lib/vti/runway";
import type { FounderDesk, RewardBand } from "@/lib/vti/types";
import { useQuery } from "@/lib/vti/use-query";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/founder")({
  validateSearch: (search: Record<string, unknown>) => ({
    section: founderSection(search.section),
  }),
  component: FounderPage,
});

function FounderPage() {
  const { t } = useI18n();
  const search = Route.useSearch();
  const query = useQuery("founder-desk", () => getFounderDesk());
  const [desk, setDesk] = useState<FounderDesk | null>(null);
  const [section, setSection] = useState<FounderSection>(search.section);
  const [toast, setToast] = useState<string | null>(null);
  const denied = query.data && "error" in query.data ? query.data.error : null;

  useEffect(() => {
    if (query.data && !("error" in query.data)) setDesk(query.data);
  }, [query.data]);

  useEffect(() => {
    setSection(search.section);
  }, [search.section]);

  function show(message: string) {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 2400);
  }

  async function saved(message?: string) {
    const next = await getFounderDesk();
    if ("error" in next) {
      show(next.error);
      return;
    }
    setDesk(next);
    show(message ?? t("savedWord"));
  }

  return (
    <div className="pb-nav">
      <TopBar title={t("founder")} fallback="/profile" />
      {query.loading && !desk ? <LoadingBlock label={t("founderLoading")} /> : null}
      {query.error && !desk ? <ErrorNote message={query.error} onRetry={query.reload} /> : null}
      {denied && !desk ? <ErrorNote message={denied === "Only the Founder can manage the platform." ? t("founderDenied") : denied} /> : null}
      {desk ? (
        <Desk
          desk={desk}
          section={section}
          onSection={(next) => {
            setSection(next);
            const url = new URL(window.location.href);
            url.searchParams.set("section", next);
            window.history.replaceState(window.history.state, "", url);
          }}
          onSaved={saved}
        />
      ) : null}
      {toast ? (
        <p className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-paper shadow-lg" role="status">
          {toast}
        </p>
      ) : null}
    </div>
  );
}

function Desk({
  desk,
  section,
  onSection,
  onSaved,
}: {
  desk: FounderDesk;
  section: FounderSection;
  onSection: (section: FounderSection) => void;
  onSaved: (message?: string) => Promise<void>;
}) {
  const { founderLabel, t } = useI18n();
  return (
    <div className="space-y-6 px-4 py-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FOUNDER_SECTIONS.map(([id]) => (
          <button
            key={id}
            type="button"
            onClick={() => onSection(id)}
            className={section === id ? "h-10 shrink-0 rounded-full bg-ink px-3 text-sm text-paper" : "h-10 shrink-0 rounded-full bg-chip px-3 text-sm"}
          >
            {founderLabel(id)}
          </button>
        ))}
      </div>
      {section === "dashboard" || section === "statistics" ? <Stats desk={desk} /> : null}
      {section === "themes" ? <ThemeForm desk={desk} onSaved={onSaved} /> : null}
      {section === "challenges" ? (
        <>
          <ChallengeForm onSaved={onSaved} />
          <ChallengeList desk={desk} onSaved={onSaved} />
        </>
      ) : null}
      {section === "calendar" ? <Calendar desk={desk} /> : null}
      {section === "submissions" || section === "rankings" ? <ChallengeList desk={desk} onSaved={onSaved} rankingsOnly={section === "rankings"} /> : null}
      {section === "voting" ? <VoteForm desk={desk} onSaved={onSaved} /> : null}
      {section === "points" ? <PointsForm desk={desk} onSaved={onSaved} /> : null}
      {section === "levels" ? <LevelForm levels={desk.levels} onSaved={onSaved} /> : null}
      {section === "verification" ? <Verification desk={desk} onSaved={onSaved} /> : null}
      {section === "users" ? (
        <>
          <Players desk={desk} onSaved={onSaved} />
          <TestAccounts accounts={desk.testAccounts} />
        </>
      ) : null}
      {section === "settings" ? (
        <>
          <GenderForm desk={desk} onSaved={onSaved} />
          <p className="text-sm text-muted">{t("illustratedNote")}</p>
        </>
      ) : null}
      {section === "challenges" ? <StageBoard desk={desk} onSaved={onSaved} /> : null}
    </div>
  );
}

function Stats({ desk }: { desk: FounderDesk }) {
  const { t } = useI18n();
  const items = [
    [t("statPlayers"), desk.stats.users],
    [t("statActive"), desk.stats.activeUsers],
    [t("statLooks"), desk.stats.posts],
    [t("statFollows"), desk.stats.followers],
    [t("statEntries"), desk.stats.participation],
    [t("statVotes"), desk.stats.votes],
    [t("statRequests"), desk.stats.pending],
    [t("statPoints"), desk.stats.points],
    [t("statWinners"), desk.stats.winners],
  ] as const;
  return (
    <section className="grid grid-cols-2 gap-2 text-center sm:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-2xl bg-chip px-2 py-3">
          <p className="text-xs text-muted">{label}</p>
          <p className="font-display text-2xl tabular-nums">{value}</p>
        </div>
      ))}
    </section>
  );
}

function ThemeForm({ desk, onSaved }: { desk: FounderDesk; onSaved: (message?: string) => Promise<void> }) {
  const { t } = useI18n();
  const [themeKey, setThemeKey] = useState(desk.themeKey);
  const [weeklyTheme, setWeeklyTheme] = useState(desk.weeklyTheme);
  const [monthlyTheme, setMonthlyTheme] = useState(desk.monthlyTheme);
  const [themeName, setThemeName] = useState(desk.themeName);
  const [themeDescription, setThemeDescription] = useState(desk.themeDescription);
  const [themeStarts, setThemeStarts] = useState(utcInput(desk.themeStarts));
  const [themeEnds, setThemeEnds] = useState(utcInput(desk.themeEnds));
  const [accentColor, setAccentColor] = useState(desk.accentColor);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void saveThemeMeta({
          data: {
            themeKey: themeKey as "gloss" | "haunted" | "frost" | "valentine",
            weeklyTheme,
            monthlyTheme,
            themeName,
            themeDescription,
            themeStarts,
            themeEnds,
            accentColor,
          },
        }).then((res) => {
          if (!res.ok) {
            setError(res.error);
            return;
          }
          window.dispatchEvent(new CustomEvent("vti-theme", {
            detail: { themeKey, accent: res.accent, weekly: weeklyTheme, monthly: monthlyTheme },
          }));
          setError(null);
          void onSaved(t("themeSaved"));
        });
      }}
    >
      <h2 className="font-display text-2xl">{t("themeHeading")}</h2>
      <Field label={t("visualTheme")}>
        <select className="h-12 w-full rounded-xl border border-line bg-surface px-3" value={themeKey} onChange={(e) => setThemeKey(e.target.value)}>
          <option value="haunted">Halloween</option>
          <option value="gloss">Gloss</option>
          <option value="frost">Frost</option>
          <option value="valentine">Valentine</option>
        </select>
      </Field>
      <Field label={t("themeName")}><TextInput value={themeName} onChange={(e) => setThemeName(e.target.value)} /></Field>
      <Field label={t("themeDescription")}><TextArea value={themeDescription} onChange={(e) => setThemeDescription(e.target.value)} rows={3} /></Field>
      <Field label={t("weeklyLine")}><TextInput value={weeklyTheme} onChange={(e) => setWeeklyTheme(e.target.value)} /></Field>
      <Field label={t("monthlyLine")}><TextInput value={monthlyTheme} onChange={(e) => setMonthlyTheme(e.target.value)} /></Field>
      <Field label={t("startsUtc")}><TextInput type="datetime-local" value={themeStarts} onChange={(e) => setThemeStarts(e.target.value)} /></Field>
      <Field label={t("endsUtc")}><TextInput type="datetime-local" value={themeEnds} onChange={(e) => setThemeEnds(e.target.value)} /></Field>
      <Field label={t("accentLabel")} hint={t("accentHint")}>
        <TextInput value={accentColor} onChange={(e) => setAccentColor(e.target.value)} placeholder="#ff4fa3" />
      </Field>
      {error ? <p className="text-sm text-accent">{error}</p> : null}
      <Button type="submit">{t("saveTheme")}</Button>
    </form>
  );
}

function ChallengeForm({ onSaved }: { onSaved: (message?: string) => Promise<void> }) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [theme, setTheme] = useState("");
  const [kind, setKind] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [pointsFirst, setPointsFirst] = useState(400);
  const [pointsSecond, setPointsSecond] = useState(180);
  const [pointsThird, setPointsThird] = useState(90);
  const [participationPoints, setParticipationPoints] = useState(25);
  const [voteBudget, setVoteBudget] = useState(10);
  const [banner, setBanner] = useState<"" | "haunted" | "lineup" | "upload" | "none">("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function applyKind(next: "daily" | "weekly" | "monthly") {
    setKind(next);
    if (next === "daily") {
      setPointsFirst(100);
      setPointsSecond(80);
      setPointsThird(60);
      setParticipationPoints(5);
    } else if (next === "monthly") {
      setPointsFirst(600);
      setPointsSecond(300);
      setPointsThird(150);
      setParticipationPoints(40);
    } else {
      setPointsFirst(400);
      setPointsSecond(180);
      setPointsThird(90);
      setParticipationPoints(25);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const res = await saveFounderChallenge({
      data: {
        title, description, theme, kind, startsAt, endsAt,
        pointsFirst, pointsSecond, pointsThird, participationPoints, voteBudget,
        banner: banner || undefined,
        imageDataUrl: imageDataUrl || undefined,
      },
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setTitle("");
    setDescription("");
    setTheme("");
    setBanner("");
    setImageDataUrl("");
    setError(null);
    await onSaved("Challenge created");
  }

  return (
    <form className="space-y-3" onSubmit={(event) => void onSubmit(event)}>
      <h2 className="font-display text-2xl">{t("newChallenge")}</h2>
      <Field label="Kind">
        <select className="h-12 w-full rounded-xl border border-line bg-surface px-3" value={kind} onChange={(e) => applyKind(e.target.value as "daily" | "weekly" | "monthly")}>
          <option value="daily">Daily · 24 hours</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </Field>
      <Field label="Title"><TextInput value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
      <Field label="Theme"><TextInput value={theme} onChange={(e) => setTheme(e.target.value)} /></Field>
      <Field label="Description"><TextArea value={description} onChange={(e) => setDescription(e.target.value)} required /></Field>
      <Field label="Starts (UTC)"><TextInput type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required /></Field>
      <Field label="Ends (UTC)" hint={kind === "daily" ? "Daily challenges should end 24 hours after they start." : undefined}>
        <TextInput type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required />
      </Field>
      <Field label="Banner">
        <select className="h-12 w-full rounded-xl border border-line bg-surface px-3" value={banner} onChange={(e) => setBanner(e.target.value as typeof banner)} required>
          <option value="">Choose a banner</option>
          <option value="haunted">Use the Halloween banner</option>
          <option value="lineup">Use the lineup banner</option>
          <option value="upload">Upload my own</option>
          <option value="none">No banner</option>
        </select>
      </Field>
      {banner === "upload" ? (
        <Field label="Banner file">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="block w-full text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => setImageDataUrl(String(reader.result ?? ""));
              reader.readAsDataURL(file);
            }}
          />
        </Field>
      ) : null}
      {imageDataUrl ? <img src={imageDataUrl} alt="" className="aspect-[16/9] w-full rounded-2xl object-cover" /> : null}
      <div className="grid grid-cols-3 gap-2">
        <NumberField label="1st" value={pointsFirst} onChange={(value) => setPointsFirst(value ?? 0)} />
        <NumberField label="2nd" value={pointsSecond} onChange={(value) => setPointsSecond(value ?? 0)} />
        <NumberField label="3rd" value={pointsThird} onChange={(value) => setPointsThird(value ?? 0)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Entry pts" value={participationPoints} onChange={(value) => setParticipationPoints(value ?? 0)} />
        <NumberField label="Vote budget" value={voteBudget} onChange={(value) => setVoteBudget(value ?? 1)} />
      </div>
      <p className="text-xs text-muted">Placement ranges for this kind are copied onto the new challenge. Existing challenges keep their own table.</p>
      {error ? <p className="text-sm text-accent">{error}</p> : null}
      <Button type="submit">Create</Button>
    </form>
  );
}

function utcInput(iso: string) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16);
}

function ChallengeList({
  desk,
  onSaved,
  rankingsOnly = false,
}: {
  desk: FounderDesk;
  onSaved: (message?: string) => Promise<void>;
  rankingsOnly?: boolean;
}) {
  const { founderLabel } = useI18n();
  return (
    <section>
      <h2 className="font-display text-2xl">{rankingsOnly ? founderLabel("rankings") : founderLabel("challenges")}</h2>
      <ul className="mt-3 space-y-4">
        {desk.challenges.map((challenge) => (
          <li key={challenge.id} className="panel rounded-3xl border border-line p-4">
            <p className="text-xs tracking-widest text-gold uppercase">{challenge.kind} · {challenge.phase}{challenge.cancelled ? " · cancelled" : ""}</p>
            <h3 className="font-display text-xl">{challenge.title}</h3>
            <p className="text-sm text-muted">{challenge.theme}. {challenge.participants} submissions · {challenge.votes} votes · {challenge.voters} voters.</p>
            {challenge.winner ? <p className="mt-1 text-sm">{challenge.resultsPublic || challenge.phase === "ended" ? "Winner" : "Current lead"}: {challenge.winner}</p> : null}
            <ol className="mt-2 space-y-1 text-sm">
              {challenge.ranking.map((row, index) => (
                <li key={row.username}>{index + 1}. {row.username} · {row.votes} votes{challenge.resultsPublic ? "" : " · hidden from players"}</li>
              ))}
            </ol>
            {!rankingsOnly && challenge.submissions.length ? (
              <ul className="mt-3 flex gap-2 overflow-x-auto">
                {challenge.submissions.map((entry) => (
                  <li key={entry.username + entry.imageUrl} className="w-16 shrink-0">
                    <img src={entry.imageUrl} alt="" className="aspect-[3/4] w-full rounded-lg object-cover" />
                    <p className="truncate text-[10px] text-muted">{entry.place ? `#${entry.place} ` : ""}{entry.username}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/challenges/$challengeId" params={{ challengeId: challenge.id }} className="text-sm underline">Open</Link>
              {!challenge.cancelled ? (
                <>
                  <button type="button" className="text-sm underline" onClick={() => void setChallengeState({ data: { id: challenge.id, action: challenge.active ? "pause" : "activate" } }).then(() => onSaved(challenge.active ? "Paused" : "Activated"))}>
                    {challenge.active ? "Pause" : "Activate"}
                  </button>
                  <button type="button" className="text-sm text-accent underline" onClick={() => void setChallengeState({ data: { id: challenge.id, action: "cancel" } }).then(() => onSaved("Cancelled"))}>Cancel</button>
                </>
              ) : null}
            </div>
            {!rankingsOnly ? <EditChallenge challenge={challenge} onSaved={onSaved} /> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function EditChallenge({ challenge, onSaved }: { challenge: FounderDesk["challenges"][number]; onSaved: (message?: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(challenge.title);
  const [description, setDescription] = useState(challenge.description);
  const [theme, setTheme] = useState(challenge.theme);
  const [kind, setKind] = useState(challenge.kind);
  const [startsAt, setStartsAt] = useState(utcInput(challenge.startDate));
  const [endsAt, setEndsAt] = useState(utcInput(challenge.endDate));
  const [pointsFirst, setPointsFirst] = useState(challenge.pointsFirst);
  const [pointsSecond, setPointsSecond] = useState(challenge.pointsSecond);
  const [pointsThird, setPointsThird] = useState(challenge.pointsThird);
  const [participationPoints, setParticipationPoints] = useState(challenge.participationPoints);
  const [voteBudget, setVoteBudget] = useState(challenge.voteBudget);
  const [banner, setBanner] = useState<"unchanged" | "haunted" | "lineup" | "upload" | "none">("unchanged");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (challenge.resultsPublic || challenge.cancelled) return null;
  if (!open) return <button type="button" className="mt-2 text-sm underline" onClick={() => setOpen(true)}>Edit</button>;
  return (
    <form
      className="mt-3 space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        void saveFounderChallenge({
          data: {
            id: challenge.id, title, description, theme, kind, startsAt, endsAt,
            pointsFirst, pointsSecond, pointsThird, participationPoints, voteBudget,
            banner, imageDataUrl: imageDataUrl || undefined,
          },
        }).then(async (res) => {
          if (!res.ok) {
            setError(res.error);
            return;
          }
          setError(null);
          await onSaved("Challenge saved");
        });
      }}
    >
      <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
      <TextInput value={theme} onChange={(e) => setTheme(e.target.value)} />
      <TextArea value={description} onChange={(e) => setDescription(e.target.value)} />
      <select className="h-12 w-full rounded-xl border border-line bg-surface px-3" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
      </select>
      <TextInput type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} aria-label="Starts UTC" />
      <TextInput type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} aria-label="Ends UTC" />
      <div className="grid grid-cols-3 gap-2">
        <NumberField label="1st" value={pointsFirst} onChange={(value) => setPointsFirst(value ?? 0)} />
        <NumberField label="2nd" value={pointsSecond} onChange={(value) => setPointsSecond(value ?? 0)} />
        <NumberField label="3rd" value={pointsThird} onChange={(value) => setPointsThird(value ?? 0)} />
      </div>
      <NumberField label="Entry pts" value={participationPoints} onChange={(value) => setParticipationPoints(value ?? 0)} />
      <NumberField label="Vote budget" value={voteBudget} onChange={(value) => setVoteBudget(value ?? 1)} />
      <Field label="Banner">
        <select className="h-12 w-full rounded-xl border border-line bg-surface px-3" value={banner} onChange={(e) => setBanner(e.target.value as typeof banner)}>
          <option value="unchanged">Keep the current banner</option>
          <option value="haunted">Use the Halloween banner</option>
          <option value="lineup">Use the lineup banner</option>
          <option value="upload">Replace with an upload</option>
          <option value="none">Remove banner</option>
        </select>
      </Field>
      {banner === "upload" ? (
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => setImageDataUrl(String(reader.result ?? ""));
          reader.readAsDataURL(file);
        }} />
      ) : null}
      {error ? <p className="text-sm text-accent">{error}</p> : null}
      <Button type="submit">Save challenge</Button>
    </form>
  );
}

function Calendar({ desk }: { desk: FounderDesk }) {
  const { t } = useI18n();
  const rows = [
    ...desk.challenges.map((item) => ({ when: item.startDate, label: `${item.kind} starts · ${item.title}`, end: item.endDate })),
    ...desk.stages.map((item) => ({ when: item.startsAt, label: `Stage · ${item.title}`, end: item.endsAt })),
    ...desk.twists.map((item) => ({ when: item.startsAt, label: `Twist · ${item.title}`, end: item.endsAt })),
  ].sort((a, b) => a.when.localeCompare(b.when));
  return (
    <section>
      <h2 className="font-display text-2xl">{t("calendarHeading")}</h2>
      <p className="mt-1 text-sm text-muted">Scheduled challenges, stages, and twist drops. They open from these times without a code change.</p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.label + row.when} className="rounded-2xl border border-line px-3 py-2 text-sm">
            <p className="font-medium">{row.label}</p>
            <p className="text-muted">{row.when ? new Date(row.when).toUTCString() : "No start"}{row.end ? ` → ${new Date(row.end).toUTCString()}` : ""}</p>
          </li>
        ))}
        {rows.length === 0 ? <li className="text-sm text-muted">Nothing scheduled.</li> : null}
      </ul>
    </section>
  );
}

function VoteForm({ desk, onSaved }: { desk: FounderDesk; onSaved: (message?: string) => Promise<void> }) {
  const { t } = useI18n();
  const [max, setMax] = useState(desk.vote.max);
  const [regen, setRegen] = useState(desk.vote.regen);
  const [intervalMinutes, setIntervalMinutes] = useState(desk.vote.intervalMinutes);
  const [allowMulti, setAllowMulti] = useState(desk.vote.allowMulti);
  const [expiry, setExpiry] = useState(desk.vote.expiry);
  const [bonus, setBonus] = useState(desk.vote.bonus);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void saveVoteRules({
          data: { max, regen, intervalMinutes, allowMulti, expiry, bonus },
        }).then(async (res) => {
          if (!res.ok) {
            setError(res.error);
            return;
          }
          setError(null);
          await onSaved("Voting saved");
        });
      }}
    >
      <h2 className="font-display text-2xl">{t("votingHeading")}</h2>
      <p className="text-sm text-muted">Players spend a personal wallet. It refills up to the maximum and never past it. A like is still not a vote.</p>
      <NumberField label="Maximum votes" value={max} onChange={(value) => setMax(value ?? 1)} />
      <NumberField label="Regeneration amount" value={regen} onChange={(value) => setRegen(value ?? 0)} />
      <NumberField label="Minutes between votes" value={intervalMinutes} onChange={(value) => setIntervalMinutes(value ?? 60)} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allowMulti} onChange={(e) => setAllowMulti(e.target.checked)} /> Allow more than one vote on the same entry</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={expiry} onChange={(e) => setExpiry(e.target.checked)} /> Expire votes after one full recharge window and return them</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={bonus} onChange={(e) => setBonus(e.target.checked)} /> Bonus vote when someone enters a challenge</label>
      {error ? <p className="text-sm text-accent">{error}</p> : null}
      <Button type="submit">Save voting</Button>
    </form>
  );
}

function PointsForm({ desk, onSaved }: { desk: FounderDesk; onSaved: (message?: string) => Promise<void> }) {
  const { t } = useI18n();
  const scopes = ["kind:daily", "kind:weekly", "kind:monthly"] as const;
  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl">{t("pointsHeading")}</h2>
      <p className="text-sm text-muted">Place 0 is participation. Other rows are exact places or ranges, like 4 to 10. New challenges copy the table for their kind. Closed challenges are not rewritten.</p>
      {scopes.map((scope) => (
        <BandTable key={scope} scope={scope} bands={desk.bands.filter((band) => band.scope === scope)} onSaved={onSaved} />
      ))}
    </div>
  );
}

function BandTable({ scope, bands, onSaved }: { scope: string; bands: RewardBand[]; onSaved: (message?: string) => Promise<void> }) {
  const [rows, setRows] = useState(bands.length ? bands : [{ id: "new", scope, placeFrom: 1, placeTo: 1, points: 0 }]);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        void saveRewardBands({
          data: {
            scope,
            bands: rows.map((row) => ({ placeFrom: row.placeFrom, placeTo: row.placeTo, points: row.points })),
          },
        }).then(async (res) => {
          if (!res.ok) {
            setError(res.error);
            return;
          }
          setError(null);
          await onSaved("Points saved");
        });
      }}
    >
      <h3 className="font-display text-xl">{scope.replace("kind:", "")}</h3>
      {rows.map((row, index) => (
        <div key={`${scope}-${index}`} className="grid grid-cols-3 gap-2">
          <NumberField label="From" value={row.placeFrom} onChange={(value) => setRows(rows.map((item, i) => i === index ? { ...item, placeFrom: value ?? 0 } : item))} />
          <NumberField label="To" value={row.placeTo} onChange={(value) => setRows(rows.map((item, i) => i === index ? { ...item, placeTo: value ?? 0 } : item))} />
          <NumberField label="Points" value={row.points} onChange={(value) => setRows(rows.map((item, i) => i === index ? { ...item, points: value ?? 0 } : item))} />
        </div>
      ))}
      <button type="button" className="text-sm underline" onClick={() => setRows([...rows, { id: `new-${rows.length}`, scope, placeFrom: 0, placeTo: 0, points: 0 }])}>Add range</button>
      {error ? <p className="text-sm text-accent">{error}</p> : null}
      <Button type="submit">Save {scope.replace("kind:", "")} points</Button>
    </form>
  );
}

function StageBoard({ desk, onSaved }: { desk: FounderDesk; onSaved: (message?: string) => Promise<void> }) {
  const { t } = useI18n();
  const [challengeId, setChallengeId] = useState(desk.challenges[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requirement, setRequirement] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [sortOrder, setSortOrder] = useState(desk.stages.length + 1);
  const [twistTitle, setTwistTitle] = useState("");
  const [twistBody, setTwistBody] = useState("");
  const [twistNeed, setTwistNeed] = useState("");
  const [twistStarts, setTwistStarts] = useState("");
  const [twistEnds, setTwistEnds] = useState("");
  const [twistImage, setTwistImage] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl">{t("stagesHeading")}</h2>
      <ul className="space-y-2 text-sm">
        {desk.stages.map((stage) => (
          <li key={stage.id} className="rounded-2xl border border-line p-3">
            <p className="font-medium">{stage.title}{stage.open ? " · open" : ""}</p>
            <p className="text-muted">{stage.requirement}</p>
            <button type="button" className="mt-1 underline" onClick={() => void removeStage({ data: { id: stage.id } }).then(async (res) => {
              if (!res.ok) setError(res.error);
              else await onSaved("Stage removed");
            })}>Remove if empty</button>
          </li>
        ))}
        {desk.twists.map((twist) => (
          <li key={twist.id} className="rounded-2xl border border-line p-3">
            <p className="font-medium">Twist · {twist.title}{twist.live ? " · live" : ""}</p>
            <p className="text-muted">{twist.requirement}</p>
            <button type="button" className="mt-1 underline" onClick={() => void removeTwist({ data: { id: twist.id } }).then(() => onSaved("Twist removed"))}>Remove</button>
          </li>
        ))}
      </ul>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          void saveStage({
            data: { challengeId, title, description, requirement, startsAt, endsAt, sortOrder },
          }).then(async (res) => {
            if (!res.ok) {
              setError(res.error);
              return;
            }
            setTitle("");
            setDescription("");
            setRequirement("");
            setError(null);
            await onSaved("Stage saved");
          });
        }}
      >
        <h3 className="font-display text-xl">{t("addStage")}</h3>
        <Field label="Challenge">
          <select className="h-12 w-full rounded-xl border border-line bg-surface px-3" value={challengeId} onChange={(e) => setChallengeId(e.target.value)}>
            {desk.challenges.map((challenge) => <option key={challenge.id} value={challenge.id}>{challenge.title}</option>)}
          </select>
        </Field>
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Round title" required />
        <TextArea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this stage is" />
        <TextInput value={requirement} onChange={(e) => setRequirement(e.target.value)} placeholder="Requirement" />
        <TextInput type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} aria-label="Stage starts" required />
        <TextInput type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} aria-label="Stage ends" required />
        <NumberField label="Order" value={sortOrder} onChange={(value) => setSortOrder(value ?? 0)} />
        <Button type="submit">Save stage</Button>
      </form>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          void saveTwist({
            data: {
              challengeId,
              title: twistTitle,
              description: twistBody,
              requirement: twistNeed,
              startsAt: twistStarts,
              endsAt: twistEnds,
              imageDataUrl: twistImage || undefined,
            },
          }).then(async (res) => {
            if (!res.ok) {
              setError(res.error);
              return;
            }
            setTwistTitle("");
            setTwistBody("");
            setTwistNeed("");
            setTwistImage("");
            setError(null);
            await onSaved("Twist saved");
          });
        }}
      >
        <h3 className="font-display text-xl">{t("scheduleTwist")}</h3>
        <TextInput value={twistTitle} onChange={(e) => setTwistTitle(e.target.value)} placeholder="Twist title" required />
        <TextArea value={twistBody} onChange={(e) => setTwistBody(e.target.value)} placeholder="Add red, silver, or mirror elements." />
        <TextInput value={twistNeed} onChange={(e) => setTwistNeed(e.target.value)} placeholder="Requirement" />
        <TextInput type="datetime-local" value={twistStarts} onChange={(e) => setTwistStarts(e.target.value)} aria-label="Twist starts" required />
        <TextInput type="datetime-local" value={twistEnds} onChange={(e) => setTwistEnds(e.target.value)} aria-label="Twist ends" required />
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) {
            setTwistImage("");
            return;
          }
          const reader = new FileReader();
          reader.onload = () => setTwistImage(String(reader.result ?? ""));
          reader.readAsDataURL(file);
        }} />
        {twistImage ? <img src={twistImage} alt="" className="aspect-video w-full rounded-xl object-cover" /> : null}
        <Button type="submit">Save twist</Button>
      </form>
      {error ? <p className="text-sm text-accent">{error}</p> : null}
    </section>
  );
}

function LevelForm({ levels, onSaved }: { levels: FounderDesk["levels"]; onSaved: (message?: string) => Promise<void> }) {
  const { t } = useI18n();
  const [rows, setRows] = useState(levels);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        void saveLevelLadder({ data: { levels: rows.map((row) => ({ key: row.key, label: row.label, min: row.min })) } }).then(async (res) => {
          if (!res.ok) {
            setError(res.error);
            return;
          }
          setError(null);
          await onSaved("Levels saved");
        });
      }}
    >
      <h2 className="font-display text-2xl">{t("levelsHeading")}</h2>
      <p className="text-sm text-muted">The current ladder stays until you edit it. Names are stored here, not hard-coded into the score.</p>
      {rows.map((row, index) => (
        <div key={row.key} className="grid grid-cols-[1fr_6rem] gap-2">
          <TextInput aria-label={`${row.key} name`} value={row.label} onChange={(e) => setRows(rows.map((item, i) => i === index ? { ...item, label: e.target.value } : item))} />
          <NumberField label="Points" value={row.min} onChange={(value) => setRows(rows.map((item, i) => i === index ? { ...item, min: value ?? 0 } : item))} />
        </div>
      ))}
      {error ? <p className="text-sm text-accent">{error}</p> : null}
      <Button type="submit">Save levels</Button>
    </form>
  );
}

function Verification({ desk, onSaved }: { desk: FounderDesk; onSaved: (message?: string) => Promise<void> }) {
  const { t } = useI18n();
  return (
    <section>
      <h2 className="font-display text-2xl">{t("verificationHeading")}</h2>
      <p className="mt-1 text-sm text-muted">Followers and points are context. They do not verify anyone on their own. The Founder stays verified.</p>
      <ul className="mt-3 space-y-3">
        {desk.requests.map((request) => (
          <li key={request.id} className="rounded-2xl border border-line p-3 text-sm">
            <p className="font-medium">{request.username} · {request.status}</p>
            <p className="text-muted">{request.followers} followers · {request.following} following · {request.impressPoints} pts · {request.levelLabel} · {request.entries} entries</p>
            <p className="mt-1">{request.message}</p>
            {request.status === "pending" ? (
              <div className="mt-2 flex gap-2">
                <Button className="h-10" onClick={() => void reviewVerification({ data: { id: request.id, decision: "approve" } }).then(() => onSaved("Approved"))}>Approve</Button>
                <Button variant="line" className="h-10" onClick={() => void reviewVerification({ data: { id: request.id, decision: "reject" } }).then(() => onSaved("Rejected"))}>Reject</Button>
              </div>
            ) : null}
          </li>
        ))}
        {desk.requests.length === 0 ? <li className="text-sm text-muted">No verification requests.</li> : null}
      </ul>
    </section>
  );
}

function Players({ desk, onSaved }: { desk: FounderDesk; onSaved: (message?: string) => Promise<void> }) {
  const { t } = useI18n();
  return (
    <section>
      <h2 className="font-display text-2xl">{t("playersHeading")}</h2>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {desk.people.map((person) => (
          <li key={person.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <span>
              <Link to="/u/$username" params={{ username: person.username }} className="font-medium">{person.username}</Link>
              <span className="mt-0.5 block text-muted">{person.levelLabel} · {person.impressPoints} pts{person.isTest ? " · test" : ""}{person.verified ? " · verified" : ""}</span>
            </span>
            {person.verified && person.role !== "founder" ? (
              <button type="button" className="text-xs underline" onClick={() => void revokeVerification({ data: { userId: person.id } }).then(() => onSaved("Verification removed"))}>Revoke</button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function GenderForm({ desk, onSaved }: { desk: FounderDesk; onSaved: (message?: string) => Promise<void> }) {
  const { t } = useI18n();
  const [rows, setRows] = useState(desk.genders);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        void saveGenderOptions({ data: { options: rows.map((row) => ({ id: row.id, label: row.label, active: row.active })) } }).then(async (res) => {
          if (!res.ok) {
            setError(res.error);
            return;
          }
          setError(null);
          await onSaved("Gender options saved");
        });
      }}
    >
      <h2 className="font-display text-2xl">{t("genderOptions")}</h2>
      <p className="text-sm text-muted">Players choose from this list. Custom, when active, lets them type their own. Nothing is public unless they turn that on.</p>
      {rows.map((row, index) => (
        <div key={row.id} className="flex items-center gap-2">
          <TextInput value={row.label} onChange={(e) => setRows(rows.map((item, i) => i === index ? { ...item, label: e.target.value } : item))} />
          <label className="flex shrink-0 items-center gap-1 text-xs"><input type="checkbox" checked={row.active} onChange={(e) => setRows(rows.map((item, i) => i === index ? { ...item, active: e.target.checked } : item))} /> On</label>
        </div>
      ))}
      <button type="button" className="text-sm underline" onClick={() => setRows([...rows, { id: "", label: "", active: true }])}>Add option</button>
      {error ? <p className="text-sm text-accent">{error}</p> : null}
      <Button type="submit">Save gender options</Button>
    </form>
  );
}

function TestAccounts({ accounts }: { accounts: FounderDesk["testAccounts"] }) {
  const { t } = useI18n();
  return (
    <section>
      <h2 className="font-display text-2xl">{t("testAccounts")}</h2>
      <p className="mt-1 text-sm text-muted">Fictional players. They never have Founder access. Password for all of them: {accounts[0]?.password}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {accounts.map((account) => (
          <li key={account.email}>
            <span className="font-medium">{account.username}</span>
            <span className="block text-muted">{account.email}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
