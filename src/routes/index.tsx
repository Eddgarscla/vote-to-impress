import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useSessionBoot } from "@/lib/auth/use-session-boot";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({ component: Welcome });

function Welcome() {
  const boot = useSessionBoot();
  const { t } = useI18n();
  if (!boot.isPending && boot.user) return <Navigate to="/home" />;

  return (
    <div className="welcome-stage relative min-h-dvh overflow-hidden bg-stone text-ink">
      <img src="/media/brand/hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[center_20%]" />
      <div className="spark-field" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-t from-stone via-stone/80 to-stone/30" />
      <main className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col justify-end px-5 py-10">
        <img src="/media/brand/logo.jpg" alt="Vote to Impress" className="logo-float w-full rounded-[2rem] shadow-2xl" />
        <p className="mt-5 text-sm leading-relaxed text-ink">{t("welcomeBody")}</p>
        <div className="mt-6 flex flex-col gap-3">
          {boot.isPending && !boot.stalled ? (
            <p className="text-center text-xs tracking-wide text-muted uppercase" role="status">{t("checking")}</p>
          ) : null}
          {boot.stalled || boot.error ? (
            <div className="rounded-2xl border border-line bg-chip px-4 py-3 text-sm" role="alert">
              <p>{boot.error ?? t("stalled")}</p>
              <button type="button" className="mt-2 font-medium text-gold underline underline-offset-4" onClick={boot.retry}>
                {t("tryAgain")}
              </button>
            </div>
          ) : null}
          <Link to="/login" search={{ mode: "enter" }} className="btn-glow inline-flex h-12 items-center justify-center rounded-full text-sm font-semibold">
            {t("signIn")}
          </Link>
          <Link to="/login" search={{ mode: "join" }} className="inline-flex h-12 items-center justify-center rounded-full border border-line bg-surface text-sm font-medium">
            {t("createAccount")}
          </Link>
          <p className="text-center text-xs text-muted">{t("welcomeLine")}</p>
        </div>
      </main>
    </div>
  );
}