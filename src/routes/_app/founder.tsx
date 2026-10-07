import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { TopBar } from "@/components/shell";
import { Button, ErrorNote, Field, LoadingBlock, TextArea, TextInput } from "@/components/ui";
import {
  getFounderDesk,
  reviewVerification,
  revokeVerification,
  saveFounderChallenge,
  saveLevelLadder,
  savePlatformTheme,
  setChallengeState,
} from "@/lib/vti/admin";
import type { FounderDesk } from "@/lib/vti/types";
import { useQuery } from "@/lib/vti/use-query";

export const Route = createFileRoute("/_app/founder")({ component: FounderPage });

function FounderPage() {
  const query = useQuery("founder-desk", () => getFounderDesk());
  const desk = query.data && !("error" in query.data) ? query.data : null;
  const denied = query.data && "error" in query.data ? query.data.error : null;

  return (
    <div className="pb-nav">
      <TopBar title="Founder" fallback="/profile" />
      {query.loading ? <LoadingBlock label="Loading founder desk" /> : null}
      {query.error ? <ErrorNote message={query.error} onRetry={query.reload} /> : null}
      {denied ? <ErrorNote message={denied} /> : null}
      {desk ? <Desk desk={desk} reload={query.reload} /> : null}
    </div>
  );
}

