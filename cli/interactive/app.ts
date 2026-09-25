import type { Key } from "../tui/keys.ts";
import { currentYear } from "../core/config.ts";
import { lastRef } from "../core/state.ts";
import type { Ref } from "../core/config.ts";
import { knownYears, yearView } from "./data.ts";
import type { YearView } from "./data.ts";

const DAYS = 25;
const COLUMNS = 5;
const PAGE = 10;

export type Screen = "calendar" | "day" | "test";
export type Overlay = "help" | "submit" | null;
export type Tab = "results" | "output" | "history";

export const TABS: Tab[] = ["results", "output", "history"];

/** Something only the outside world can do, asked for by a keystroke. */
export type Effect = "rerun" | "browse" | "fetch" | "submit" | "test";

export type State = {
  years: number[];
  view: YearView;
  day: number;
  screen: Screen;
  tab: Tab;
  /** Lines held back from the bottom of each pane, kept per day and per tab. */
  scrolls: Record<string, number>;
  /** A one-off line shown in place of the key hints, cleared by the next key. */
  notice: string | null;
  overlay: Overlay;
  isDone: boolean;
};

export type Step = { state: State; effect?: Effect };

/** Opens where `aoc` left off, or on the most recent year you have anything for. */
export function initial(): State {
  const years = knownYears();
  const last = lastRef();
  const year =
    last && years.includes(last.year)
      ? last.year
      : years.includes(currentYear())
        ? currentYear()
        : years[years.length - 1];

  return {
    years,
    view: yearView(year),
    day: last?.year === year ? last.day : 1,
    screen: "calendar",
    tab: "results",
    scrolls: {},
    notice: null,
    overlay: null,
    isDone: false,
  };
}

export const refOf = (state: State): Ref => ({ year: state.view.year, day: state.day });

/** Re-reads the year from disk, so a run in another terminal shows up here. */
export const refresh = (state: State): State => ({ ...state, view: yearView(state.view.year) });

const scrollKey = (state: State): string => `${state.view.year}-${state.day}-${state.tab}`;

/** Where the pane on screen is scrolled to. Each day remembers each of its tabs. */
export const scrollOf = (state: State): number => state.scrolls[scrollKey(state)] ?? 0;

const withScroll = (state: State, to: number): State => ({
  ...state,
  scrolls: { ...state.scrolls, [scrollKey(state)]: Math.max(0, to) },
});

/** Pulls a remembered offset back within reach when its pane has shrunk. */
export const clampScroll = (state: State, limit: number): State =>
  scrollOf(state) > limit ? withScroll(state, limit) : state;

const typed = (key: Key, chars: string): boolean =>
  key.name === "char" && key.char !== undefined && chars.includes(key.char);

const clamp = (day: number): number => Math.max(1, Math.min(DAYS, day));

const toCalendar = (state: State): State => refresh({ ...state, screen: "calendar" });

const only = (state: State): Step => ({ state });

/**
 * One day forwards or back, rolling into the neighbouring year at either end so
 * a whole event reads as one run of days rather than twenty-five islands.
 */
function step(state: State, by: number): State {
  const next = state.day + by;
  if (next >= 1 && next <= DAYS) return { ...state, day: next };

  const at = state.years.indexOf(state.view.year);
  const target = at + (next < 1 ? -1 : 1);
  if (target < 0 || target >= state.years.length) return state;

  return { ...state, view: yearView(state.years[target]), day: next < 1 ? DAYS : 1 };
}

function toYear(state: State, by: number): State {
  const at = state.years.indexOf(state.view.year);
  const year = state.years[Math.max(0, Math.min(state.years.length - 1, at + by))];
  return year === state.view.year ? state : { ...state, view: yearView(year) };
}

function onCalendar(state: State, key: Key): Step {
  if (key.name === "escape") return only({ ...state, isDone: true });
  if (key.name === "enter") return only({ ...state, screen: "day" });
  if (typed(key, "r")) return only(refresh(state));
  if (typed(key, "n")) return { state, effect: "fetch" };
  if (typed(key, "t")) return { state: { ...state, screen: "test" }, effect: "test" };

  const back = typed(key, "<,") || key.name === "pageup" || (key.shift && key.name === "left");
  const on = typed(key, ">.") || key.name === "pagedown" || (key.shift && key.name === "right");
  if (back) return only(toYear(state, -1));
  if (on) return only(toYear(state, 1));

  if (key.name === "left") return only(step(state, -1));
  if (key.name === "right") return only(step(state, 1));
  if (key.name === "up") return only({ ...state, day: clamp(state.day - COLUMNS) });
  if (key.name === "down") return only({ ...state, day: clamp(state.day + COLUMNS) });
  if (key.name === "home") return only({ ...state, day: 1 });
  if (key.name === "end") return only({ ...state, day: DAYS });

  return only(state);
}

/** Scrolling, which only the panes that can overflow answer to. */
function onScroll(state: State, key: Key): Step | null {
  if (state.tab === "results") return null;
  if (key.name === "up" || typed(key, "k")) return only(withScroll(state, scrollOf(state) + 1));
  if (key.name === "down" || typed(key, "j")) return only(withScroll(state, scrollOf(state) - 1));
  if (key.name === "pageup") return only(withScroll(state, scrollOf(state) + PAGE));
  if (key.name === "pagedown") return only(withScroll(state, scrollOf(state) - PAGE));
  if (key.name === "end") return only(withScroll(state, 0));
  return null;
}

function onDay(state: State, key: Key): Step {
  if (key.name === "escape") return only(toCalendar(state));
  if (key.name === "left") return only(step(state, -1));
  if (key.name === "right") return only(step(state, 1));

  if (key.name === "tab") {
    const at = TABS.indexOf(state.tab);
    const by = key.shift ? TABS.length - 1 : 1;
    return only({ ...state, tab: TABS[(at + by) % TABS.length] });
  }
  if (typed(key, "123")) return only({ ...state, tab: TABS[Number(key.char) - 1] });

  const scrolled = onScroll(state, key);
  if (scrolled) return scrolled;

  if (typed(key, "n")) return { state, effect: "fetch" };
  if (typed(key, "r")) return { state, effect: "rerun" };
  if (typed(key, "o")) return { state, effect: "browse" };
  if (typed(key, "s")) return only({ ...state, overlay: "submit" });
  return only(state);
}

function onTest(state: State, key: Key): Step {
  if (key.name === "escape") return only(toCalendar(state));
  if (typed(key, "t")) return { state, effect: "test" };
  return only(state);
}

/** An overlay swallows the screen's keys; only its own way out gets through. */
function onOverlay(state: State, key: Key): Step {
  if (key.name === "escape") return only({ ...state, overlay: null });
  if (state.overlay === "help" && typed(key, "h")) return only({ ...state, overlay: null });
  if (state.overlay === "submit" && key.name === "enter") {
    return { state: { ...state, overlay: null }, effect: "submit" };
  }
  return only(state);
}

const SCREENS: Record<Screen, (state: State, key: Key) => Step> = {
  calendar: onCalendar,
  day: onDay,
  test: onTest,
};

/** The next state for a keystroke, and what the outside world must do about it. */
export function reduce(state: State, key: Key): Step {
  if (typed(key, "q") || (key.name === "c" && key.ctrl)) return only({ ...state, isDone: true });
  if (state.overlay !== null) return onOverlay(state, key);

  const cleared = state.notice === null ? state : { ...state, notice: null };
  if (typed(key, "h")) return only({ ...cleared, overlay: "help" });
  return SCREENS[cleared.screen](cleared, key);
}
