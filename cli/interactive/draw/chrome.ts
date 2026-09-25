import type { Span } from "../../tui/box.ts";
import type { Surface } from "../../tui/buffer.ts";
import { split } from "../../tui/layout.ts";
import { THEME } from "./theme.ts";

/**
 * One floor for every screen. The calendar is the demanding one at 72 by 21
 * bare, and this asks for more so no window that shows one screen refuses
 * the next.
 */
const MIN_WIDTH = 75;
const MIN_HEIGHT = 25;

/** Whether there is room for a screen at all. Overlays ask before floating. */
export const fits = (surface: Surface): boolean => surface.width >= MIN_WIDTH && surface.height >= MIN_HEIGHT;

/** Says so, rather than drawing a layout that cannot fit. Returns whether it did. */
export function tooSmall(surface: Surface): boolean {
  if (fits(surface)) return false;
  surface.write(2, 1, "terminal too small", THEME.title);
  surface.write(
    2,
    3,
    `aoc needs ${MIN_WIDTH} by ${MIN_HEIGHT}, this is ${surface.width} by ${surface.height}`,
    THEME.muted,
  );
  return true;
}

/** Where content starts inside a box: clear of the border, not against it. */
export const PAD = 3;

/** Rows the page frame spends above and below the body. */
export const CHROME_ROWS = 6;

export type Chrome = { header: Surface; body: Surface; footer: Surface };

/** The frame every screen shares: a title line, a body of boxes, a hint line. */
export function chrome(surface: Surface): Chrome {
  const whole = { x: 0, y: 0, w: surface.width, h: surface.height };
  const [, header, , body, , footer] = split(whole, "y", [1, 1, 1, "*", 1, 1, 1]);

  const head = surface.clip(header);
  head.write(2, 0, "aoc", THEME.title);
  return { header: head, body: surface.clip(body), footer: surface.clip(footer) };
}

/** A box title that can be stepped through, its arrows dimmed away from the text. */
export const stepper = (text: string): Span[] => [
  { text: "◂ ", style: THEME.muted },
  { text, style: THEME.title },
  { text: " ▸", style: THEME.muted },
];

export type Hint = { key: string; label: string };

const QUIT: Hint = { key: "q", label: "quit" };

const hintWidth = (hint: Hint): number => hint.key.length + 1 + hint.label.length;

/** A key and its verb in two colours, so the eye finds the key first. */
function writeHint(surface: Surface, x: number, hint: Hint): number {
  surface.write(x, 0, hint.key, THEME.hintKey);
  surface.write(x + hint.key.length + 1, 0, hint.label, THEME.hintLabel);
  return x + hintWidth(hint);
}

/** The hint line: the keys worth naming, the way out, or a notice in their place. */
export function keys(footer: Surface, hints: Hint[], notice: string | null): void {
  if (notice !== null) {
    footer.write(2, 0, notice, THEME.warn);
  } else {
    let x = 2;
    for (const [nth, hint] of hints.entries()) {
      if (nth > 0) {
        footer.write(x, 0, "·", THEME.hintLabel);
        x += 2;
      }
      x = writeHint(footer, x, hint) + 1;
    }
  }

  writeHint(footer, footer.width - hintWidth(QUIT) - 2, QUIT);
}
