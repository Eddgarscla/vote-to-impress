import { useRef, useState } from "react";

export function LookGallery({ images, alt }: { images: string[]; alt: string }) {
  const shots = images.length ? images : [];
  const [index, setIndex] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const current = shots[Math.min(index, shots.length - 1)] ?? "";
  if (!current) return null;

  function step(dir: number) {
    setIndex((n) => (n + dir + shots.length) % shots.length);
  }

  return (
    <div
      className="relative"
      onClick={(e) => {
        if (!swiped.current) return;
        e.preventDefault();
        e.stopPropagation();
        swiped.current = false;
      }}
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY };
        swiped.current = false;
      }}
      onPointerUp={(e) => {
        if (!start.current || shots.length < 2) return;
        const dx = e.clientX - start.current.x;
        const dy = e.clientY - start.current.y;
        start.current = null;
        if (Math.abs(dx) < 36 || Math.abs(dx) < Math.abs(dy)) return;
        swiped.current = true;
        step(dx < 0 ? 1 : -1);
      }}
    >
      <img src={current} alt={alt} className="aspect-[4/5] w-full bg-chip object-cover" draggable={false} />
      {shots.length > 1 ? (
        <>
          <button type="button" aria-label="Previous photo" className="absolute top-1/2 left-2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-paper/80 text-lg" onClick={(e) => { e.preventDefault(); e.stopPropagation(); step(-1); }}>‹</button>
          <button type="button" aria-label="Next photo" className="absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-paper/80 text-lg" onClick={(e) => { e.preventDefault(); e.stopPropagation(); step(1); }}>›</button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1">
            {shots.map((shot, i) => (
              <span key={shot.slice(-12) + i} className={i === index ? "size-1.5 rounded-full bg-paper" : "size-1.5 rounded-full bg-paper/50"} />
            ))}
          </div>
          <p className="absolute right-3 bottom-3 rounded-full bg-paper/80 px-2 py-1 text-xs tabular-nums">{index + 1} / {shots.length}</p>
        </>
      ) : null}
    </div>
  );
}
