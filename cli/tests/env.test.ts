import assert from "node:assert/strict";
import { test } from "node:test";
import { settingsFrom } from "../core/env.ts";

const AGENT = "github.com/someone/advent-of-code by someone@mail.org";

test("a hex session and a real agent are used as written", () => {
  const got = settingsFrom({ AOC_SESSION: "53616c7465645f5f", AOC_USER_AGENT: AGENT });
  assert.deepEqual(got, {
    session: { value: "53616c7465645f5f", problem: null },
    userAgent: { value: AGENT, problem: null },
  });
});

test("a session pasted with its cookie name still works", () => {
  assert.equal(settingsFrom({ AOC_SESSION: " session=abc123 " }).session.value, "abc123");
});

test("a missing file, an empty session and a non-hex one are each explained", () => {
  assert.match(settingsFrom(null).session.problem ?? "", /No \.env file/);
  assert.match(settingsFrom({ AOC_SESSION: "" }).session.problem ?? "", /empty/);
  assert.match(settingsFrom({ AOC_SESSION: "not a cookie" }).session.problem ?? "", /hex/);
  assert.equal(settingsFrom({ AOC_SESSION: "not a cookie" }).session.value, null);
});

test("an unset or example agent is refused rather than replaced", () => {
  for (const agent of [undefined, "", "github.com/you/advent-of-code by you@example.com"]) {
    const { userAgent } = settingsFrom({ AOC_SESSION: "abc", AOC_USER_AGENT: agent });
    assert.equal(userAgent.value, null, String(agent));
    assert.notEqual(userAgent.problem, null, String(agent));
  }
});
