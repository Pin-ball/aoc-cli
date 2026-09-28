import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { dataDir, yearDir } from "../core/config.ts";
import { fileURLToPath } from "node:url";
import { LANGUAGES, byId } from "../core/languages.ts";
import { PARTS } from "../core/meta.ts";
import type { Part } from "../core/meta.ts";
import { plannedRows, runDay } from "../core/solve.ts";
import type { Row, RunMode } from "../core/solve.ts";
import { offloaded } from "../interactive/run/offload.ts";

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
  assert.deepEqual(planned("all"), ["sample part1", "input part1", "sample part2", "input part2"]);
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

const HANGING = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "hanging");

test("a part still running holds back no part 1, in any language", async (t) => {
  day(t, ["sample.txt", "input.txt"]);
  const controller = new AbortController();
  const hanging = LANGUAGES.map((lang) => {
    const entry = lang.id === "py" ? "__init__.py" : "index.ts";
    return offloaded(
      { ...lang, solutionPath: () => path.join(HANGING, lang.id, entry) },
      { signal: () => controller.signal },
    );
  });
  const timer = setTimeout(() => controller.abort(), 5000);
  let seen: Row[] = [];

  await runDay(REF, hanging, {
    onProgress: (rows) => {
      if (rows.length !== 4 || controller.signal.aborted) return;
      seen = [...rows];
      controller.abort();
    },
  });
  clearTimeout(timer);
  assert.deepEqual(
    seen.map((row) => `${row.lang} ${row.source} ${row.part} ${row.answer}`),
    ["ts sample part1 3", "py sample part1 3", "ts input part1 3", "py input part1 3"],
  );
});
