import { fetchCalendar, fetchDayPage } from "./aoc-api.ts";
import type { Ref } from "./config.ts";
import { PARTS, readMeta, same, writeMeta } from "./meta.ts";
import type { Meta, Part } from "./meta.ts";

export type Recovered = { ref: Ref; part: Part; answer: string };
export type Conflict = { ref: Ref; part: Part; local: string; site: string };

export type Report = {
  recovered: Recovered[];
  conflicts: Conflict[];
  /** Days the calendar says are starred, whether or not they needed a request. */
  starred: number;
  /** Days already complete on disk, which cost no request. */
  skipped: number;
};

const ANSWERED = /Your puzzle answer was\s*<code>([^<]{1,64})<\/code>/g;

/**
 * The accepted answers a solved day states, part 1 first. Anything that is not
 * a single bare token is dropped: a page that changes shape must yield nothing
 * rather than something wrong.
 */
export const answersOn = (html: string): string[] =>
  [...html.matchAll(ANSWERED)]
    .map((match) => match[1].trim())
    .filter((answer) => /^[\w.+-]+$/.test(answer));

/**
 * Stars per day, from the year's calendar. Two classes mark progress, and
 * `verycomplete` contains `complete`, so the wider one is tested first.
 */
export function starsOn(html: string, year: number): Map<number, number> {
  const href = new RegExp(`href="(?:https://adventofcode\\.com)?/${year}/day/(\\d+)"`);
  const stars = new Map<number, number>();

  for (const [tag] of html.matchAll(/<a\b[^>]*>/g)) {
    const day = Number(href.exec(tag)?.[1]);
    if (!day) continue;
    const count = /calendar-verycomplete/.test(tag) ? 2 : /calendar-complete/.test(tag) ? 1 : 0;
    if (count > 0) stars.set(day, count);
  }
  return stars;
}

export type Merge = { meta: Meta; recovered: Part[]; conflicts: Conflict[] };

/**
 * What a day's page adds to what is already recorded. Only an answer that is
 * missing is filled in: a recorded one is compared and reported, never
 * replaced, and no other field of the record is touched.
 */
export function merge(ref: Ref, meta: Meta, answers: string[]): Merge {
  const recovered: Part[] = [];
  const conflicts: Conflict[] = [];
  const next: Meta = { ...meta, part1: { ...meta.part1 }, part2: { ...meta.part2 } };

  for (const [index, part] of PARTS.entries()) {
    const site = answers[index];
    const local = meta[part].answer;
    if (site === undefined) continue;

    if (local === null) {
      next[part].answer = site;
      recovered.push(part);
    } else if (!same(local, site)) {
      conflicts.push({ ref, part, local, site });
    }
  }
  return { meta: next, recovered, conflicts };
}

/** Parts the calendar claims a star for and the record cannot account for. */
const wanted = (meta: Meta, stars: number): Part[] =>
  PARTS.slice(0, stars).filter((part) => meta[part].answer === null);

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Spaces out the requests, since this is the one command that walks a year. */
const PAUSE = 400;

export type Progress = (ref: Ref, found: Part[]) => void;

/**
 * Reads back what adventofcode.com has accepted for a year and records the
 * answers that are missing locally. A day already complete on disk is never
 * requested, so a second run costs a single page.
 */
export async function syncYear(year: number, onDay?: Progress): Promise<Report> {
  const stars = starsOn(await fetchCalendar(year), year);
  const report: Report = { recovered: [], conflicts: [], starred: stars.size, skipped: 0 };

  for (const day of [...stars.keys()].sort((a, b) => a - b)) {
    const ref = { year, day };
    const meta = readMeta(ref);
    if (wanted(meta, stars.get(day) ?? 0).length === 0) {
      report.skipped += 1;
      continue;
    }

    const merged = merge(ref, meta, answersOn(await fetchDayPage(ref)));
    if (merged.recovered.length > 0) writeMeta(ref, merged.meta);

    for (const part of merged.recovered) {
      report.recovered.push({ ref, part, answer: merged.meta[part].answer as string });
    }
    report.conflicts.push(...merged.conflicts);
    onDay?.(ref, merged.recovered);

    await wait(PAUSE);
  }
  return report;
}
