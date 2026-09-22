import fs from "node:fs";
import path from "node:path";
import { PUZZLES, SOLUTIONS, currentYear } from "./config.ts";
import { LANGUAGES } from "./languages.ts";

const FIRST_YEAR = 2015;

/** Every year there has been a puzzle for, oldest first. */
export const years = (): number[] =>
  Array.from({ length: currentYear() - FIRST_YEAR + 1 }, (_, index) => FIRST_YEAR + index);

/** A directory a clone can see: git cannot track an empty one. */
function shown(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  const marker = path.join(dir, ".gitkeep");
  if (!fs.existsSync(marker)) fs.writeFileSync(marker, "");
}

/**
 * Makes the workspace ready, on every start. Its shape is committed so a fresh
 * clone shows where things go; the years inside are not, because there are two
 * dozen of them and this rebuilds them anyway.
 */
export function prepare(): void {
  shown(PUZZLES);
  for (const lang of LANGUAGES) {
    shown(path.join(SOLUTIONS, lang.id));
    for (const year of years()) {
      fs.mkdirSync(path.join(SOLUTIONS, lang.id, String(year)), { recursive: true });
    }
  }
}
