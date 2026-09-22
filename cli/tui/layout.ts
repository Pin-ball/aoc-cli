export type Rect = { x: number; y: number; w: number; h: number };

/** A fixed number of cells, or `*` for an equal share of what is left over. */
export type Track = number | "*";

/** Cuts a rectangle into tracks along one axis, left to right or top to bottom. */
export function split(rect: Rect, axis: "x" | "y", tracks: Track[]): Rect[] {
  const total = axis === "x" ? rect.w : rect.h;
  const fixed = tracks.reduce<number>((sum, t) => sum + (t === "*" ? 0 : t), 0);
  const flexible = tracks.filter((t) => t === "*").length;
  const spare = Math.max(0, total - fixed);
  const share = flexible === 0 ? 0 : Math.floor(spare / flexible);

  let seen = 0;
  let offset = 0;
  return tracks.map((track) => {
    let size: number;
    if (track === "*") {
      seen += 1;
      size = seen === flexible ? spare - share * (flexible - 1) : share;
    } else {
      size = track;
    }
    const at = offset;
    offset += size;
    const clamped = Math.max(0, Math.min(size, total - at));
    return axis === "x"
      ? { x: rect.x + at, y: rect.y, w: clamped, h: rect.h }
      : { x: rect.x, y: rect.y + at, w: rect.w, h: clamped };
  });
}
