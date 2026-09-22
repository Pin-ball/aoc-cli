import { Surface } from "../../tui/buffer.ts";
import { box } from "../../tui/box.ts";
import type { Span } from "../../tui/box.ts";
import type { Style } from "../../tui/style.ts";
import { pad } from "../../core/config.ts";
import { duration } from "../../core/format.ts";
import { PAD, chrome, keys, tooSmall } from "./chrome.ts";
import type { TestState, Verdict } from "../run/tester.ts";
import { tally } from "../run/tester.ts";
import { LANG_STYLE, THEME } from "./theme.ts";

const SPINNER = "⣾⣽⣻⢿⡿⣟⣯⣷";
const MARGIN = 2;
const DAY = 7;
const LANGS = 16;

const GLYPH: Record<Verdict, { mark: string; style: Style }> = {
  pass: { mark: "✓", style: THEME.ok },
  fail: { mark: "✗", style: THEME.bad },
  running: { mark: "", style: THEME.muted },
  waiting: { mark: "·", style: THEME.faint },
  skipped: { mark: "—", style: THEME.faint },
};

function totals(state: TestState): Span[] {
  const { passed, failed, skipped } = tally(state.days);
  const spans: Span[] = [{ text: `${passed} passed`, style: passed > 0 ? THEME.ok : THEME.faint }];
  if (failed > 0) spans.push({ text: " · ", style: THEME.faint }, { text: `${failed} failed`, style: THEME.bad });
  if (skipped > 0) spans.push({ text: " · ", style: THEME.faint }, { text: `${skipped} skipped`, style: THEME.faint });
  return spans;
}

/** Asserting a whole year: every day with an accepted answer, run against it. */
export function drawTesting(surface: Surface, state: TestState, tick: number): void {
  if (tooSmall(surface)) return;

  const { header, body, footer } = chrome(surface);
  header.writeRight(0, `${state.year}  `, THEME.title);

  const inner = box(body.clip({ x: MARGIN, y: 0, w: body.width - MARGIN * 2, h: body.height }), {
    title: [{ text: "test", style: THEME.title }],
    note: totals(state),
    border: THEME.line,
  });

  if (state.days.length === 0) {
    inner.write(PAD, 1, `nothing recorded for ${state.year}`, THEME.muted);
    inner.write(PAD, 3, "a day is asserted once adventofcode.com has accepted it", THEME.faint);
  } else {
    const rows = inner.height - 2;
    const at = state.days.findIndex((day) => day.verdict === "running");
    const top = Math.max(0, Math.min(state.days.length - rows, at - rows + 3));

    for (const [index, day] of state.days.slice(top, top + rows).entries()) {
      const y = index + 1;
      const glyph = GLYPH[day.verdict];
      inner.write(PAD, y, day.verdict === "running" ? SPINNER[tick % SPINNER.length] : glyph.mark,
        glyph.style);
      inner.write(DAY, y, `day ${pad(day.day)}`,
        day.verdict === "waiting" || day.verdict === "skipped" ? THEME.faint : THEME.text);

      let x = LANGS;
      for (const lang of day.langs) {
        inner.write(x, y, lang, LANG_STYLE[lang] ?? THEME.text);
        x += lang.length + 1;
      }
      if (day.note !== null) inner.write(LANGS + 8, y, day.note.slice(0, inner.width - LANGS - 20), THEME.bad);
      else if (day.micros > 0) inner.writeRight(y, `${duration(day.micros)}  `, THEME.faint);
    }
  }

  keys(footer, [
    { key: "esc", label: state.isRunning ? "stop" : "back" },
    { key: "t", label: "again" },
  ], null);
}
