import { strip } from "./ansi.ts";
import { NONE } from "./style.ts";
import type { Style } from "./style.ts";
import type { Rect } from "./layout.ts";

export type Cell = { char: string; style: Style };

/** What lies outside a surface. Shared, because the diff asks for it per cell. */
const OUTSIDE: Cell = { char: " ", style: NONE };

/** A grid of cells, or a clipped window onto one sharing the same cells. */
export class Surface {
  readonly #cells: Cell[];
  readonly #stride: number;
  readonly #rect: Rect;
  readonly #base: Style;

  private constructor(cells: Cell[], stride: number, rect: Rect, base: Style = NONE) {
    this.#cells = cells;
    this.#stride = stride;
    this.#rect = rect;
    this.#base = base;
  }

  /** A blank surface of its own, which is what a frame is drawn onto. */
  static create(width: number, height: number): Surface {
    const cells = Array.from({ length: width * height }, () => ({ char: " ", style: NONE }));
    return new Surface(cells, width, { x: 0, y: 0, w: width, h: height });
  }

  get width(): number {
    return this.#rect.w;
  }

  get height(): number {
    return this.#rect.h;
  }

  /** A window onto this surface, in its coordinates, clipped to its bounds. */
  clip(area: Rect): Surface {
    const x = this.#rect.x + Math.max(0, area.x);
    const y = this.#rect.y + Math.max(0, area.y);
    return new Surface(
      this.#cells,
      this.#stride,
      {
        x,
        y,
        w: Math.max(0, Math.min(area.w, this.#rect.x + this.#rect.w - x)),
        h: Math.max(0, Math.min(area.h, this.#rect.y + this.#rect.h - y)),
      },
      this.#base,
    );
  }

  /**
   * The same surface over a background. Every style written through it inherits
   * what it does not set, so an overlay's text carries its panel colour without
   * every caller having to say so.
   */
  on(base: Style): Surface {
    return new Surface(this.#cells, this.#stride, this.#rect, { ...this.#base, ...base });
  }

  /** Reads one cell, in this surface's coordinates. */
  at(x: number, y: number): Cell {
    if (x < 0 || y < 0 || x >= this.#rect.w || y >= this.#rect.h) return OUTSIDE;
    return this.#cells[(this.#rect.y + y) * this.#stride + this.#rect.x + x];
  }

  /** Draws text from one cell rightwards, clipped rather than wrapped. */
  write(x: number, y: number, text: string, style: Style = NONE): void {
    if (y < 0 || y >= this.#rect.h) return;
    const painted = this.#base === NONE ? style : { ...this.#base, ...style };
    let column = x;
    for (const char of strip(text)) {
      if (column >= this.#rect.w) return;
      if (column >= 0) {
        this.#cells[(this.#rect.y + y) * this.#stride + this.#rect.x + column] = { char, style: painted };
      }
      column += 1;
    }
  }

  /** Draws text ending on the surface's right edge. */
  writeRight(y: number, text: string, style: Style = NONE): void {
    this.write(this.#rect.w - strip(text).length, y, text, style);
  }

  /** Repeats one character over the whole surface. */
  fill(style: Style = NONE, char = " "): void {
    for (let y = 0; y < this.#rect.h; y += 1) {
      this.write(0, y, char.repeat(this.#rect.w), style);
    }
  }

  /** The surface as plain rows of text, for snapshots and for non-TTY output. */
  lines(): string[] {
    const rows: string[] = [];
    for (let y = 0; y < this.#rect.h; y += 1) {
      let row = "";
      for (let x = 0; x < this.#rect.w; x += 1) row += this.at(x, y).char;
      rows.push(row.replace(/\s+$/, ""));
    }
    return rows;
  }
}
