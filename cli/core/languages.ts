import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { ROOT, SOLUTIONS, pad } from "./config.ts";
import type { Ref } from "./config.ts";

export type PartResult = { answer: string | null; micros: number; error?: string };
export type DayResult = { part1: PartResult; part2: PartResult };

export type Language = {
  id: string;
  name: string;
  solutionPath(ref: Ref): string;
  scaffold(ref: Ref): void;
  solve(ref: Ref, inputPath: string): Promise<DayResult>;
};

/** What a new day starts from. Ships with the tool, so an empty workspace works. */
const template = (file: string): string =>
  fs.readFileSync(path.join(ROOT, "cli", "templates", file), "utf8");

/**
 * Every day is a folder: <lang>/<year>/dayNN/<entry>. One shape whatever the
 * puzzle turns out to need, so helpers drop in beside the entry point without
 * moving anything first.
 */
const dayFolder = (lang: string, { year, day }: Ref): string =>
  path.join(SOLUTIONS, lang, String(year), `day${pad(day)}`);

const resolver =
  (lang: string, entry: string) =>
  (ref: Ref): string =>
    path.join(dayFolder(lang, ref), entry);

const FLAT_EXTENSION: Record<string, string> = { ts: "ts", py: "py" };

/** Files left in the pre-folder layout, which would otherwise be ignored in silence. */
export const strayFlatFiles = (ref: Ref): string[] =>
  Object.entries(FLAT_EXTENSION)
    .map(([lang, ext]) => `${dayFolder(lang, ref)}.${ext}`)
    .filter((file) => fs.existsSync(file));

function write(file: string, body: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, body);
}

/** What a driver sent back: its result on fd 3, and whatever the day printed. */
export type Spoken = { result: string; stdout: string; stderr: string };

/**
 * Runs a driver with a fourth channel open. The protocol travels on fd 3, so
 * stdout and stderr belong entirely to the solution and nothing it prints can
 * be mistaken for an answer.
 */
function exec(cmd: string, args: string[]): Promise<Spoken> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe", "pipe"] });
    const spoken: Spoken = { result: "", stdout: "", stderr: "" };

    child.stdout.on("data", (d) => (spoken.stdout += d));
    child.stderr.on("data", (d) => (spoken.stderr += d));
    (child.stdio[3] as NodeJS.ReadableStream).on("data", (d) => (spoken.result += d));

    child.on("error", (e) =>
      reject(new Error(`${cmd} could not be started. Is it installed? (${e.message})`)),
    );
    child.on("close", (code) =>
      code === 0
        ? resolve(spoken)
        : reject(new Error(spoken.stderr.trim() || `${cmd} exited ${code}`)),
    );
  });
}

/**
 * The driver's result. fd 3 carries it; a driver run by hand has no fd 3 and
 * falls back to stdout, so that shape is still accepted.
 */
function parseResult({ result, stdout }: Spoken): DayResult {
  const line = (result.trim() || stdout.trim()).split("\n").findLast((l) => l.startsWith("{"));
  if (!line) throw new Error(`driver produced no result:\n${stdout.trim()}`);
  return JSON.parse(line);
}

const blank = (value: unknown): string | null => {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return text === "" ? null : text;
};

const typescript: Language = {
  id: "ts",
  name: "TypeScript",
  solutionPath: resolver("ts", "index.ts"),

  scaffold(ref) {
    write(this.solutionPath(ref), template("day.ts"));
  },

  // Imported in-process rather than spawned so editor breakpoints still work.
  async solve(ref, inputPath) {
    const url = `${pathToFileURL(this.solutionPath(ref)).href}?v=${Date.now()}`;
    const mod = await import(url);
    const input = fs.readFileSync(inputPath, "utf8").replace(/\s+$/, "");

    // Caught per part, so a half-written part 2 does not hide part 1's answer.
    const time = (fn: unknown): PartResult => {
      if (typeof fn !== "function") return { answer: null, micros: 0 };
      const start = performance.now();
      const since = () => Math.round((performance.now() - start) * 1000);
      try {
        return { answer: blank(fn(input)), micros: since() };
      } catch (error) {
        return { answer: null, micros: since(), error: (error as Error).message.split("\n")[0] };
      }
    };
    return { part1: time(mod.part1), part2: time(mod.part2) };
  },
};

const python: Language = {
  id: "py",
  name: "Python",
  solutionPath: resolver("py", "__init__.py"),

  scaffold(ref) {
    write(this.solutionPath(ref), template("day.py"));
  },

  async solve(ref, inputPath) {
    const driver = path.join(ROOT, "cli", "core", "drivers", "py.py");
    return parseResult(await exec("python3", [driver, this.solutionPath(ref), inputPath]));
  },
};

export const LANGUAGES: Language[] = [typescript, python];

export const byId = (id: string): Language => {
  const lang = LANGUAGES.find((l) => l.id === id);
  if (!lang) throw new Error(`Unknown language "${id}". Known: ${LANGUAGES.map((l) => l.id).join(", ")}`);
  return lang;
};

/** Languages that already have a solution file for this day. */
export const present = (ref: Ref): Language[] =>
  LANGUAGES.filter((l) => fs.existsSync(l.solutionPath(ref)));

