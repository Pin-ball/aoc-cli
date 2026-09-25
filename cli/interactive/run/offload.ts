import path from "node:path";
import { spawn } from "node:child_process";
import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { ROOT } from "../../core/config.ts";
import { SAMPLE_FILE } from "../../core/meta.ts";
import type { Ref } from "../../core/config.ts";
import { pipesOf } from "../../core/languages.ts";
import type { DayResult, Language } from "../../core/languages.ts";

const WORKER = path.join(path.dirname(fileURLToPath(import.meta.url)), "worker.ts");
const PY_DRIVER = path.join(ROOT, "cli", "core", "drivers", "py.py");

export type Stream = "stdout" | "stderr";
export type Sink = (line: string, stream: Stream) => void;

/** A sink that also knows which input produced the line. */
export type Tagged = (line: string, stream: Stream, source: string) => void;

export type Offload = {
  onOutput?: Tagged;
  /** Read per run, not per day, so each run can be abandoned on its own. */
  signal?: () => AbortSignal | undefined;
};

type Options = { onOutput?: Sink; signal?: AbortSignal };

export class Abandoned extends Error {
  constructor() {
    super("run abandoned");
  }
}

/**
 * Splits a byte stream into whole lines, so a chunk that ends mid-line does not
 * arrive as a line of its own.
 */
function lineReader(emit: (line: string) => void): { push(chunk: string): void; end(): void } {
  let held = "";
  return {
    push(chunk) {
      held += chunk;
      const lines = held.split("\n");
      held = lines.pop() ?? "";
      for (const line of lines) emit(line);
    },
    end() {
      if (held !== "") emit(held);
      held = "";
    },
  };
}

function workerFlags(): string[] | undefined {
  const kept = process.execArgv.filter((flag) => !flag.startsWith("--input-type"));
  return kept.length === process.execArgv.length ? undefined : kept;
}

/**
 * Runs a TypeScript solution on a worker thread. In-process it would block the
 * event loop for its whole duration, freezing the screen and the keyboard.
 */
function onWorker(solution: string, input: string, { onOutput, signal }: Options = {}) {
  if (signal?.aborted) return Promise.reject(new Abandoned());

  return new Promise<DayResult>((resolve, reject) => {
    const worker = new Worker(WORKER, {
      workerData: { solution, input },
      execArgv: workerFlags(),
      stdout: true,
      stderr: true,
    });

    const abandon = () => {
      void worker.terminate();
      reject(new Abandoned());
    };
    signal?.addEventListener("abort", abandon, { once: true });

    let result: DayResult | undefined;
    let failure = "";
    const out = lineReader((line) => onOutput?.(line, "stdout"));
    const err = lineReader((line) => onOutput?.(line, "stderr"));
    worker.stdout.on("data", (chunk) => out.push(String(chunk)));
    worker.stderr.on("data", (chunk) => {
      failure += chunk;
      err.push(String(chunk));
    });

    worker.on("message", (message: DayResult) => {
      result = message;
    });
    worker.on("error", reject);
    worker.on("exit", (code) => {
      signal?.removeEventListener("abort", abandon);
      out.end();
      err.end();
      if (result) resolve(result);
      else if (!signal?.aborted) {
        reject(new Error(failure.split("\n")[0] || `worker exited ${code}`));
      }
    });
  });
}

/**
 * Runs a Python solution, keeping what it printed. The driver answers on fd 3,
 * so every line of stdout is the day's own and none of it can be mistaken for
 * the result.
 */
function onProcess(solution: string, input: string, { onOutput, signal }: Options = {}) {
  if (signal?.aborted) return Promise.reject(new Abandoned());

  return new Promise<DayResult>((resolve, reject) => {
    const child = spawn("python3", [PY_DRIVER, solution, input], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe", "pipe"],
    });

    const abandon = () => {
      child.kill("SIGTERM");
      reject(new Abandoned());
    };
    signal?.addEventListener("abort", abandon, { once: true });

    let payload = "";
    let failure = "";
    const out = lineReader((line) => onOutput?.(line, "stdout"));
    const err = lineReader((line) => onOutput?.(line, "stderr"));
    const { stdout, stderr, channel } = pipesOf(child);
    channel.on("data", (chunk) => (payload += chunk));

    stdout.setEncoding("utf8");
    stderr.setEncoding("utf8");
    stdout.on("data", (chunk: string) => out.push(chunk));
    stderr.on("data", (chunk: string) => {
      failure += chunk;
      err.push(chunk);
    });

    child.on("error", (error) =>
      reject(new Error(`python3 could not be started. Is it installed? (${error.message})`)),
    );
    child.on("close", (code) => {
      signal?.removeEventListener("abort", abandon);
      out.end();
      err.end();
      if (signal?.aborted) return;
      const line = payload
        .trim()
        .split("\n")
        .findLast((l) => l.startsWith("{"));
      if (line === undefined) {
        reject(new Error(failure.trim().split("\n").at(-1) ?? `python3 exited ${code}`));
        return;
      }
      resolve(JSON.parse(line));
    });
  });
}

/** The same language, run so the screen keeps moving and nothing it prints is lost. */
export function offloaded(lang: Language, { onOutput, signal }: Offload = {}): Language {
  const run = lang.id === "ts" ? onWorker : lang.id === "py" ? onProcess : undefined;
  if (run === undefined) return lang;

  return {
    ...lang,
    solve: (ref: Ref, input: string) => {
      const source = input.endsWith(SAMPLE_FILE) ? "sample" : "input";
      return run(lang.solutionPath(ref), input, {
        onOutput: onOutput && ((line, stream) => onOutput(line, stream, source)),
        signal: signal?.(),
      });
    },
  };
}
