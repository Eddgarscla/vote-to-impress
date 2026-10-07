import { useEffect, useLayoutEffect, useRef, useState } from "react";

function measure(frame: number, imgW: number, imgH: number, zoom: number, offset: { x: number; y: number }) {
  if (frame < 2 || imgW < 2 || imgH < 2) return null;
  const cover = Math.max(frame / imgW, frame / imgH);
  const scale = cover * zoom;
  const dw = imgW * scale;
  const dh = imgH * scale;
  const maxX = Math.max(0, (dw - frame) / 2);
  const maxY = Math.max(0, (dh - frame) / 2);
  return {
    dw,
    dh,
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
    frame,
  };
}

export function AvatarCropper({
  src,
  onCancel,
  onSave,
}: {
  src: string;
  onCancel: () => void;
  onSave: (dataUrl: string) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [frame, setFrame] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
    img.src = src;
  }, [src]);

  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const apply = () => setFrame(el.getBoundingClientRect().width);
    apply();
    const obs = new ResizeObserver(apply);
    obs.observe(el);
    return () => obs.disconnect();
  }, [src]);

  const geom = measure(frame, natural.w, natural.h, zoom, offset);

  function save() {
    const img = imgRef.current;
    const g = measure(frame, natural.w, natural.h, zoom, offset);
    if (!img || !g) {
      setError("The photo is still loading.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#2a0820";
    ctx.fillRect(0, 0, 512, 512);
    const ratio = 512 / g.frame;
    const left = (g.frame - g.dw) / 2 + g.x;
    const top = (g.frame - g.dh) / 2 + g.y;
    ctx.drawImage(img, left * ratio, top * ratio, g.dw * ratio, g.dh * ratio);
    onSave(canvas.toDataURL("image/jpeg", 0.86));
  }

  return (
    <div>
      <div
        ref={frameRef}
        className="relative mx-auto aspect-square w-56 touch-none overflow-hidden rounded-full bg-ink ring-4 ring-accent"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setOffset({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) });
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
      >
        {geom ? (
          <img
            src={src}
            alt=""
            draggable={false}
            className="absolute top-1/2 left-1/2 max-w-none select-none"
            style={{ width: geom.dw, height: geom.dh, transform: `translate(calc(-50% + ${geom.x}px), calc(-50% + ${geom.y}px))` }}
          />
        ) : null}
      </div>
      <label className="mt-3 flex items-center gap-3 text-xs text-muted">
        <span>Zoom</span>
        <input type="range" min={1} max={3} step={0.01} value={zoom} aria-label="Zoom profile photo" onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-accent" />
      </label>
      <p className="pt-1 text-xs text-muted">Drag inside the circle. This is the live preview of your profile photo.</p>
      {error ? <p className="pt-1 text-sm text-accent">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn-glow h-11 flex-1 rounded-full text-sm font-semibold" onClick={save}>Use this crop</button>
        <button type="button" className="h-11 rounded-full px-4 text-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
