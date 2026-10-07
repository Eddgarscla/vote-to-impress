export const LEVELS = [
  { key: "new_face", label: "New Face", min: 0 },
  { key: "rising_star", label: "Rising Star", min: 100 },
  { key: "fashion_icon", label: "Fashion Icon", min: 350 },
  { key: "style_royalty", label: "Style Royalty", min: 800 },
  { key: "superstar", label: "Superstar", min: 1600 },
  { key: "legend", label: "Legend", min: 3000 },
] as const;

export type LevelKey = (typeof LEVELS)[number]["key"];

export function levelFor(points: number) {
  let current: (typeof LEVELS)[number] = LEVELS[0];
  for (const level of LEVELS) {
    if (points >= level.min) current = level;
  }
  const index = LEVELS.findIndex((level) => level.key === current.key);
  const next = LEVELS[index + 1] ?? null;
  return {
    key: current.key,
    label: current.label,
    nextAt: next?.min ?? null,
    nextLabel: next?.label ?? null,
  };
}

export function levelKeySql(pointsExpr: string) {
  return `case
    when ${pointsExpr} >= 3000 then 'legend'
    when ${pointsExpr} >= 1600 then 'superstar'
    when ${pointsExpr} >= 800 then 'style_royalty'
    when ${pointsExpr} >= 350 then 'fashion_icon'
    when ${pointsExpr} >= 100 then 'rising_star'
    else 'new_face'
  end`;
}
