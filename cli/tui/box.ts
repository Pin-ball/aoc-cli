import type { Surface } from "./buffer.ts";
import { NONE } from "./style.ts";
import type { Style } from "./style.ts";

/** A run of text carrying its own style, so one label can mix several. */
export type Span = { text: string; style?: Style };

export type BoxOptions = {
  /** Set into the top edge, on the left. */
  title?: Span[];
  /** Set into the top edge, on the right. */
  note?: Span[];
  border?: Style;
};

const width = (spans: Span[]): number => spans.reduce((total, span) => total + span.text.length, 0);

function writeSpans(surface: Surface, x: number, y: number, spans: Span[]): void {
  let at = x;
  for (const span of spans) {
    surface.write(at, y, span.text, span.style ?? NONE);
    at += span.text.length;
  }
}

/**
 * A rounded frame over the whole surface, returning the surface inside it.
 * A surface too small for a frame is returned untouched rather than mangled.
 */
export function box(surface: Surface, options: BoxOptions = {}): Surface {
  const { title = [], note = [], border = NONE } = options;
  const { width: w, height: h } = surface;
  if (w < 4 || h < 2) return surface;

  const edge = "─".repeat(w - 2);
  surface.write(0, 0, `╭${edge}╮`, border);
  surface.write(0, h - 1, `╰${edge}╯`, border);
  for (let y = 1; y < h - 1; y += 1) {
    surface.write(0, y, "│", border);
    surface.write(w - 1, y, "│", border);
  }

  if (title.length > 0 && w > width(title) + 6) {
    surface.write(2, 0, " ", border);
    writeSpans(surface, 3, 0, title);
    surface.write(3 + width(title), 0, " ", border);
  }
  if (note.length > 0 && w > width(title) + width(note) + 10) {
    const at = w - 3 - width(note);
    surface.write(at - 1, 0, " ", border);
    writeSpans(surface, at, 0, note);
    surface.write(w - 3, 0, " ", border);
  }

  return surface.clip({ x: 1, y: 1, w: w - 2, h: h - 2 });
}
