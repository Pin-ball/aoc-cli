import assert from "node:assert/strict";
import { test } from "node:test";
import { gaveDay, parse } from "../commands/args.ts";

const day = (tokens: string[]) => parse(tokens).ref;

test("a day and a year are read attached or apart", () => {
  assert.deepEqual(day(["-y", "2024", "-d", "5"]), { year: 2024, day: 5 });
  assert.deepEqual(day(["--year=2024", "--day=5"]), { year: 2024, day: 5 });
  assert.deepEqual(day(["--year", "2024", "--day", "5"]), { year: 2024, day: 5 });
});

test("an option without its value is refused rather than ignored", () => {
  assert.throws(() => parse(["-d"]), /--day needs a value/);
  assert.throws(() => parse(["-y", "2024", "-d"]), /--day needs a value/);
});

test("an option's value must be a number", () => {
  assert.throws(() => parse(["-d", "five"]), /--day takes a number, got "five"/);
  assert.throws(() => parse(["--year=recent"]), /--year takes a number/);
});

test("a year or day outside the event is refused", () => {
  assert.throws(() => parse(["-y", "2014"]), /started in 2015/);
  assert.throws(() => parse(["-d", "0"]), /between 1 and 25/);
  assert.throws(() => parse(["-d", "26"]), /between 1 and 25/);
  assert.doesNotThrow(() => parse(["-y", "2015", "-d", "25"]));
});

test("an unknown option is refused rather than taken for a language", () => {
  assert.throws(() => parse(["--verbose"]), /Unknown option --verbose/);
  assert.throws(() => parse(["-x"]), /Unknown option -x/);
});

test("languages are named plainly, and only where a command takes them", () => {
  assert.deepEqual(
    parse(["-y", "2024", "-d", "5", "ts", "py"]).langs.map((l) => l.id),
    ["ts", "py"],
  );
  assert.throws(() => parse(["ts"], { langs: false }), /takes no language/);
  assert.throws(() => parse(["nope"]), /nope/);
});

test("a bare number is a part, and only submit has somewhere to put it", () => {
  assert.deepEqual(parse(["-y", "2024", "-d", "5", "2"], { rest: true }).rest, ["2"]);
  assert.throws(() => parse(["12"]), /Use --day 12 to name a day/);
});

test("the fallback day is used only when none was given", () => {
  assert.equal(parse(["-y", "2024"], { fallbackDay: 7 }).ref.day, 7);
  assert.equal(parse(["-y", "2024", "-d", "3"], { fallbackDay: 7 }).ref.day, 3);
});

test("gaveDay sees a day in either spelling, and nowhere else", () => {
  assert.ok(gaveDay(["-d", "5"]));
  assert.ok(gaveDay(["--day=5"]));
  assert.ok(!gaveDay(["-y", "2024"]));
  assert.ok(!gaveDay(["5"]));
});
