import assert from "node:assert/strict";
import { test } from "node:test";
import { answersOn, gapsIn, merge, starsOn } from "../core/sync.ts";
import type { Meta, PartRecord } from "../core/meta.ts";

const REF = { year: 2024, day: 1 };

const part = (over: Partial<PartRecord> = {}): PartRecord => ({
  sample: "11",
  answer: null,
  wrong: ["1", "2"],
  solved: null,
  verified: { ts: true },
  ...over,
});

const meta = (part1: Partial<PartRecord> = {}, part2: Partial<PartRecord> = {}): Meta => ({
  started: "2024-12-01T05:02:00.000Z",
  part1: part(part1),
  part2: part(part2),
});

const day = (attrs: string) => `<a ${attrs}>x</a>`;

test("stars are read from the calendar's two classes", () => {
  const html = [
    day('href="/2024/day/1" class="calendar-day1 calendar-verycomplete"'),
    day('href="/2024/day/2" class="calendar-day2 calendar-complete"'),
    day('href="/2024/day/3" class="calendar-day3"'),
    day('class="calendar-day4 calendar-verycomplete" href="/2024/day/4"'),
  ].join("\n");

  const stars = starsOn(html, 2024);
  assert.deepEqual(
    [...stars.entries()].sort((a, b) => a[0] - b[0]),
    [
      [1, 2],
      [2, 1],
      [4, 2],
    ],
  );
});

test("another year's links on the same page are not counted", () => {
  const html = [
    day('href="/2023/day/9" class="calendar-verycomplete"'),
    day('href="https://adventofcode.com/2024/day/9" class="calendar-verycomplete"'),
  ].join("\n");

  assert.deepEqual([...starsOn(html, 2024).keys()], [9]);
  assert.deepEqual([...starsOn(html, 2023).keys()], [9]);
  assert.equal(starsOn(html, 2022).size, 0);
});

test("accepted answers are read in part order", () => {
  const html = `
    <article>the puzzle</article>
    <p>Your puzzle answer was <code>765748</code>.</p>
    <article>part two</article>
    <p>Your puzzle answer was <code>27732508</code>.</p>
    <p>Both parts of this puzzle are complete!</p>`;
  assert.deepEqual(answersOn(html), ["765748", "27732508"]);
});

test("an unsolved page states no answer", () => {
  assert.deepEqual(answersOn("<article>the puzzle</article>"), []);
});

test("anything that is not a bare token is refused rather than recorded", () => {
  const odd = `
    <p>Your puzzle answer was <code>not an answer</code>.</p>
    <p>Your puzzle answer was <code></code>.</p>
    <p>Your puzzle answer was <code>4<b>2</b></code>.</p>`;
  assert.deepEqual(answersOn(odd), []);
});

test("a missing answer is filled in, and nothing else about the record moves", () => {
  const before = meta();
  const { meta: after, recovered, conflicts } = merge(REF, before, ["765748", "27732508"]);

  assert.deepEqual(recovered, ["part1", "part2"]);
  assert.deepEqual(conflicts, []);
  assert.equal(after.part1.answer, "765748");
  assert.equal(after.part2.answer, "27732508");

  assert.deepEqual(after.part1.wrong, ["1", "2"]);
  assert.deepEqual(after.part1.verified, { ts: true });
  assert.equal(after.part1.sample, "11");
  assert.equal(after.part1.solved, null);
  assert.equal(after.started, "2024-12-01T05:02:00.000Z");
});

test("a recorded answer is never replaced, even by a different one", () => {
  const before = meta({ answer: "111", solved: "2024-12-01T06:00:00.000Z" });
  const { meta: after, recovered, conflicts } = merge(REF, before, ["765748", "27732508"]);

  assert.equal(after.part1.answer, "111");
  assert.equal(after.part1.solved, "2024-12-01T06:00:00.000Z");
  assert.deepEqual(recovered, ["part2"]);
  assert.deepEqual(conflicts, [{ ref: REF, part: "part1", local: "111", site: "765748" }]);
});

test("an answer that agrees is neither rewritten nor reported", () => {
  const before = meta({ answer: "765748" });
  const { recovered, conflicts } = merge(REF, before, ["765748"]);
  assert.deepEqual(recovered, []);
  assert.deepEqual(conflicts, []);
});

test("the same answer written differently is not a conflict", () => {
  const { conflicts } = merge(REF, meta({ answer: "765748 " }), [" 765748"]);
  assert.deepEqual(conflicts, []);
});

test("merge leaves the record it was given untouched", () => {
  const before = meta();
  const copy = structuredClone(before);
  merge(REF, before, ["765748", "27732508"]);
  assert.deepEqual(before, copy);
});

test("a part the page says nothing about is left alone", () => {
  const { meta: after, recovered } = merge(REF, meta(), ["765748"]);
  assert.equal(after.part2.answer, null);
  assert.deepEqual(recovered, ["part1"]);
});

test("a day with its statement and input lacks nothing", () => {
  assert.deepEqual(gapsIn("--- Part One ---", true, false), []);
  assert.deepEqual(gapsIn("--- Part One ---\n--- Part Two ---", true, true), []);
});

test("a missing statement or input is fetched", () => {
  assert.deepEqual(gapsIn(null, false, false), ["puzzle.md", "input.txt"]);
  assert.deepEqual(gapsIn(null, true, false), ["puzzle.md"]);
  assert.deepEqual(gapsIn("--- Part One ---", false, false), ["input.txt"]);
});

test("a statement read before part 1 was solved is fetched again for part 2", () => {
  assert.deepEqual(gapsIn("--- Part One ---", true, true), ["puzzle.md"]);
});
