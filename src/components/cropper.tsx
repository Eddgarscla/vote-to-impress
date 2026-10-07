import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Geom = { dw: number; dh: number; x: number; y: number; frameW: number; frameH: number };

function measureGeom(
  frameW: number,
  frameH: number,
  imgW: number,
  imgH: number,
  zoom: number,
  offset: { x: number; y: number },
): Geom | null {
  if (frameW < 2 || frameH < 2 || imgW < 2 || imgH < 2) return null;
  const cover = Math.max(frameW / imgW, frameH / imgH);
  const scale = cover * zoom;
  const dw = imgW * scale;
  const dh = imgH * scale;
  const maxX = Math.max(0, (dw - frameW) / 2);
  const maxY = Math.max(0, (dh - frameH) / 2);
  return {
    dw,
    dh,
    x: Math.min(maxX, Math.max(-maxX, offset.x)),
    y: Math.min(maxY, Math.max(-maxY, offset.y)),
    frameW,
    frameH,
  };
}

export function LookCropper({
  src,
  exportRef,
}: {
  src: string;
  exportRef: React.MutableRefObject<(() => Promise<string>) | null>;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

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
    const apply = () => {
      const r = el.getBoundingClientRect();
      setFrame((prev) => (prev.w === r.width && prev.h === r.height ? prev : { w: r.width, h: r.height }));
    };
    apply();
    const obs = new ResizeObserver(apply);
    obs.observe(el);
    return () => obs.disconnect();
  }, [src]);

  const geom = measureGeom(frame.w, frame.h, natural.w, natural.h, zoom, offset);

  useEffect(() => {
    exportRef.current = async () => {
      const img = imgRef.current;
      const g = measureGeom(frame.w, frame.h, natural.w, natural.h, zoom, offset);
      if (!img || !g) throw new Error("The image is still loading.");
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1350;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not prepare the image.");
      ctx.fillStyle = "#f6f1ea";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const ratio = canvas.width / g.frameW;
      const left = (g.frameW - g.dw) / 2 + g.x;
      const top = (g.frameH - g.dh) / 2 + g.y;
      ctx.drawImage(img, left * ratio, top * ratio, g.dw * ratio, g.dh * ratio);
      let quality = 0.86;
      let data = canvas.toDataURL("image/jpeg", quality);
      while (data.length > 1_650_000 && quality > 0.5) {
        quality -= 0.12;
        data = canvas.toDataURL("image/jpeg", quality);
      }
      if (data.length > 1_800_000) throw new Error("That image is still too heavy. Try a smaller one.");
      return data;
    };
  }, [exportRef, frame.h, frame.w, natural.h, natural.w, offset, zoom]);

  return (
    <div>
      <div
        ref={frameRef}
        className="relative aspect-[4/5] w-full touch-none overflow-hidden bg-ink"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setOffset({
            x: drag.current.ox + (e.clientX - drag.current.x),
            y: drag.current.oy + (e.clientY - drag.current.y),
          });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {geom ? (
          <img
            src={src}
            alt=""
            draggable={false}
            className="absolute top-1/2 left-1/2 max-w-none select-none"
            style={{
              width: geom.dw,
              height: geom.dh,
              transform: `translate(calc(-50% + ${geom.x}px), calc(-50% + ${geom.y}px))`,
            }}
          />
        ) : null}
      </div>
      <label className="mt-3 flex items-center gap-3 px-4 text-xs text-muted">
        <span className="shrink-0">Zoom</span>
        <input
          type="range"
          min={1}
          max={2.8}
          step={0.01}
          value={zoom}
          aria-label="Zoom"
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full accent-ink"
        />
      </label>
      <p className="px-4 pt-1 text-xs text-muted">Drag to reframe. We fit the photo into a portrait frame for you.</p>
    </div>
  );
}
