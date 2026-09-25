import assert from "node:assert/strict";
import { test } from "node:test";
import { TABS, reduce, refOf, scrollOf } from "../interactive/app.ts";
import type { Screen, State } from "../interactive/app.ts";
import type { Key } from "../tui/keys.ts";

const YEARS = [2023, 2024, 2025];

const state = (over: Partial<State> = {}): State => ({
  years: YEARS,
  view: { year: 2024, days: [], stars: 0 },
  day: 1,
  screen: "calendar",
  tab: "results",
  scrolls: {},
  notice: null,
  overlay: null,
  isDone: false,
  ...over,
});

const char = (c: string): Key => ({ name: "char", char: c }) as Key;
const named = (name: string, over: Partial<Key> = {}): Key => ({ name, ...over }) as Key;

const after = (start: State, ...keys: Key[]): State => keys.reduce((current, key) => reduce(current, key).state, start);

test("q and ctrl-c leave from anywhere, overlay or not", () => {
  for (const screen of ["calendar", "day", "test"] as Screen[]) {
    assert.ok(after(state({ screen }), char("q")).isDone, screen);
  }
  assert.ok(after(state({ overlay: "help" }), named("c", { ctrl: true })).isDone);
});

test("a day rolls into the neighbouring year at either end", () => {
  const first = state({ day: 1, screen: "day" });
  assert.deepEqual(refOf(after(first, named("left"))), { year: 2023, day: 25 });

  const last = state({ day: 25, screen: "day" });
  assert.deepEqual(refOf(after(last, named("right"))), { year: 2025, day: 1 });
});

test("rolling stops at the first and last year rather than falling off", () => {
  const oldest = state({ view: { year: 2023, days: [], stars: 0 }, day: 1 });
  assert.deepEqual(refOf(after(oldest, named("left"))), { year: 2023, day: 1 });

  const newest = state({ view: { year: 2025, days: [], stars: 0 }, day: 25 });
  assert.deepEqual(refOf(after(newest, named("right"))), { year: 2025, day: 25 });
});

test("the calendar moves by a row, and clamps at the edges", () => {
  assert.equal(after(state({ day: 1 }), named("down")).day, 6);
  assert.equal(after(state({ day: 8 }), named("up")).day, 3);
  assert.equal(after(state({ day: 3 }), named("up")).day, 1);
  assert.equal(after(state({ day: 23 }), named("down")).day, 25);
});

test("an overlay swallows the keys of the screen underneath", () => {
  const helped = state({ screen: "day", overlay: "help" });
  assert.equal(after(helped, named("right")).day, 1);
  assert.equal(after(helped, char("r")).overlay, "help");
  assert.equal(reduce(helped, char("r")).effect, undefined);
  assert.equal(after(helped, named("escape")).overlay, null);
});

test("only the submit overlay answers to enter, and only once", () => {
  const asked = state({ screen: "day", overlay: "submit" });
  const step = reduce(asked, named("enter"));
  assert.equal(step.effect, "submit");
  assert.equal(step.state.overlay, null);
  assert.equal(reduce(state({ screen: "day", overlay: "help" }), named("enter")).effect, undefined);
});

test("the help key cannot dismiss a submit confirmation in passing", () => {
  const asked = state({ screen: "day", overlay: "submit" });
  assert.equal(after(asked, char("h")).overlay, "submit");
  assert.equal(after(asked, named("escape")).overlay, null);
  assert.equal(after(state({ overlay: "help" }), char("h")).overlay, null);
});

test("tabs wrap forwards and back, and are reachable by number", () => {
  const day = state({ screen: "day" });
  assert.equal(after(day, named("tab")).tab, TABS[1]);
  assert.equal(after(day, named("tab"), named("tab"), named("tab")).tab, TABS[0]);
  assert.equal(after(day, named("tab", { shift: true })).tab, TABS[TABS.length - 1]);
  assert.equal(after(day, char("3")).tab, TABS[2]);
});

test("the results tab does not scroll, and scrolling never goes below zero", () => {
  const results = state({ screen: "day", tab: "results" });
  assert.equal(scrollOf(after(results, named("up"))), 0);

  const output = state({ screen: "day", tab: "output" });
  assert.equal(scrollOf(after(output, named("up"), named("up"))), 2);
  assert.equal(scrollOf(after(output, named("up"), named("down"), named("down"))), 0);
  assert.equal(scrollOf(after(output, named("pageup"))), 10);
  assert.equal(scrollOf(after(output, named("pageup"), named("end"))), 0);
});

test("each day and tab keeps its own scroll position", () => {
  const output = state({ screen: "day", tab: "output" });
  const scrolled = after(output, named("pageup"));
  assert.equal(scrollOf(scrolled), 10);
  assert.equal(scrollOf({ ...scrolled, tab: "history" }), 0);
  assert.equal(scrollOf({ ...scrolled, day: 2 }), 0);
});

test("a key asks the outside world for the work it cannot do itself", () => {
  assert.equal(reduce(state(), char("n")).effect, "fetch");
  assert.equal(reduce(state({ screen: "day" }), char("r")).effect, "rerun");
  assert.equal(reduce(state({ screen: "day" }), char("o")).effect, "browse");
  assert.equal(reduce(state(), char("t")).effect, "test");
  assert.equal(reduce(state(), char("t")).state.screen, "test");
});

test("a notice is cleared by the next key, whichever key that is", () => {
  const told = state({ notice: "fetched" });
  assert.equal(after(told, named("right")).notice, null);
  assert.equal(after(told, char("h")).notice, null);
  assert.equal(after(told, char("h")).overlay, "help");
});
