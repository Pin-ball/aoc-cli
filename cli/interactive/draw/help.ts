import { Surface } from "../../tui/buffer.ts";
import { box } from "../../tui/box.ts";
import { fits } from "./chrome.ts";
import type { Screen } from "../app.ts";
import { THEME } from "./theme.ts";

type Entry = { key: string; what: string };
type Group = { title: string; entries: Entry[] };

/** Two columns of groups, so the sheet reads across rather than scrolling down. */
type Sheet = { left: Group[]; right: Group[]; leftWidth: number };

const ANYWHERE: Group = {
  title: "anywhere",
  entries: [
    { key: "h", what: "this" },
    { key: "q", what: "quit" },
  ],
};

const CALENDAR: Sheet = {
  leftWidth: 32,
  left: [
    {
      title: "move",
      entries: [
        { key: "↑ ↓ ← →", what: "between days" },
        { key: "< >", what: "year, back and on" },
        { key: "⏎", what: "open the day" },
      ],
    },
  ],
  right: [
    {
      title: "act",
      entries: [
        { key: "n", what: "fetch this day" },
        { key: "t", what: "test the whole year" },
        { key: "r", what: "re-read from disk" },
      ],
    },
    ANYWHERE,
  ],
};

const DAY: Sheet = {
  leftWidth: 39,
  left: [
    {
      title: "move",
      entries: [
        { key: "← →", what: "another day" },
        { key: "esc", what: "back to the calendar" },
      ],
    },
    {
      title: "tabs",
      entries: [
        { key: "⇥ ⇧⇥", what: "next, previous" },
        { key: "1 2 3", what: "results, output, history" },
      ],
    },
    {
      title: "scroll",
      entries: [
        { key: "↑ ↓ j k", what: "by a line" },
        { key: "PgUp Dn", what: "by ten" },
        { key: "end", what: "to the newest" },
      ],
    },
  ],
  right: [
    {
      title: "act",
      entries: [
        { key: "r", what: "run again" },
        { key: "s", what: "submit" },
        { key: "n", what: "fetch this day" },
        { key: "o", what: "open on the site" },
      ],
    },
    ANYWHERE,
  ],
};

const TEST: Sheet = {
  leftWidth: 24,
  left: [
    {
      title: "test",
      entries: [
        { key: "esc", what: "stop, and back" },
        { key: "t", what: "run it again" },
      ],
    },
  ],
  right: [ANYWHERE],
};

const SHEETS: Record<Screen, Sheet> = { calendar: CALENDAR, day: DAY, test: TEST };

/** Room the right column needs before the left one starts giving way. */
const RIGHT = 24;

const height = (groups: Group[]): number =>
  groups.reduce((total, group) => total + group.entries.length + 2, 0) - 1;

const widest = (groups: Group[]): number =>
  Math.max(...groups.flatMap((group) => group.entries.map((entry) => entry.key.length)));

function column(surface: Surface, groups: Group[]): void {
  const keys = widest(groups) + 2;
  let y = 0;

  for (const group of groups) {
    surface.write(0, y, group.title, THEME.muted);
    y += 1;
    for (const entry of group.entries) {
      if (y >= surface.height) return;
      surface.write(1, y, entry.key, THEME.hintKey);
      surface.write(1 + keys, y, entry.what, THEME.text);
      y += 1;
    }
    y += 1;
  }
}

/** Every key of the screen underneath, floating over it. */
export function drawHelp(surface: Surface, screen: Screen): void {
  if (!fits(surface)) return;
  const sheet = SHEETS[screen] ?? DAY;
  const rows = Math.max(height(sheet.left), height(sheet.right));
  const width = Math.min(surface.width - 6, sheet.leftWidth + RIGHT + 2);
  const tall = Math.min(surface.height - 2, rows + 4);
  if (width < 34 || tall < 7) return;

  const area = {
    x: Math.floor((surface.width - width) / 2),
    y: Math.floor((surface.height - tall) / 2),
    w: width,
    h: tall,
  };

  const frame = surface.clip(area).on(THEME.overlay);
  frame.fill();
  const inner = box(frame, {
    title: [{ text: "keys", style: THEME.title }],
    note: [{ text: "esc close", style: THEME.hintLabel }],
    border: THEME.muted,
  });

  const body = inner.clip({ x: 0, y: 1, w: inner.width, h: inner.height - 1 });
  // The split gives way before the frame does, so a narrow terminal truncates
  // a description rather than spilling one column over the other.
  const split = Math.min(sheet.leftWidth, Math.max(16, body.width - RIGHT));
  column(body.clip({ x: 2, y: 0, w: split - 3, h: body.height }), sheet.left);
  column(body.clip({ x: split, y: 0, w: body.width - split, h: body.height }), sheet.right);
}
