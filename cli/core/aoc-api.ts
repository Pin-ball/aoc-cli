import fs from "node:fs";
import path from "node:path";
import { currentYear, dataDir } from "./config.ts";
import { settings } from "./env.ts";
import { PARTS, readMeta, writeMeta } from "./meta.ts";
import type { Ref } from "./config.ts";

const BASE = "https://adventofcode.com";

/** Puzzles unlock at midnight EST (UTC-5). */
export const unlockTime = ({ year, day }: Ref): Date => new Date(Date.UTC(year, 11, day, 5, 0, 0));

export const puzzleUrl = ({ year, day }: Ref): string => `${BASE}/${year}/day/${day}`;

export const calendarUrl = (year: number): string => `${BASE}/${year}`;

function headers(): Record<string, string> {
  const { session, userAgent } = settings();
  if (session.problem !== null) throw new Error(session.problem);
  if (userAgent.problem !== null) throw new Error(userAgent.problem);
  return { cookie: `session=${session.value}`, "user-agent": userAgent.value };
}

async function get(url: string): Promise<string> {
  const response = await fetch(url, { headers: headers() });
  if (response.status === 404) throw new Error("Not found. Is the day correct?");
  if (!response.ok) {
    throw new Error(
      `${response.status} ${response.statusText}` +
        (response.status === 400 ? ". Your AOC_SESSION has probably expired." : ""),
    );
  }
  return response.text();
}

/** The year's calendar, which marks how many stars each day has. */
export const fetchCalendar = (year: number): Promise<string> => get(calendarUrl(year));

export type Account = { signedIn: boolean; name: string | null };

/** Whether AoC takes the session, and the name it knows you by when it shows one. */
export async function account(): Promise<Account> {
  const html = await get(calendarUrl(currentYear()));
  if (/href="\/auth\/login"|\[Log In\]/.test(html)) return { signedIn: false, name: null };
  const name = html.match(/<div class="user">([^<]+)/)?.[1].trim() || null;
  return { signedIn: true, name };
}

/** A day's page, which states the accepted answers for the parts you have solved. */
export const fetchDayPage = (ref: Ref): Promise<string> => get(puzzleUrl(ref));

/**
 * Downloads the input once and caches it. Leading whitespace is significant in
 * grid puzzles, so only the trailing newline is stripped.
 */
export async function fetchInput(ref: Ref): Promise<string> {
  const file = path.join(dataDir(ref), "input.txt");
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");

  const until = unlockTime(ref).getTime() - Date.now();
  if (until > 0) {
    throw new Error(`Puzzle unlocks in ${Math.ceil(until / 60000)} min.`);
  }

  const body = (await get(`${BASE}/${ref.year}/day/${ref.day}/input`)).replace(/\s+$/, "");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${body}\n`);
  return body;
}

const ENTITIES: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

const decode = (html: string): string => html.replace(/&(?:lt|gt|amp|quot|apos|#39);/g, (m) => ENTITIES[m] ?? m);

/**
 * AoC's markup is small and stable, so a handful of replacements beat pulling
 * in an HTML parser and keep the repo dependency-free.
 */
function toMarkdown(html: string): string {
  return decode(
    html
      .replace(/<h2>(.*?)<\/h2>/gs, "\n## $1\n")
      .replace(/<pre><code>(.*?)<\/code><\/pre>/gs, (_, code) => `\n\`\`\`\n${code}\`\`\`\n`)
      .replace(/<li>(.*?)<\/li>/gs, "- $1")
      .replace(/<\/?(?:ul|p)>/g, "\n")
      .replace(/<em[^>]*>(.*?)<\/em>/gs, "**$1**")
      .replace(/<code>(.*?)<\/code>/gs, "`$1`")
      .replace(
        /<a [^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gs,
        (_, href, label) => `[${label}](${href.startsWith("/") ? BASE + href : href})`,
      )
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** AoC sets an example's answer in code and emphasis together, and nothing else. */
const ANSWER = /`\*\*([^`*\n]+)\*\*`|\*\*`([^`*\n]+)`\*\*/g;

/**
 * The answer a part states for its example: the last value it both emphasised
 * and set in code. Prose emphasis (`**safe**`) and bare code (`` `1000` ``)
 * are all over a statement; the two together are how AoC marks the result.
 */
export function sampleAnswer(markdown: string): string | null {
  const values = [...markdown.matchAll(ANSWER)]
    .map((match) => (match[1] ?? match[2]).trim())
    .filter((value) => /^[\w.+-]+$/.test(value));
  return values.at(-1) ?? null;
}

/**
 * Records what each part says its example answers, so a sample run can assert
 * rather than only print. Never overwrites: a value corrected by hand stays.
 */
function rememberSamples(ref: Ref, articles: string[]): void {
  const meta = readMeta(ref);
  let changed = false;

  for (const [index, part] of PARTS.entries()) {
    const article = articles[index];
    if (article === undefined || meta[part].sample !== null) continue;
    const answer = sampleAnswer(toMarkdown(article));
    if (answer === null) continue;
    meta[part].sample = answer;
    changed = true;
  }

  if (changed) writeMeta(ref, meta);
}

/**
 * Fetches the statement. Re-run after solving part 1 to pick up part 2, and
 * writes sample.txt from the first code block when it does not exist yet.
 */
export async function fetchPuzzle(ref: Ref): Promise<void> {
  const html = await get(`${BASE}/${ref.year}/day/${ref.day}`);
  const articles = [...html.matchAll(/<article[^>]*>(.*?)<\/article>/gs)].map((m) => m[1]);
  if (articles.length === 0) throw new Error("Could not find the puzzle text.");

  const dir = dataDir(ref);
  fs.mkdirSync(dir, { recursive: true });

  // Part 2 is only served once part 1 is solved, so a re-fetch on an unsolved
  // day would replace a two-part statement with a one-part one.
  const file = path.join(dir, "puzzle.md");
  const kept = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (articles.length > 1 || !/Part Two/i.test(kept)) {
    fs.writeFileSync(file, `${articles.map(toMarkdown).join("\n\n")}\n`);
  }

  rememberSamples(ref, articles);

  const sample = path.join(dir, "sample.txt");
  const firstBlock = articles[0].match(/<pre><code>(.*?)<\/code><\/pre>/s);
  if (firstBlock && !fs.existsSync(sample)) {
    fs.writeFileSync(sample, `${decode(firstBlock[1].replace(/<[^>]+>/g, "")).replace(/\s+$/, "")}\n`);
  }
}

export type SubmitVerdict =
  | { kind: "correct" }
  | { kind: "wrong"; hint: string }
  | { kind: "wait"; message: string }
  | { kind: "unknown"; message: string };

export async function submitAnswer(ref: Ref, level: 1 | 2, answer: string): Promise<SubmitVerdict> {
  const response = await fetch(`${BASE}/${ref.year}/day/${ref.day}/answer`, {
    method: "POST",
    headers: { ...headers(), "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ level: String(level), answer }).toString(),
  });
  const text = toMarkdown((await response.text()).match(/<article[^>]*>(.*?)<\/article>/s)?.[1] ?? "");

  if (/That's the right answer/i.test(text)) return { kind: "correct" };
  if (/not the right answer/i.test(text)) {
    const hint = text.match(/your answer is too (high|low)/i)?.[0] ?? "no hint given";
    return { kind: "wrong", hint };
  }
  if (/answer too recently/i.test(text)) {
    return { kind: "wait", message: text.match(/You have (.*?) left to wait/)?.[0] ?? text };
  }
  return { kind: "unknown", message: text };
}