function Desk({ desk, reload }: { desk: FounderDesk; reload: () => void }) {
  return (
    <div className="space-y-8 px-4 py-4">
      <section className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        <Stat label="Players" value={desk.stats.users} />
        <Stat label="Looks" value={desk.stats.posts} />
        <Stat label="Votes" value={desk.stats.votes} />
        <Stat label="Requests" value={desk.stats.pending} />
      </section>
      <ThemeForm desk={desk} onSaved={reload} />
      <ChallengeForm onSaved={reload} />
      <section>
        <h2 className="font-display text-2xl">Challenges</h2>
        <ul className="mt-3 space-y-4">
          {desk.challenges.map((challenge) => (
            <li key={challenge.id} className="panel rounded-3xl border border-line p-4">
              <p className="text-xs tracking-widest text-gold uppercase">{challenge.kind} · {challenge.phase}{challenge.cancelled ? " · cancelled" : ""}</p>
              <h3 className="font-display text-xl">{challenge.title}</h3>
              <p className="text-sm text-muted">{challenge.theme}. {challenge.participants} submissions · {challenge.votes} votes. Rewards {challenge.pointsFirst}/{challenge.pointsSecond}/{challenge.pointsThird}.</p>
              <ol className="mt-2 space-y-1 text-sm">
                {challenge.ranking.slice(0, 5).map((row, index) => (
                  <li key={row.username}>{index + 1}. {row.username} · {challenge.resultsPublic || challenge.phase === "ended" ? `${row.votes} votes` : `${row.votes} votes (founder only)`}</li>
                ))}
              </ol>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/challenges/$challengeId" params={{ challengeId: challenge.id }} className="text-sm underline">Open</Link>
                {!challenge.cancelled ? (
                  <>
                    <button type="button" className="text-sm underline" onClick={() => void setChallengeState({ data: { id: challenge.id, action: challenge.active ? "pause" : "activate" } }).then(reload)}>
                      {challenge.active ? "Pause" : "Activate"}
                    </button>
                    <button type="button" className="text-sm text-accent underline" onClick={() => void setChallengeState({ data: { id: challenge.id, action: "cancel" } }).then(reload)}>Cancel</button>
                  </>
                ) : null}
              </div>
              <EditChallenge challenge={challenge} onSaved={reload} />
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="font-display text-2xl">Verification</h2>
        <ul className="mt-3 space-y-3">
          {desk.requests.map((request) => (
            <li key={request.id} className="rounded-2xl border border-line p-3 text-sm">
              <p className="font-medium">{request.username} · {request.status}</p>
              <p className="text-muted">{request.followers} followers · {request.impressPoints} pts · {request.levelLabel} · {request.entries} entries</p>
              <p className="mt-1">{request.message}</p>
              {request.status === "pending" ? (
                <div className="mt-2 flex gap-2">
                  <Button className="h-10" onClick={() => void reviewVerification({ data: { id: request.id, decision: "approve" } }).then(reload)}>Approve</Button>
                  <Button variant="line" className="h-10" onClick={() => void reviewVerification({ data: { id: request.id, decision: "reject" } }).then(reload)}>Reject</Button>
                </div>
              ) : null}
            </li>
          ))}
          {desk.requests.length === 0 ? <li className="text-sm text-muted">No verification requests.</li> : null}
        </ul>
      </section>
      <section>
        <h2 className="font-display text-2xl">Players</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {desk.people.map((person) => (
            <li key={person.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span>
                <Link to="/u/$username" params={{ username: person.username }} className="font-medium">{person.username}</Link>
                <span className="mt-0.5 block text-muted">{person.levelLabel} · {person.impressPoints} pts{person.isTest ? " · test" : ""}{person.verified ? " · verified" : ""}</span>
              </span>
              {person.verified && person.role !== "founder" ? (
                <button type="button" className="text-xs underline" onClick={() => void revokeVerification({ data: { userId: person.id } }).then(reload)}>Revoke</button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
      <LevelForm levels={desk.levels} onSaved={reload} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-chip px-2 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-display text-2xl tabular-nums">{value}</p>
    </div>
  );
}

function ThemeForm({ desk, onSaved }: { desk: FounderDesk; onSaved: () => void }) {
  const [themeKey, setThemeKey] = useState(desk.themeKey);
  const [weeklyTheme, setWeeklyTheme] = useState(desk.weeklyTheme);
  const [monthlyTheme, setMonthlyTheme] = useState(desk.monthlyTheme);
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void savePlatformTheme({ data: { themeKey: themeKey as "gloss" | "haunted" | "frost" | "valentine", weeklyTheme, monthlyTheme } }).then(onSaved);
      }}
    >
      <h2 className="font-display text-2xl">Season theme</h2>
      <Field label="Visual theme">
        <select className="h-12 w-full rounded-xl border border-line bg-surface px-3" value={themeKey} onChange={(e) => setThemeKey(e.target.value)}>
          <option value="haunted">Halloween</option>
          <option value="gloss">Gloss</option>
          <option value="frost">Frost</option>
          <option value="valentine">Valentine</option>
        </select>
      </Field>
      <Field label="Weekly theme name"><TextInput value={weeklyTheme} onChange={(e) => setWeeklyTheme(e.target.value)} /></Field>
      <Field label="Monthly theme name"><TextInput value={monthlyTheme} onChange={(e) => setMonthlyTheme(e.target.value)} /></Field>
      <Button type="submit">Save theme</Button>
    </form>
  );
}

function ChallengeForm({ onSaved }: { onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [theme, setTheme] = useState("");
  const [kind, setKind] = useState<"weekly" | "monthly">("weekly");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const res = await saveFounderChallenge({
      data: { title, description, theme, kind, startsAt, endsAt, pointsFirst: kind === "monthly" ? 600 : 400, pointsSecond: kind === "monthly" ? 300 : 180, pointsThird: kind === "monthly" ? 150 : 90 },
    });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setTitle("");
    setDescription("");
    setTheme("");
    onSaved();
  }

  return (
    <form className="space-y-3" onSubmit={(event) => void onSubmit(event)}>
      <h2 className="font-display text-2xl">New challenge</h2>
      <Field label="Kind">
        <select className="h-12 w-full rounded-xl border border-line bg-surface px-3" value={kind} onChange={(e) => setKind(e.target.value as "weekly" | "monthly")}>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </Field>
      <Field label="Title"><TextInput value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
      <Field label="Theme"><TextInput value={theme} onChange={(e) => setTheme(e.target.value)} /></Field>
      <Field label="Description"><TextArea value={description} onChange={(e) => setDescription(e.target.value)} required /></Field>
      <Field label="Starts"><TextInput type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required /></Field>
      <Field label="Ends"><TextInput type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required /></Field>
      {error ? <p className="text-sm text-accent">{error}</p> : null}
      <Button type="submit">Create</Button>
    </form>
  );
}

function EditChallenge({ challenge, onSaved }: { challenge: FounderDesk["challenges"][number]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(challenge.title);
  const [description, setDescription] = useState(challenge.description);
  const [theme, setTheme] = useState(challenge.theme);
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
            id: challenge.id,
            title,
            description,
            theme,
            kind: challenge.kind,
            startsAt: challenge.startDate,
            endsAt: challenge.endDate,
            pointsFirst: challenge.pointsFirst,
            pointsSecond: challenge.pointsSecond,
            pointsThird: challenge.pointsThird,
          },
        }).then((res) => {
          if (!res.ok) {
            setError(res.error);
            return;
          }
          onSaved();
        });
      }}
    >
      <TextInput value={title} onChange={(e) => setTitle(e.target.value)} />
      <TextInput value={theme} onChange={(e) => setTheme(e.target.value)} />
      <TextArea value={description} onChange={(e) => setDescription(e.target.value)} />
      {error ? <p className="text-sm text-accent">{error}</p> : null}
      <Button type="submit">Save challenge</Button>
    </form>
  );
}

function LevelForm({ levels, onSaved }: { levels: FounderDesk["levels"]; onSaved: () => void }) {
  const [rows, setRows] = useState(levels);
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        void saveLevelLadder({ data: { levels: rows.map((row) => ({ key: row.key, label: row.label, min: row.min })) } }).then(onSaved);
      }}
    >
      <h2 className="font-display text-2xl">Levels</h2>
      {rows.map((row, index) => (
        <div key={row.key} className="grid grid-cols-[1fr_5rem] gap-2">
          <TextInput value={row.label} onChange={(e) => setRows(rows.map((item, i) => i === index ? { ...item, label: e.target.value } : item))} />
          <TextInput type="number" value={row.min} onChange={(e) => setRows(rows.map((item, i) => i === index ? { ...item, min: Number(e.target.value) } : item))} />
        </div>
      ))}
      <Button type="submit">Save levels</Button>
    </form>
  );
}
