import fs from "node:fs";
import path from "node:path";
import { dataDir } from "../core/config.ts";
import { years } from "../core/workspace.ts";
import type { Ref } from "../core/config.ts";
import { present } from "../core/languages.ts";
import { elapsed } from "../core/format.ts";
import { PARTS, readMeta } from "../core/meta.ts";
import type { Part } from "../core/meta.ts";

export type DayView = {
  day: number;
  stars: number;
  /** Whether adventofcode.com has released it yet. */
  unlocked: boolean;
  /** How long until it does, for a day still to come. */
  unlocksIn: string | null;
  title: string | null;
  langs: string[];
  answers: Record<Part, string | null>;
  /** part -> language -> reproduced the accepted answer, as of the last `aoc test`. */
  verified: Record<Part, Record<string, boolean>>;
  took: string | null;
};

export type YearView = { year: number; days: DayView[]; stars: number };

const DAYS = 25;

/** AoC releases a day at midnight EST, which is 05:00 UTC. */
function untilUnlock({ year, day }: Ref): string | null {
  const ms = Date.UTC(year, 11, day, 5) - Date.now();
  if (ms <= 0) return null;

  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/** The puzzle's own name, from the statement `aoc new` saved. */
function titleOf(ref: Ref): string | null {
  const file = path.join(dataDir(ref), "puzzle.md");
  if (!fs.existsSync(file)) return null;
  const first = fs.readFileSync(file, "utf8").split("\n", 1)[0];
  return /Day\s+\d+:\s*(.+?)\s*-*\s*$/.exec(first.replace(/^#+\s*-*\s*/, ""))?.[1] ?? null;
}

export const knownYears = years;

/** All twenty-five days of a year, whether or not you have touched them. */
export function yearView(year: number): YearView {
  const days = Array.from({ length: DAYS }, (_, index) => {
    const ref: Ref = { year, day: index + 1 };
    const meta = readMeta(ref);
    const pick = <T>(of: (part: Part) => T) => ({ part1: of("part1"), part2: of("part2") }) as Record<Part, T>;

    const unlocksIn = untilUnlock(ref);
    return {
      day: ref.day,
      stars: PARTS.filter((part) => meta[part].answer !== null).length,
      unlocked: unlocksIn === null,
      unlocksIn,
      title: titleOf(ref),
      langs: present(ref).map((lang) => lang.id),
      answers: pick((part) => meta[part].answer),
      verified: pick((part) => meta[part].verified),
      took: elapsed(meta.started, meta.part2.solved ?? meta.part1.solved),
    };
  });

  return { year, days, stars: days.reduce((total, day) => total + day.stars, 0) };
}
