import { createFileRoute, Link } from "@tanstack/react-router";
import { TopBar } from "@/components/shell";

export const Route = createFileRoute("/_app/look-pop")({ component: LookPopPage });

const STEPS = [
  {
    title: "Take a clean screenshot",
    body: "Hide menus, chat, and health bars first. A still character on a simple background reads better than a busy HUD.",
  },
  {
    title: "Improve the image quality",
    body: "Export the largest size the game allows. Avoid a second screenshot of a screenshot — it softens edges.",
  },
  {
    title: "Improve the lighting",
    body: "Face the character toward the light in-game. A flat gray sky is easier to fix later than a blown-out window.",
  },
  {
    title: "Clean up the background",
    body: "Stand on an empty street, a studio, or a plain wall. Clutter behind the outfit steals the vote.",
  },
  {
    title: "Reframe and crop",
    body: "Leave a little room around the hair and the shoes. The publisher in Create fits this into a portrait frame — drag if you want to adjust it.",
  },
  {
    title: "Prepare it for the feed",
    body: "Portrait looks win here. Keep the outfit large in the frame. A short caption beats a paragraph.",
  },
  {
    title: "Optional tools, outside the app",
    body: "CapCut or Gemini can help tidy a screenshot before you upload. This app does not edit or generate images for you — that guide will grow here later.",
  },
];

function LookPopPage() {
  return (
    <div className="pb-nav">
      <TopBar title="Make your look pop" fallback="/profile" />
      <div className="px-5 py-5">
        <p className="font-display text-3xl leading-tight">A short guide for game screenshots.</p>
        <p className="mt-3 text-sm text-muted">
          This is the start of the tutorial. Nothing here changes your photo automatically.
        </p>
        <ol className="mt-6 divide-y divide-line border-y border-line">
          {STEPS.map((step, index) => (
            <li key={step.title} className="py-4">
              <p className="text-xs text-muted tabular-nums">0{index + 1}</p>
              <h2 className="mt-1 font-display text-xl">{step.title}</h2>
              <p className="mt-1 text-sm text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
        <Link to="/create" search={{ challenge: undefined }} className="mt-6 inline-flex h-12 items-center rounded-full bg-ink px-5 text-sm font-medium text-paper">
          Publish a look
        </Link>
      </div>
    </div>
  );
}
