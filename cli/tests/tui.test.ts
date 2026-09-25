import assert from "node:assert/strict";
import { test } from "node:test";
import { box } from "../tui/box.ts";
import { Surface } from "../tui/buffer.ts";
import { decode } from "../tui/keys.ts";
import { split } from "../tui/layout.ts";
import { PALETTE, sgr } from "../tui/style.ts";

const RECT = { x: 0, y: 0, w: 20, h: 10 };

test("split hands the remainder to the last flexible track", () => {
  const [a, b, c] = split(RECT, "x", [3, "*", "*"]);
  assert.deepEqual([a.w, b.w, c.w], [3, 8, 9]);
  assert.equal(a.w + b.w + c.w, RECT.w);
});

test("split never runs past the rectangle it was given", () => {
  const tracks = split(RECT, "y", [4, 4, 4, 4]);
  assert.deepEqual(
    tracks.map((t) => t.h),
    [4, 4, 2, 0],
  );
});

test("a surface clipped past its edge reports no room rather than negative room", () => {
  const surface = Surface.create(10, 4);
  const beyond = surface.clip({ x: 12, y: 0, w: 5, h: 2 });
  assert.equal(beyond.width, 0);
  beyond.write(0, 0, "nope");
  assert.equal(surface.lines().join(""), "");
});

test("writing past the right edge is clipped, not wrapped", () => {
  const surface = Surface.create(6, 2);
  surface.write(3, 0, "abcdef");
  assert.deepEqual(surface.lines(), ["   abc", ""]);
});

test("a clipped surface cannot paint outside its window", () => {
  const surface = Surface.create(8, 3);
  surface.clip({ x: 2, y: 1, w: 3, h: 1 }).write(0, 0, "abcdef");
  assert.deepEqual(surface.lines(), ["", "  abc", ""]);
});

test("a base style is inherited by what a write does not set", () => {
  const surface = Surface.create(4, 1).on({ bg: PALETTE.faint, fg: PALETTE.fg });
  surface.write(0, 0, "ab", { fg: PALETTE.gold });
  assert.deepEqual(surface.at(0, 0).style, { bg: PALETTE.faint, fg: PALETTE.gold });
  surface.fill();
  assert.deepEqual(surface.at(0, 0).style, { bg: PALETTE.faint, fg: PALETTE.fg });
});

test("a box returns the surface inside its frame", () => {
  const surface = Surface.create(10, 4);
  const inner = box(surface);
  assert.deepEqual([inner.width, inner.height], [8, 2]);
  inner.write(0, 0, "x".repeat(20));
  assert.deepEqual(surface.lines(), ["╭────────╮", "│xxxxxxxx│", "│        │", "╰────────╯"]);
});

test("a box too small to draw leaves the surface alone", () => {
  const surface = Surface.create(3, 1);
  assert.equal(box(surface).width, 3);
  assert.equal(surface.lines().join(""), "");
});

test("decode reads arrows, modifiers and control keys", () => {
  assert.deepEqual(decode("\u001b[A"), [{ name: "up", shift: false, ctrl: false }]);
  assert.deepEqual(decode("\u001b[1;2C"), [{ name: "right", shift: true, ctrl: false }]);
  assert.deepEqual(decode("\u001b[Z"), [{ name: "tab", shift: true, ctrl: false }]);
  assert.deepEqual(decode("\u0003"), [{ name: "c", shift: false, ctrl: true }]);
  assert.deepEqual(decode("\r"), [{ name: "enter", shift: false, ctrl: false }]);
  assert.deepEqual(decode("\u001b[6~"), [{ name: "pagedown", shift: false, ctrl: false }]);
});

test("decode keeps every key of a chunk that arrived at once", () => {
  assert.deepEqual(
    decode("\u001b[C\u001b[Cx").map((k) => k.char ?? k.name),
    ["right", "right", "x"],
  );
});

test("sgr says nothing when there is no colour to say it in", () => {
  assert.equal(sgr({ fg: PALETTE.gold }, "none"), "");
  assert.match(sgr({ fg: PALETTE.gold }, "truecolor"), /38;2;255;255;102/);
  assert.match(sgr({ bold: true }, "ansi16"), /^\u001b\[0;1m$/);
});
