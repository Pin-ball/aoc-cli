export type Rgb = readonly [number, number, number];

export type Style = {
  fg?: Rgb;
  bg?: Rgb;
  bold?: boolean;
  inverse?: boolean;
};

export type Depth = "none" | "ansi16" | "truecolor";

export const NONE: Style = {};

/** The palette Advent of Code itself uses, so the tool looks at home. */
export const PALETTE = {
  bg: [15, 15, 35],
  fg: [204, 204, 204],
  /** Rules, frames and the selected cell. Decoration only, never text. */
  line: [51, 51, 64],
  faint: [120, 120, 133],
  muted: [140, 140, 150],
  green: [0, 204, 0],
  deep: [0, 153, 0],
  gold: [255, 255, 102],
  warn: [204, 102, 0],
  red: [230, 80, 80],
  ts: [0, 153, 0],
  py: [0, 204, 153],
} as const satisfies Record<string, Rgb>;

const ANSI16: Rgb[] = [
  [0, 0, 0],
  [205, 0, 0],
  [0, 205, 0],
  [205, 205, 0],
  [0, 0, 238],
  [205, 0, 205],
  [0, 205, 205],
  [229, 229, 229],
  [127, 127, 127],
  [255, 0, 0],
  [0, 255, 0],
  [255, 255, 0],
  [92, 92, 255],
  [255, 0, 255],
  [0, 255, 255],
  [255, 255, 255],
];

/** How much colour the stream can carry, honouring NO_COLOR. */
export function detectDepth(stream: NodeJS.WriteStream = process.stdout): Depth {
  if (process.env.NO_COLOR) return "none";
  if (!stream.isTTY) return "none";

  const term = process.env.TERM ?? "";
  if (term === "dumb") return "none";
  if (/truecolor|24bit/.test(process.env.COLORTERM ?? "")) return "truecolor";
  if (/256color|direct/.test(term)) return "truecolor";
  return "ansi16";
}

const nearest = ([r, g, b]: Rgb): number => {
  let best = 0;
  let closest = Infinity;
  for (const [index, [cr, cg, cb]] of ANSI16.entries()) {
    const distance = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (distance < closest) {
      closest = distance;
      best = index;
    }
  }
  return best;
};

function colour(rgb: Rgb, depth: Depth, isBackground: boolean): string[] {
  if (depth === "truecolor") {
    return [`${isBackground ? 48 : 38};2;${rgb[0]};${rgb[1]};${rgb[2]}`];
  }
  // A dark grey lands on black, which is the background of most terminals that
  // only have sixteen colours. Foregrounds take the grey one along instead.
  const nearby = nearest(rgb);
  const index = !isBackground && nearby === 0 ? 8 : nearby;
  const base = isBackground ? 40 : 30;
  const bright = isBackground ? 100 : 90;
  return [String(index < 8 ? base + index : bright + (index - 8))];
}

export const same = (a: Style, b: Style): boolean =>
  a.bold === b.bold && a.inverse === b.inverse && a.fg?.join() === b.fg?.join() && a.bg?.join() === b.bg?.join();

/** The escape sequence that resets the terminal and applies one style. */
export function sgr(style: Style, depth: Depth): string {
  if (depth === "none") return "";
  const codes = ["0"];
  if (style.bold) codes.push("1");
  if (style.inverse) codes.push("7");
  if (style.fg) codes.push(...colour(style.fg, depth, false));
  if (style.bg) codes.push(...colour(style.bg, depth, true));
  return `\u001b[${codes.join(";")}m`;
}
