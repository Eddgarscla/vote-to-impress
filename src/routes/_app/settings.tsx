import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ProfileEditor } from "@/components/profile-view";
import { TopBar } from "@/components/shell";
import { Button, ErrorNote, LoadingBlock } from "@/components/ui";
import { signOut } from "@/lib/auth/client";
import { useI18n, type Lang } from "@/lib/i18n";
import { getProfile } from "@/lib/vti/server";
import { useQuery } from "@/lib/vti/use-query";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

function SettingsPage() {
  const { t, lang, setLang } = useI18n();
  const query = useQuery("settings-profile", () => getProfile({ data: {} }));
  const profile = query.data;
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const progress = profile?.nextAt ? Math.min(100, Math.round((profile.impressPoints / profile.nextAt) * 100)) : 100;

  return (
    <div className="pb-nav">
      <TopBar title={t("settingsTitle")} fallback="/profile" />
      {query.loading ? <LoadingBlock label={t("settingsTitle")} /> : null}
      {query.error ? <ErrorNote message={query.error} onRetry={query.reload} /> : null}
      {profile ? (
        <div className="space-y-6 px-4 py-4">
          <section>
            <h2 className="font-display text-2xl">{t("language")}</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(["en", "es"] as Lang[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={lang === id}
                  className={lang === id ? "btn-glow h-11 rounded-full text-sm font-medium" : "h-11 rounded-full border border-line bg-surface text-sm"}
                  onClick={() => setLang(id)}
                >
                  {id === "en" ? t("english") : t("spanish")}
                </button>
              ))}
            </div>
          </section>
          <section>
            <h2 className="font-display text-2xl">{t("progressPrivate")}</h2>
            <p className="mt-1 text-sm text-muted">{profile.levelLabel}{profile.nextLabel ? ` · ${profile.nextLabel}` : ""}</p>
            <div className="level-pip mt-2" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
          </section>
          <section>
            <h2 className="font-display text-2xl">{t("editProfile")}</h2>
            <div className="mt-3">
              <ProfileEditor profile={profile} onSaved={(next) => query.setData(next)} />
            </div>
          </section>
          <section className="rounded-3xl border border-line p-4 text-sm">
            <h2 className="font-display text-2xl">{t("privacy")}</h2>
            <p className="mt-2 text-muted">{t("appearanceNote")}</p>
          </section>
          <section className="rounded-3xl border border-line p-4 text-sm">
            <h2 className="font-display text-2xl">{t("unsupportedTitle")}</h2>
            <p className="mt-2 text-muted">{t("unsupportedBody")}</p>
          </section>
          <Button
            variant="line"
            className="w-full"
            disabled={signingOut}
            onClick={() => {
              setSigningOut(true);
              setSignOutError(null);
              void signOut("/").catch((error: unknown) => {
                setSigningOut(false);
                setSignOutError(error instanceof Error ? error.message : "Could not sign out.");
              });
            }}
          >
            {signingOut ? t("signingOut") : t("signOut")}
          </Button>
          {signOutError ? <p className="text-sm text-accent">{signOutError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
