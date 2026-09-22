import { pad } from "./config.ts";
import type { Ref } from "./config.ts";
import { fetchPuzzle, submitAnswer } from "./aoc-api.ts";
import type { SubmitVerdict } from "./aoc-api.ts";
import { PARTS, readMeta, writeMeta } from "./meta.ts";
import type { Meta, Part } from "./meta.ts";

/** An answer cleared to be sent, and the languages that stand behind it. */
export type Candidate = { part: Part; answer: string; langs: string[] };

/** Why nothing can be sent. Every one of these is a submission not wasted. */
export type Blocked = { why: string };

export type Choice = Candidate | Blocked;

export const isBlocked = (choice: Choice): choice is Blocked => "why" in choice;

const where = (ref: Ref): string => `${ref.year} day ${pad(ref.day)}`;

/**
 * Everything refusable without solving. Checked first so a day that takes
 * minutes is never solved only to be told there was nothing to send.
 */
export function blockedBeforeRunning(ref: Ref, meta: Meta, forced?: Part): Blocked | null {
  if (forced && meta[forced].answer !== null) {
    return { why: `${where(ref)} ${forced} is already solved (${meta[forced].answer}).` };
  }
  if (PARTS.every((part) => meta[part].answer !== null)) {
    return { why: `${where(ref)} is already solved.` };
  }
  return null;
}

/**
 * What to send for a day, given what a run produced. `computed` is
 * `agreedAnswers`, so a part the languages disagreed on arrives as null and is
 * refused rather than guessed at.
 */
export function choose(
  ref: Ref,
  meta: Meta,
  computed: Record<string, string | null>,
  credited: Record<string, string[]>,
  forced?: Part,
): Choice {
  // An unsolved part the run has an opinion about, even a null one: a
  // disagreement must be reported as such, not as nothing having been produced.
  const part = forced ?? PARTS.find((p) => meta[p].answer === null && p in computed);
  if (!part) return { why: `Nothing to submit for ${where(ref)}: no part produced an answer.` };

  const answer = computed[part];
  if (answer === undefined) return { why: `${part} produced no answer for ${where(ref)}.` };
  if (answer === null) {
    return { why: `Languages disagreed on ${part} for ${where(ref)}. Fix that before submitting.` };
  }

  const record = meta[part];
  if (record.answer !== null) {
    return { why: `${where(ref)} ${part} is already solved (${record.answer}).` };
  }
  if (record.wrong.includes(answer)) {
    return { why: `${answer} was already rejected for ${where(ref)} ${part}.` };
  }
  // AoC answers are a single token. Anything else means the solution returned
  // something unfinished, and sending it would burn a submission.
  if (!/^[\w.+-]+$/.test(answer)) {
    return { why: `${part} returned ${JSON.stringify(answer)}, which is not an answer.` };
  }

  return { part, answer, langs: credited[part] ?? [] };
}

/** Sends an answer and records the verdict. The only place a submission is written down. */
export async function send(ref: Ref, candidate: Candidate): Promise<SubmitVerdict> {
  const { part, answer, langs } = candidate;
  const level = part === "part1" ? 1 : 2;
  const verdict = await submitAnswer(ref, level, answer);

  const meta = readMeta(ref);
  const record = meta[part];

  if (verdict.kind === "correct") {
    record.answer = answer;
    record.solved ??= new Date().toISOString();
    // The languages that produced it have now been proved right by AoC itself.
    for (const lang of langs) record.verified[lang] = true;
    writeMeta(ref, meta);
    if (level === 1) await fetchPuzzle(ref);
    return verdict;
  }

  if (verdict.kind === "wrong") {
    record.wrong.push(answer);
    writeMeta(ref, meta);
  }
  return verdict;
}
