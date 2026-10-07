import { useState } from "react";

export function LookGallery({ images, alt }: { images: string[]; alt: string }) {
  const shots = images.length ? images : [];
  const [index, setIndex] = useState(0);
  const current = shots[Math.min(index, shots.length - 1)] ?? "";
  if (!current) return null;
  return (
    <div className="relative">
      <img src={current} alt={alt} className="aspect-[4/5] w-full bg-chip object-cover" />
      {shots.length > 1 ? (
        <>
          <button type="button" aria-label="Previous photo" className="absolute top-1/2 left-2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-paper/80 text-lg" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIndex((n) => (n - 1 + shots.length) % shots.length); }}>‹</button>
          <button type="button" aria-label="Next photo" className="absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-paper/80 text-lg" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIndex((n) => (n + 1) % shots.length); }}>›</button>
          <p className="absolute right-3 bottom-3 rounded-full bg-paper/80 px-2 py-1 text-xs tabular-nums">{index + 1} / {shots.length}</p>
        </>
      ) : null}
    </div>
  );
}
