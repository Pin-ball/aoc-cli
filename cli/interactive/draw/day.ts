import { Surface } from "../../tui/buffer.ts";
import { box } from "../../tui/box.ts";
import type { Span } from "../../tui/box.ts";
import { pad } from "../../core/config.ts";
import { TABS } from "../app.ts";
import type { Tab } from "../app.ts";
import { CHROME_ROWS, PAD, chrome, keys, stepper, tooSmall } from "./chrome.ts";
import type { DayView } from "../data.ts";
import { drawHistory, momentsOf } from "./history.ts";
import { drawOutput, rowCount } from "./output.ts";
import { drawResults, heightOf } from "./results.ts";
import type { RunState } from "../run/runner.ts";
import { THEME } from "./theme.ts";

const SPINNER = "⣾⣽⣻⢿⡿⣟⣯⣷";

const MARGIN = 2;
const TAB_GAP = 5;

/** Blank row, tab labels, the divider, blank row, before a pane begins. */
const HEAD = 4;

/** The shortest the box may be, so a one-row table still looks like a table. */
const LEAST = 12;

/** Rows spent on the page frame and the box before a pane's first line. */
const AROUND = CHROME_ROWS + 2 + HEAD + 1;

/** How many lines of a scrolling pane fit, for clamping a scroll before it is drawn. */
const paneRows = (height: number): number => Math.max(1, height - AROUND);

const status = (run: RunState, tick: number): Span[] => [
  run.isRunning
    ? { text: `${SPINNER[tick % SPINNER.length]} running`, style: THEME.muted }
    : { text: "watching", style: THEME.faint },
];

/** How much a tab has to show, named on the bar so an idle tab still says so. */
function tally(tab: Tab, run: RunState): string {
  if (tab === "history") return "";
  if (run.output.length === 0) return "";
  return tab === "output" ? `${run.output.length} lines` : `${run.output.length} printed`;
}

/**
 * The tab bar: labels inside the box, the divider under them joined to its
 * frame, the active tab lit and underscored.
 */
function drawTabs(inner: Surface, frame: Surface, active: Tab, note: string): void {
  let x = PAD + 1;
  const placed = TABS.map((tab) => {
    const at = x;
    x += tab.length + TAB_GAP;
    return { tab, at };
  });

  for (const { tab, at } of placed) {
    inner.write(at, 1, tab, tab === active ? THEME.title : THEME.hintLabel);
  }
  if (note !== "") inner.writeRight(1, `${note}  `, THEME.faint);

  frame.write(0, 3, `├${"─".repeat(Math.max(0, frame.width - 2))}┤`, THEME.line);
  const lit = placed.find(({ tab }) => tab === active);
  if (lit) frame.write(lit.at - 1, 3, "─".repeat(lit.tab.length + 4), THEME.muted);
}

/** The puzzle's name and how much of it is done, on the right of the title line. */
function drawHeader(header: Surface, day: DayView): void {
  const stars = day.stars === 2 ? "★★" : day.stars === 1 ? "★·" : "  ";
  header.writeRight(0, `${day.title ?? ""}   ${stars}  `, THEME.title);
  header.write(header.width - 4, 0, stars, day.stars > 0 ? THEME.star : THEME.line);
}

/**
 * The box holds the results while they fit and fills the body otherwise: a
 * scrolling pane wants the room, a four-row table does not want an empty frame.
 */
const boxHeight = (tab: Tab, rows: number, body: number): number =>
  tab === "results" ? Math.min(body, Math.max(LEAST, rows + HEAD + 4)) : body;

/** One day, through whichever tab is open. */
export function drawDay(
  surface: Surface,
  day: DayView,
  run: RunState,
  tick: number,
  notice: string | null = null,
  tab: Tab = "results",
  scroll = 0,
): void {
  if (tooSmall(surface)) return;

  const { header, body, footer } = chrome(surface);
  drawHeader(header, day);

  const frame = body.clip({
    x: MARGIN,
    y: 0,
    w: body.width - MARGIN * 2,
    h: boxHeight(tab, heightOf(run.rows), body.height),
  });
  const inner = box(frame, {
    title: stepper(`${run.ref.year} · day ${pad(run.ref.day)}`),
    note: status(run, tick),
    border: THEME.line,
  });

  drawTabs(inner, frame, tab, tally(tab, run));
  const pane = inner.clip({ x: 0, y: HEAD, w: inner.width, h: Math.max(0, inner.height - HEAD) });

  if (tab === "output") drawOutput(pane, run.output, scroll);
  else if (tab === "history") drawHistory(pane, run.ref, scroll);
  else drawResults(pane, day, run);

  keys(footer, [
    { key: "←→", label: "day" },
    { key: "⇥", label: "tab" },
    { key: "r", label: "run" },
    { key: "s", label: "submit" },
    { key: "esc", label: "back" },
    { key: "h", label: "help" },
  ], notice);
}

/** How far back a pane can be scrolled, so a key press cannot run off the end. */
export function scrollLimit(tab: Tab, run: RunState, height: number): number {
  if (tab === "output") return Math.max(0, rowCount(run.output) - paneRows(height));
  if (tab === "history") return Math.max(0, momentsOf(run.ref).length - paneRows(height));
  return 0;
}
