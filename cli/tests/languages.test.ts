import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { LANGUAGES, pythonCommand } from "../core/languages.ts";
import type { Language } from "../core/languages.ts";
import { offloaded } from "../interactive/run/offload.ts";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const INPUT = path.join(FIXTURES, "input.txt");
const REF = { year: 2024, day: 1 };

const onFixture = (lang: Language, dir = FIXTURES): Language => ({
  ...lang,
  solutionPath: () => path.join(dir, lang.id, lang.id === "py" ? "__init__.py" : "index.ts"),
});

for (const lang of LANGUAGES) {
  for (const [how, runner] of [
    ["in the command line", onFixture(lang)],
    ["in the interactive view", offloaded(onFixture(lang))],
  ] as const) {
    test(`${lang.id} ${how}: a part answers, a throwing part reports without hiding it`, async (t) => {
      t.mock.method(console, "log", () => {});
      const { part1, part2 } = await runner.solve(REF, INPUT);

      assert.equal(part1?.answer, "3");
      assert.equal(part1?.error, undefined);
      assert.equal(part2?.answer, null);
      assert.match(part2?.error ?? "", /not written yet/);
    });

    test(`${lang.id} ${how}: only the parts asked for are run`, async (t) => {
      t.mock.method(console, "log", () => {});
      assert.deepEqual(Object.keys(await runner.solve(REF, INPUT, ["part1"])), ["part1"]);
    });
  }
}

test("what the interactive view's solutions print reaches it, apart from the answer", async () => {
  for (const lang of LANGUAGES) {
    const printed: string[] = [];
    const runner = offloaded(onFixture(lang), { onOutput: (line) => printed.push(line) });
    const { part1 } = await runner.solve(REF, INPUT);

    assert.equal(part1?.answer, "3", lang.id);
    assert.ok(printed.includes("printed, not answered"), lang.id);
  }
});

test("the py track runs its own .venv when there is one", (t) => {
  const venv = fs.mkdtempSync(path.join(os.tmpdir(), "aoc-venv-"));
  t.after(() => fs.rmSync(venv, { recursive: true, force: true }));
  const python = path.join(venv, "bin", "python");

  assert.equal(pythonCommand(venv), "python3");
  fs.mkdirSync(path.dirname(python));
  fs.writeFileSync(python, "");
  assert.equal(pythonCommand(venv), python);
});

test("what a solution prints reaches the interactive view while it is still running", async () => {
  for (const lang of LANGUAGES) {
    const controller = new AbortController();
    const printed: string[] = [];
    const runner = offloaded(onFixture(lang, path.join(FIXTURES, "stuck")), {
      onOutput: (line) => {
        printed.push(line);
        if (line === "second") controller.abort();
      },
      signal: () => controller.signal,
    });
    const timer = setTimeout(() => controller.abort(), 5000);

    await assert.rejects(runner.solve(REF, INPUT, ["part1"]), /abandoned/);
    clearTimeout(timer);
    assert.deepEqual(printed, ["first", "second"], lang.id);
  }
});
