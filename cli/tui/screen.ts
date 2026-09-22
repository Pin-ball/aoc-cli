import { Surface } from "./buffer.ts";
import { decode } from "./keys.ts";
import type { Key } from "./keys.ts";
import { NONE, detectDepth, same, sgr } from "./style.ts";
import type { Depth, Style } from "./style.ts";

export type Draw = (surface: Surface) => void;

const ENTER = "\u001b[?1049h\u001b[?25l";
const LEAVE = "\u001b[?25h\u001b[?1049l";

const open = new Set<Screen>();
let guarded = false;

/** Restores every open screen whatever ends the process, a throw included. */
function guard(): void {
  if (guarded) return;
  guarded = true;
  const restore = () => {
    for (const screen of [...open]) screen.close();
  };
  process.on("exit", restore);
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.on(signal, () => {
      restore();
      process.exit(signal === "SIGINT" ? 130 : 143);
    });
  }
  process.on("uncaughtException", (error) => {
    restore();
    console.error(error);
    process.exit(1);
  });
}

/** The terminal as a surface you redraw: alternate buffer, raw keys, diffed repaints. */
export class Screen {
  private readonly out: NodeJS.WriteStream;
  private readonly input: NodeJS.ReadStream;
  private readonly depth: Depth;
  private previous: Surface | undefined;
  private last: string[] = [];
  private isClosed = false;
  private readonly wasRaw: boolean;
  private readonly keyHandlers: ((key: Key) => void)[] = [];
  private readonly resizeHandlers: (() => void)[] = [];

  private constructor(out: NodeJS.WriteStream, input: NodeJS.ReadStream, depth: Depth) {
    this.out = out;
    this.input = input;
    this.depth = depth;
    this.wasRaw = input.isRaw === true;
  }

  /** Takes over the terminal. Only ever call this on a TTY. */
  static take(
    out: NodeJS.WriteStream = process.stdout,
    input: NodeJS.ReadStream = process.stdin,
  ): Screen {
    guard();
    const screen = new Screen(out, input, detectDepth(out));
    open.add(screen);

    out.write(ENTER);
    input.setRawMode(true);
    input.setEncoding("utf8");
    input.resume();
    input.on("data", screen.receive);
    out.on("resize", screen.resized);
    return screen;
  }

  private readonly receive = (chunk: string): void => {
    for (const key of decode(chunk)) {
      for (const handler of this.keyHandlers) handler(key);
    }
  };

  private readonly resized = (): void => {
    this.previous = undefined;
    for (const handler of this.resizeHandlers) handler();
  };

  get width(): number {
    return this.out.columns ?? 80;
  }

  get height(): number {
    return this.out.rows ?? 24;
  }

  onKey(handler: (key: Key) => void): void {
    this.keyHandlers.push(handler);
  }

  onResize(handler: () => void): void {
    this.resizeHandlers.push(handler);
  }

  /** Draws a frame and sends only the cells that differ from the one on screen. */
  render(draw: Draw): void {
    if (this.isClosed) return;
    const next = Surface.create(this.width, this.height);
    draw(next);
    this.out.write(this.paint(next));
    this.previous = next;
    this.last = next.lines();
  }

  private paint(next: Surface): string {
    const full = this.previous === undefined;
    let out = full ? "\u001b[2J" : "";
    let style: Style | undefined;

    for (let y = 0; y < next.height; y += 1) {
      const changed: number[] = [];
      for (let x = 0; x < next.width; x += 1) {
        const cell = next.at(x, y);
        const before = this.previous?.at(x, y);
        if (full || cell.char !== before?.char || !same(cell.style, before.style)) changed.push(x);
      }
      if (changed.length === 0) continue;

      const from = changed[0];
      const to = changed[changed.length - 1];
      out += `\u001b[${y + 1};${from + 1}H`;
      for (let x = from; x <= to; x += 1) {
        const cell = next.at(x, y);
        if (style === undefined || !same(style, cell.style)) {
          out += sgr(cell.style, this.depth);
          style = cell.style;
        }
        out += cell.char;
      }
    }

    return style === undefined ? out : out + sgr(NONE, this.depth);
  }

  /** Gives the terminal back, leaving the last frame in the scrollback. */
  close(): void {
    if (this.isClosed) return;
    this.isClosed = true;
    open.delete(this);

    this.input.off("data", this.receive);
    this.out.off("resize", this.resized);
    if (this.input.isTTY) this.input.setRawMode(this.wasRaw);
    this.input.pause();
    this.out.write(LEAVE);
    if (this.last.length > 0) this.out.write(`${this.last.join("\n").replace(/\n+$/, "")}\n`);
  }
}
