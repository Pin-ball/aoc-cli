import { Surface } from "../../tui/buffer.ts";
import { box } from "../../tui/box.ts";
import { PAD, fits } from "./chrome.ts";
import { readMeta } from "../../core/meta.ts";
import { agreedAnswers } from "../../core/solve.ts";
import { answeredBy } from "../../core/runs.ts";
import { blockedBeforeRunning, choose, isBlocked } from "../../core/submit.ts";
import type { Candidate, Choice } from "../../core/submit.ts";
import type { RunState } from "../run/runner.ts";
import { THEME } from "./theme.ts";

/** What this day would send, judged on the run already on screen. */
export function choiceFor(run: RunState): Choice {
  return (
    blockedBeforeRunning(run.ref, readMeta(run.ref)) ??
    choose(run.ref, readMeta(run.ref), agreedAnswers(run.rows), answeredBy(run.rows))
  );
}

function wrapped(text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line !== "" && line.length + word.length + 1 > width) {
      lines.push(line);
      line = "";
    }
    line = line === "" ? word : `${line} ${word}`;
  }
  if (line !== "") lines.push(line);
  return lines;
}


/** Enough rejected answers to see the bracket you have narrowed to. */
const REJECTED = 3;

/** The answers AoC has already turned down for the part about to be sent. */
const rejectedFor = (run: RunState, choice: Choice): string[] =>
  isBlocked(choice) ? [] : readMeta(run.ref)[choice.part].wrong.slice(-REJECTED);

function drawRefusal(surface: Surface, why: string): void {
  surface.write(PAD, 1, "nothing to send", THEME.muted);
  for (const [index, line] of wrapped(why, surface.width - PAD * 2).entries()) {
    surface.write(PAD, 3 + index, line, THEME.text);
  }
}

function drawOffer(surface: Surface, choice: Candidate, rejected: string[]): void {
  surface.write(PAD, 1, choice.part === "part1" ? "part 1" : "part 2", THEME.muted);
  surface.write(PAD, 2, choice.answer, THEME.title);
  surface.write(PAD, 3, choice.langs.length > 1
    ? `${choice.langs.join(", ")} agree`
    : `from ${choice.langs.join("") || "the last run"}`, THEME.faint);

  let y = 5;
  if (rejected.length > 0) {
    surface.write(PAD, y, "already rejected", THEME.muted);
    y += 1;
    for (const wrong of rejected) {
      surface.write(PAD + 2, y, wrong, THEME.bad);
      y += 1;
    }
    y += 1;
  }

  const prompt = Math.max(y, surface.height - 2);
  surface.write(PAD, prompt, "⏎", THEME.hintKey);
  surface.write(PAD + 4, prompt, "send to adventofcode.com", THEME.hintLabel);
}

/** The last stop before an answer leaves the machine. */
export function drawSubmit(surface: Surface, run: RunState): void {
  if (!fits(surface)) return;

  const choice = choiceFor(run);
  const rejected = rejectedFor(run, choice);
  const width = Math.min(surface.width - 8, 56);
  const height = Math.min(surface.height - 2, isBlocked(choice) ? 9 : 11 + rejected.length);
  if (width < 30 || height < 8) return;

  const frame = surface
    .clip({
      x: Math.floor((surface.width - width) / 2),
      y: Math.floor((surface.height - height) / 2),
      w: width,
      h: height,
    })
    .on(THEME.overlay);
  frame.fill();

  const inner = box(frame, {
    title: [{ text: "submit", style: THEME.title }],
    note: [{ text: "esc cancel", style: THEME.hintLabel }],
    border: THEME.muted,
  });

  if (isBlocked(choice)) drawRefusal(inner, choice.why);
  else drawOffer(inner, choice, rejected);
}
