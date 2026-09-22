import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { guard } from "../core/reset.ts";
import { PUZZLES, ROOT } from "../core/config.ts";

const refuses = (dir: string) => assert.throws(() => guard(dir), /Refusing to remove/, dir);
const allows = (dir: string) => assert.doesNotThrow(() => guard(dir), dir);

test("only a directory inside workspace/puzzles can be removed", () => {
  allows(path.join(PUZZLES, "2024"));
  allows(path.join(PUZZLES, "2024", "day05"));
});

test("the puzzles directory itself is never the target", () => {
  refuses(PUZZLES);
  refuses(`${PUZZLES}/`);
  refuses(path.join(PUZZLES, "2024", ".."));
});

test("nothing outside the puzzles directory can be reached", () => {
  refuses("/");
  refuses(ROOT);
  refuses(path.join(ROOT, "workspace", "solutions"));
  refuses(path.join(ROOT, "cli"));
  refuses(path.join(PUZZLES, "..", "solutions"));
  refuses(path.join(PUZZLES, "2024", "..", "..", "solutions", "ts"));
});

test("a relative path is judged where it lands, not how it is spelled", () => {
  refuses("workspace/puzzles");
  refuses("./workspace/puzzles/../puzzles");
});
