import assert from "node:assert/strict";
import { test } from "node:test";
import { duration, elapsed } from "../core/format.ts";

test("duration changes unit at each thousand", () => {
  assert.equal(duration(0), "0 µs");
  assert.equal(duration(999), "999 µs");
  assert.equal(duration(1000), "1.0 ms");
  assert.equal(duration(1_000_000), "1.0 s");
});

test("a duration that rounds up to a thousand takes the next unit", () => {
  assert.equal(duration(999_499), "999 ms");
  assert.equal(duration(999_500), "1.0 s");
  assert.equal(duration(999_999), "1.0 s");
});

test("duration keeps a decimal only while it says something", () => {
  assert.equal(duration(1340), "1.3 ms");
  assert.equal(duration(9999), "10.0 ms");
  assert.equal(duration(10_000), "10 ms");
  assert.equal(duration(5_400_000), "5.4 s");
});

const minutes = (count: number): string | null =>
  elapsed("2024-12-01T05:00:00.000Z", new Date(Date.parse("2024-12-01T05:00:00.000Z") + count * 60_000).toISOString());

test("elapsed rounds to minutes, then hours, then days", () => {
  assert.equal(minutes(0), "<1m");
  assert.equal(minutes(1), "1m");
  assert.equal(minutes(59), "59m");
  assert.equal(minutes(60), "1h00");
  assert.equal(minutes(95), "1h35");
  assert.equal(minutes(60 * 24), "1d0h");
  assert.equal(minutes(60 * 50), "2d2h");
});

test("elapsed says nothing rather than guessing", () => {
  assert.equal(elapsed(null, "2024-12-01T05:00:00.000Z"), null);
  assert.equal(elapsed("2024-12-01T05:00:00.000Z", null), null);
  assert.equal(elapsed("not a date", "2024-12-01T05:00:00.000Z"), null);
  assert.equal(minutes(-5), null);
});
