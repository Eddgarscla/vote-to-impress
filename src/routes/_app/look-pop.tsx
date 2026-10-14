import { createFileRoute, Link } from "@tanstack/react-router";
import { TopBar } from "@/components/shell";
import { useI18n, type Lang } from "@/lib/i18n";

export const Route = createFileRoute("/_app/look-pop")({ component: LookPopPage });

const STEPS: Record<Lang, { title: string; body: string }[]> = {
  en: [
    { title: "Take a clean screenshot", body: "Hide menus, chat, and health bars first. A still character on a simple background reads better than a busy HUD." },
    { title: "Improve the image quality", body: "Export the largest size the game allows. Avoid a second screenshot of a screenshot — it softens edges." },
    { title: "Improve the lighting", body: "Face the character toward the light in-game. A flat gray sky is easier to fix later than a blown-out window." },
    { title: "Clean up the background", body: "Stand on an empty street, a studio, or a plain wall. Clutter behind the outfit steals the vote." },
    { title: "Reframe and crop", body: "Leave a little room around the hair and the shoes. The publisher in Create fits this into a portrait frame." },
    { title: "Prepare it for the feed", body: "Portrait looks win here. Keep the outfit large in the frame. A short caption beats a paragraph." },
    { title: "Optional tools, outside the app", body: "CapCut or Gemini can help tidy a screenshot before you upload. This app does not edit or generate images for you." },
  ],
  es: [
    { title: "Toma una captura limpia", body: "Oculta menús, chat y barras de vida. Un personaje quieto sobre un fondo simple se lee mejor que un HUD lleno." },
    { title: "Mejora la calidad", body: "Exporta el tamaño más grande que permita el juego. Evita una captura de otra captura: suaviza los bordes." },
    { title: "Mejora la luz", body: "Orienta al personaje hacia la luz dentro del juego. Un cielo gris plano se arregla mejor que una ventana quemada." },
    { title: "Limpia el fondo", body: "Quédate en una calle vacía, un estudio o una pared lisa. El desorden detrás del outfit le roba el voto." },
    { title: "Reencuadra y recorta", body: "Deja un poco de aire alrededor del pelo y los zapatos. En Crear, el marco vertical puede ajustarse." },
    { title: "Prepáralo para el feed", body: "Aquí ganan los retratos. Que el outfit ocupe el marco. Un texto corto vale más que un párrafo." },
    { title: "Herramientas opcionales, fuera de la app", body: "CapCut o Gemini pueden ordenar una captura antes de subirla. Esta app no edita ni genera imágenes por ti." },
  ],
};

function LookPopPage() {
  const { t, lang } = useI18n();
  return (
    <div className="pb-nav">
      <TopBar title={t("lookPopLink")} fallback="/profile" />
      <div className="px-5 py-5">
        <p className="font-display text-3xl leading-tight">{t("guideKicker")}</p>
        <p className="mt-3 text-sm text-muted">{t("guideLead")}</p>
        <ol className="mt-6 divide-y divide-line border-y border-line">
          {STEPS[lang].map((step, index) => (
            <li key={step.title} className="py-4">
              <p className="text-xs text-muted tabular-nums">0{index + 1}</p>
              <h2 className="mt-1 font-display text-xl">{step.title}</h2>
              <p className="mt-1 text-sm text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
        <Link to="/create" search={{ challenge: undefined }} className="btn-glow mt-6 inline-flex h-12 items-center rounded-full px-5 text-sm font-medium">
          {t("publishLook")}
        </Link>
      </div>
    </div>
  );
}
