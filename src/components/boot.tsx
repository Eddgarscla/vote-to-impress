import { Link } from "@tanstack/react-router";
import { Mark, Wordmark } from "@/components/mark";
import { useI18n } from "@/lib/i18n";

export function BootScreen({ label = "Opening the floor" }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="min-h-dvh bg-stone" id="vti-boot" data-state="loading">
      <main className="stage flex min-h-dvh flex-col items-center justify-center px-6 text-center" role="status" aria-live="polite" aria-label={label}>
        <Mark className="mark-glow size-12" />
        <Wordmark />
        <p className="mt-4 text-sm text-muted">{label}…</p>
        <div className="mt-6 h-1 w-28 overflow-hidden rounded-full bg-chip">
          <div className="boot-bar h-full w-1/2 rounded-full bg-accent" />
        </div>
        <div id="vti-boot-fallback" hidden className="mt-8 max-w-xs">
          <p className="text-sm text-ink">{t("bootDropped")}</p>
          <button type="button" className="btn-glow mt-4 inline-flex h-12 items-center justify-center rounded-full px-5 text-sm font-medium" onClick={() => window.location.reload()}>
            {t("tryAgain")}
          </button>
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "setTimeout(function(){var n=document.getElementById('vti-boot');if(!n||n.getAttribute('data-state')!=='loading')return;var b=document.getElementById('vti-boot-fallback');if(b)b.hidden=false;},8000);",
          }}
        />
      </main>
    </div>
  );
}

export function BootProblem({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="min-h-dvh bg-stone">
      <main className="stage flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <Mark className="size-12" />
        <h1 className="mt-4 font-display text-3xl leading-none">{t("bootFailed")}</h1>
        <p className="mt-3 max-w-xs text-sm text-muted">{message}</p>
        <button type="button" className="btn-glow mt-6 inline-flex h-12 items-center justify-center rounded-full px-5 text-sm font-medium" onClick={onRetry}>
          {t("tryAgain")}
        </button>
        <Link to="/" className="mt-4 text-sm text-ink underline underline-offset-4">
          {t("backWelcome")}
        </Link>
      </main>
    </div>
  );
}