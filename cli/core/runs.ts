import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./config.ts";
import type { Ref } from "./config.ts";
import { present } from "./languages.ts";
import { PARTS, readMeta, writeMeta } from "./meta.ts";
import type { Row } from "./solve.ts";

/** What a run's rows say about each language: part -> language -> matched. */
function verifiedFrom(rows: Row[]): Record<string, Record<string, boolean>> {
  const byPart: Record<string, Record<string, boolean>> = {};
  for (const row of rows) {
    if (row.source !== "input" || row.answer === null) continue;
    if (row.status === "unknown") continue;
    byPart[row.part] ??= {};
    byPart[row.part][row.lang] = row.status === "ok";
  }
  return byPart;
}

/** Merges a run's outcome into the day's meta, so one file holds the record. */
export function recordVerified(ref: Ref, rows: Row[]): void {
  const meta = readMeta(ref);
  const byPart = verifiedFrom(rows);
  for (const part of PARTS) {
    meta[part].verified = { ...meta[part].verified, ...byPart[part] };
  }
  writeMeta(ref, meta);
}

/** Languages that produced an answer for each part, from a real-input run. */
export function answeredBy(rows: Row[]): Record<string, string[]> {
  const by: Record<string, string[]> = {};
  for (const row of rows) {
    if (row.source !== "input" || row.answer === null) continue;
    by[row.part] ??= [];
    by[row.part].push(row.lang);
  }
  return by;
}

function newestUnder(dir: string): number {
  let newest = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? newestUnder(full) : fs.statSync(full).mtimeMs);
  }
  return newest;
}

/**
 * Whether anything that decides the answer moved after the given moment: the
 * input and the code. Not meta.json, which the tool writes itself.
 */
export function changedSince(ref: Ref, at: number): boolean {
  const input = path.join(dataDir(ref), "input.txt");
  if (fs.existsSync(input) && fs.statSync(input).mtimeMs > at) return true;
  return present(ref).some((lang) => newestUnder(path.dirname(lang.solutionPath(ref))) > at);
}
