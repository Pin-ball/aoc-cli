import assert from "node:assert/strict";
import { test } from "node:test";
import { blockedBeforeRunning, choose, isBlocked } from "../core/submit.ts";
import type { Choice } from "../core/submit.ts";
import type { Meta, PartRecord } from "../core/meta.ts";

const REF = { year: 2024, day: 1 };

const part = (over: Partial<PartRecord> = {}): PartRecord => ({
  sample: null,
  answer: null,
  wrong: [],
  solved: null,
  verified: {},
  ...over,
});

const meta = (part1: Partial<PartRecord> = {}, part2: Partial<PartRecord> = {}): Meta => ({
  started: null,
  part1: part(part1),
  part2: part(part2),
});

const why = (choice: Choice): string => (isBlocked(choice) ? choice.why : "not blocked");

test("a solved day is refused before anything is run", () => {
  const both = meta({ answer: "1" }, { answer: "2" });
  assert.match(blockedBeforeRunning(REF, both)?.why ?? "", /already solved/);
  assert.equal(blockedBeforeRunning(REF, meta({ answer: "1" })), null);
});

test("a part named on the command line is refused when it is already solved", () => {
  const done = meta({ answer: "765748" });
  assert.match(blockedBeforeRunning(REF, done, "part1")?.why ?? "", /part1 is already solved/);
  assert.equal(blockedBeforeRunning(REF, done, "part2"), null);
});

test("the first unsolved part is the one chosen", () => {
  const chosen = choose(REF, meta({ answer: "11" }), { part1: "11", part2: "31" }, {});
  assert.deepEqual(chosen, { part: "part2", answer: "31", langs: [] });
});

test("languages that produced the answer are carried through for crediting", () => {
  const chosen = choose(REF, meta(), { part1: "11" }, { part1: ["ts", "py"] });
  assert.deepEqual(chosen, { part: "part1", answer: "11", langs: ["ts", "py"] });
});

test("a null answer is a disagreement between languages, not a missing one", () => {
  assert.match(why(choose(REF, meta(), { part1: null }, {})), /disagreed on part1/);
});

test("a part absent from the run is refused as having produced nothing", () => {
  assert.match(why(choose(REF, meta(), {}, {})), /no part produced an answer/);
  assert.match(why(choose(REF, meta(), { part2: "31" }, {}, "part1")), /part1 produced no answer/);
});

test("an answer already rejected is never sent a second time", () => {
  const burnt = meta({ wrong: ["11", "12"] });
  assert.match(why(choose(REF, burnt, { part1: "11" }, {})), /11 was already rejected/);
  assert.deepEqual(choose(REF, burnt, { part1: "13" }, {}), {
    part: "part1",
    answer: "13",
    langs: [],
  });
});

test("only a single bare token can be an answer", () => {
  for (const answer of ["", "no idea", "[1, 2]", "11\n31", "  "]) {
    assert.match(why(choose(REF, meta(), { part1: answer }, {})), /is not an answer/);
  }
  for (const answer of ["11", "abc", "3.5", "-4", "a+b", "x_1"]) {
    assert.ok(!isBlocked(choose(REF, meta(), { part1: answer }, {})), answer);
  }
});

test("a forced part overrides the run's own opinion of what is next", () => {
  const chosen = choose(REF, meta(), { part1: "11", part2: "31" }, {}, "part2");
  assert.deepEqual(chosen, { part: "part2", answer: "31", langs: [] });
});
