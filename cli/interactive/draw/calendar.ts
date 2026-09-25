import type { Surface } from "../../tui/buffer.ts";
import { box } from "../../tui/box.ts";
import { split } from "../../tui/layout.ts";
import type { Style } from "../../tui/style.ts";
import { PARTS } from "../../core/meta.ts";
import { chrome, keys, stepper, tooSmall } from "./chrome.ts";
import { pad } from "../../core/config.ts";
import type { DayView, YearView } from "../data.ts";
import { LANG_STYLE, THEME } from "./theme.ts";

const COLUMNS = 5;
const CELL = 5;
const GAP = 2;
const GRID = COLUMNS * CELL + (COLUMNS - 1) * GAP;
// One column narrower than PAD: the selected day is highlighted with a space
// either side, and the leftmost cell needs that space inside the box.
const LEFT = 2;
const MARGIN = 2;
const BOX_HEIGHT = 15;

const starsOf = (day: DayView): string => (day.stars === 2 ? "★★" : day.stars === 1 ? "★·" : " ·");

function numberStyle(day: DayView, isSelected: boolean): Style {
  if (isSelected) return day.stars > 0 || day.langs.length > 0 ? THEME.selected : THEME.selectedFaint;
  if (!day.unlocked) return THEME.faint;
  if (day.stars > 0) return THEME.title;
  return day.langs.length > 0 ? THEME.text : THEME.muted;
}

function drawCell(surface: Surface, x: number, y: number, day: DayView, isSelected: boolean): void {
  if (isSelected) surface.write(x - 1, y, " ".repeat(CELL + 2), THEME.selected);

  surface.write(x, y, pad(day.day), numberStyle(day, isSelected));
  const stars = starsOf(day);
  const lit = isSelected ? THEME.selectedStar : THEME.star;
  const unlit = isSelected ? THEME.selectedFaint : THEME.line;
  surface.write(x + 3, y, stars[0], stars[0] === "★" ? lit : unlit);
  surface.write(x + 4, y, stars[1], stars[1] === "★" ? lit : unlit);
}

function drawGrid(surface: Surface, view: YearView, selected: number): void {
  for (const [index, day] of view.days.entries()) {
    const x = LEFT + (index % COLUMNS) * (CELL + GAP);
    const y = 1 + Math.floor(index / COLUMNS) * 2;
    if (y >= surface.height) return;
    drawCell(surface, x, y, day, day.day === selected);
  }

  const legend = 2 + Math.floor((view.days.length - 1) / COLUMNS) * 2 + 1;
  if (legend < surface.height) {
    surface.write(LEFT, legend, "★★ both   ★· one   · none", THEME.faint);
  }
}

/** Both parts, with what AoC accepted for each. */
function drawParts(surface: Surface, day: DayView): void {
  for (const [index, part] of PARTS.entries()) {
    const y = 3 + index;
    const answer = day.answers[part];
    surface.write(LEFT, y, answer === null ? "·" : "★", answer === null ? THEME.faint : THEME.star);
    surface.write(LEFT + 3, y, `part ${index + 1}`, THEME.muted);
    surface.write(LEFT + 11, y, answer ?? "—", answer === null ? THEME.faint : THEME.text);
  }
}

/** Each language this day has, and how much of it that language reproduces. */
function drawLanguages(surface: Surface, day: DayView): void {
  let x = LEFT;
  for (const lang of day.langs) {
    const reproduced = PARTS.filter((part) => day.verified[part]?.[lang]).length;
    surface.write(x, 6, lang, LANG_STYLE[lang] ?? THEME.text);
    surface.write(x + lang.length + 1, 6, "★".repeat(reproduced) + "·".repeat(2 - reproduced), THEME.faint);
    x += lang.length + 5;
  }
}

/** For a day with no code, the next move, on the last line out of the way. */
function drawPrompt(surface: Surface, day: DayView): void {
  const y = Math.max(6, surface.height - 2);
  if (day.unlocksIn !== null) {
    surface.write(LEFT, y, `opens in ${day.unlocksIn}`, THEME.faint);
    return;
  }
  surface.write(LEFT, y, "n", THEME.hintKey);
  surface.write(LEFT + 4, y, day.title === null ? "fetch this day" : "start a ts file", THEME.hintLabel);
}

function drawPanel(surface: Surface, day: DayView): void {
  surface.write(
    LEFT,
    1,
    day.title ?? (day.unlocked ? "not fetched" : "not open yet"),
    day.title ? THEME.title : THEME.muted,
  );

  drawParts(surface, day);
  if (day.langs.length > 0) drawLanguages(surface, day);
  else drawPrompt(surface, day);

  if (day.took !== null) surface.write(LEFT, 8, `solved in ${day.took}`, THEME.muted);
}

/** The home screen: the year's grid beside the day under the cursor. */
export function drawCalendar(surface: Surface, view: YearView, selected: number, notice: string | null = null): void {
  if (tooSmall(surface)) return;

  const { header, body, footer } = chrome(surface);
  header.writeRight(0, `${view.stars} ★  `, THEME.muted);
  header.write(header.width - 3, 0, "★", THEME.star);

  const height = Math.min(body.height, BOX_HEIGHT);
  const area = { x: MARGIN, y: 0, w: body.width - MARGIN * 2, h: height };
  const [left, , right] = split(area, "x", [LEFT + GRID + 4, 1, "*"]);

  drawGrid(box(body.clip(left), { title: stepper(String(view.year)), border: THEME.line }), view, selected);
  drawPanel(
    box(body.clip(right), {
      title: [{ text: `day ${pad(selected)}`, style: THEME.title }],
      border: THEME.line,
    }),
    view.days[selected - 1],
  );

  keys(
    footer,
    [
      { key: "↑↓←→", label: "day" },
      { key: "< >", label: "year" },
      { key: "⏎", label: "open" },
      { key: "n", label: "fetch" },
      { key: "t", label: "test" },
      { key: "h", label: "help" },
    ],
    notice,
  );
}
