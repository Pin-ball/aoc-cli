import assert from "node:assert/strict";
import { test } from "node:test";
import { nodeCheck, pathCheck, pythonCheck } from "../core/doctor.ts";

test("node passes from the version the engines field asks for", () => {
  assert.equal(nodeCheck("24.0.0").status, "ok");
  assert.equal(nodeCheck("25.1.0").status, "ok");
  assert.equal(nodeCheck("23.6.0").status, "fail");
});

test("python is only a warning, since only the py track needs it", () => {
  assert.equal(pythonCheck("Python 3.12.3").status, "ok");
  assert.equal(pythonCheck("Python 3.13.0").status, "ok");
  assert.equal(pythonCheck("Python 4.0.0").status, "ok");
  assert.equal(pythonCheck("Python 3.11.9").status, "warn");
  assert.equal(pythonCheck(null).status, "warn");
});

test("python names the .venv it runs from", () => {
  assert.equal(pythonCheck("Python 3.13.0", ".venv").note, "3.13.0, from .venv");
  assert.equal(pythonCheck("Python 3.11.9", ".venv").note, "3.11.9, from .venv, the py track needs 3.12");
  assert.match(pythonCheck(null, ".venv").note, /\.venv does not run/);
});

test("aoc on PATH is judged by where it lands, not by whether it exists", () => {
  assert.equal(pathCheck("/clone/aoc", "/clone/aoc").status, "ok");
  assert.match(pathCheck("/other/aoc", "/clone/aoc").note, /\/other\/aoc/);
  assert.equal(pathCheck(null, "/clone/aoc").status, "warn");
});
