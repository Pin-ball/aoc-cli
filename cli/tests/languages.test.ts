import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { LANGUAGES } from "../core/languages.ts";
import type { Language } from "../core/languages.ts";
import { offloaded } from "../interactive/run/offload.ts";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const INPUT = path.join(FIXTURES, "input.txt");
const REF = { year: 2024, day: 1 };

const onFixture = (lang: Language): Language => ({
  ...lang,
  solutionPath: () => path.join(FIXTURES, lang.id, lang.id === "py" ? "__init__.py" : "index.ts"),
});

for (const lang of LANGUAGES) {
  for (const [how, runner] of [
    ["in the command line", onFixture(lang)],
    ["in the interactive view", offloaded(onFixture(lang))],
  ] as const) {
    test(`${lang.id} ${how}: a part answers, a throwing part reports without hiding it`, async (t) => {
      t.mock.method(console, "log", () => {});
      const { part1, part2 } = await runner.solve(REF, INPUT);

      assert.equal(part1.answer, "3");
      assert.equal(part1.error, undefined);
      assert.equal(part2.answer, null);
      assert.match(part2.error ?? "", /not written yet/);
    });
  }
}

test("what the interactive view's solutions print reaches it, apart from the answer", async () => {
  for (const lang of LANGUAGES) {
    const printed: string[] = [];
    const runner = offloaded(onFixture(lang), { onOutput: (line) => printed.push(line) });
    const { part1 } = await runner.solve(REF, INPUT);

    assert.equal(part1.answer, "3", lang.id);
    assert.ok(printed.includes("printed, not answered"), lang.id);
  }
});
