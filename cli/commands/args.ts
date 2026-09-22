import { currentYear, pad, shown } from "../core/config.ts";
import type { Ref } from "../core/config.ts";
import { byId, present, strayFlatFiles } from "../core/languages.ts";
import type { Language } from "../core/languages.ts";
import { lastRef } from "../core/state.ts";

type Args = { ref: Ref; langs: Language[]; rest: string[] };

/** What a command can make use of. Anything else is refused rather than dropped. */
type Accepts = { langs?: boolean; rest?: boolean; fallbackDay?: number };

function whole(value: string, name: string): number {
  if (!/^\d+$/.test(value)) throw new Error(`--${name} takes a number, got "${value}".`);
  return Number(value);
}

/** `-y`/`--year` and `-d`/`--day`; everything left over is a language or a part. */
export function parse(tokens: string[], accepts: Accepts = {}): Args {
  const { langs: takesLangs = true, rest: takesRest = false, fallbackDay } = accepts;
  const langs: Language[] = [];
  const rest: string[] = [];
  let year: number | undefined;
  let day: number | undefined;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const valueOf = (name: string) => {
      const inline = token.indexOf("=");
      const value = inline > -1 ? token.slice(inline + 1) : tokens[(i += 1)];
      if (value === undefined) throw new Error(`--${name} needs a value.`);
      return whole(value, name);
    };

    if (/^(-y|--year)(=|$)/.test(token)) year = valueOf("year");
    else if (/^(-d|--day)(=|$)/.test(token)) day = valueOf("day");
    else if (token.startsWith("-")) throw new Error(`Unknown option ${token}.`);
    else if (/^\d+$/.test(token)) rest.push(token);
    else if (takesLangs) langs.push(byId(token));
    else throw new Error(`This command takes no language (${token}).`);
  }

  if (rest.length > 0 && !takesRest) {
    throw new Error(`Use --day ${rest[0]} to name a day.`);
  }
  if (year !== undefined && year < 2015) throw new Error("Advent of Code started in 2015.");
  if (day !== undefined && (day < 1 || day > 25)) throw new Error("Day must be between 1 and 25.");

  const previous = lastRef();
  const ref = {
    year: year ?? previous?.year ?? currentYear(),
    day: day ?? fallbackDay ?? previous?.day ?? 1,
  };
  return { ref, langs, rest };
}

/** Whether the caller named a day, rather than leaving it to the last run. */
export const gaveDay = (tokens: string[]) => tokens.some((t) => /^(-d|--day)(=|$)/.test(t));

/** Whether the caller named a year, for a command that will not assume one. */
export const gaveYear = (tokens: string[]) => tokens.some((t) => /^(-y|--year)(=|$)/.test(t));

export function resolveLangs(ref: Ref, chosen: Language[]): Language[] {
  const found = present(ref);

  if (chosen.length > 0) {
    const missing = chosen.filter((lang) => !found.includes(lang)).map((lang) => lang.id);
    if (missing.length > 0) {
      throw new Error(
        `No ${missing.join(", ")} solution for ${ref.year} day ${pad(ref.day)}. ` +
          `Run: aoc new -y ${ref.year} -d ${ref.day} ${missing.join(" ")}`,
      );
    }
    return chosen;
  }

  if (found.length > 0) return found;

  const strays = strayFlatFiles(ref);
  if (strays.length > 0) {
    throw new Error(
      `A day is a folder now. Move ${strays.map(shown).join(", ")} ` +
        `into day${pad(ref.day)}/ as the entry point.`,
    );
  }

  throw new Error(
    `No solution yet for ${ref.year} day ${pad(ref.day)}. Run: aoc new -y ${ref.year} -d ${ref.day} ts`,
  );
}
