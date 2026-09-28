import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { dataDir, yearDir } from "../core/config.ts";
import { byId } from "../core/languages.ts";
import { PARTS } from "../core/meta.ts";
import type { Part } from "../core/meta.ts";
import { plannedRows } from "../core/solve.ts";
import type { RunMode } from "../core/solve.ts";

const REF = { year: 1999, day: 1 };
const TS = [byId("ts")];

function day(t: { after: (fn: () => void) => void }, files: string[]): void {
  t.after(() => fs.rmSync(yearDir(REF.year), { recursive: true, force: true }));
  fs.mkdirSync(dataDir(REF), { recursive: true });
  for (const file of files) fs.writeFileSync(path.join(dataDir(REF), file), "1\n");
}

const planned = (mode: RunMode, parts: Part[] = PARTS) =>
  plannedRows(REF, TS, { mode, parts }).map((row) => `${row.source} ${row.part}`);

test("the mode picks the inputs, as far as they exist", (t) => {
  day(t, ["sample.txt", "input.txt"]);
  assert.deepEqual(planned("all"), ["sample part1", "sample part2", "input part1", "input part2"]);
  assert.deepEqual(planned("sample"), ["sample part1", "sample part2"]);
  assert.deepEqual(planned("input"), ["input part1", "input part2"]);
});

test("a day without a sample runs on its input alone", (t) => {
  day(t, ["input.txt"]);
  assert.deepEqual(planned("all"), ["input part1", "input part2"]);
  assert.deepEqual(planned("sample"), []);
});

test("only the parts in scope are planned", (t) => {
  day(t, ["sample.txt", "input.txt"]);
  assert.deepEqual(planned("all", ["part2"]), ["sample part2", "input part2"]);
  assert.deepEqual(planned("input", ["part1"]), ["input part1"]);
});
