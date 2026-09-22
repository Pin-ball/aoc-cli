import assert from "node:assert/strict";
import { test } from "node:test";
import { sampleAnswer } from "../core/aoc-api.ts";

test("takes the value set in both code and emphasis", () => {
  assert.equal(sampleAnswer("the similarity score is `**31**` (`9 + 4`)."), "31");
  assert.equal(sampleAnswer("producing **`888911112111`** in the end."), "888911112111");
});

test("ignores prose emphasis and bare code", () => {
  assert.equal(sampleAnswer("So, `**2**` reports are **safe**."), "2");
  assert.equal(sampleAnswer("connect the **1000** closest pairs. Answer: `**40**`."), "40");
  assert.equal(sampleAnswer("a grid of **O** marks; the area is `**50**`."), "50");
});

test("takes the last one, which is the result rather than a step", () => {
  assert.equal(sampleAnswer("first `**5**`, then `**9**`, so the total is `**14**`."), "14");
});

test("a value cannot be pieced together across backticks or lines", () => {
  assert.equal(sampleAnswer("`a` and **b** and `c`"), null);
  assert.equal(sampleAnswer("`**not\nan answer**`"), null);
});

test("refuses anything that is not answer-shaped", () => {
  assert.equal(sampleAnswer("the total is `**12 345**`."), null);
  assert.equal(sampleAnswer("nothing emphasised here at all"), null);
});

test("emphasis inside a longer code span is input, not an answer", () => {
  assert.equal(sampleAnswer("In `**81111111111**111**9**`, turn on everything"), null);
  assert.equal(sampleAnswer("In `**8**1**8**1`, then the total is `**42**`."), "42");
});
