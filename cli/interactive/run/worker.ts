import fs from "node:fs";
import { parentPort, workerData } from "node:worker_threads";
import { pathToFileURL } from "node:url";

const { solution, input, parts } = workerData as { solution: string; input: string; parts: string[] };

function relay(stream: "stdout" | "stderr"): typeof process.stdout.write {
  return ((chunk: string | Uint8Array, ...rest: unknown[]) => {
    const text = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
    parentPort?.postMessage({ kind: "output", stream, text });
    const done = rest.find((arg) => typeof arg === "function") as (() => void) | undefined;
    if (done) queueMicrotask(done);
    return true;
  }) as typeof process.stdout.write;
}

process.stdout.write = relay("stdout");
process.stderr.write = relay("stderr");

const blank = (value: unknown): string | null => {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return text === "" ? null : text;
};

const time = (fn: unknown, text: string) => {
  if (typeof fn !== "function") return { answer: null, micros: 0 };
  const start = performance.now();
  const since = () => Math.round((performance.now() - start) * 1000);
  try {
    return { answer: blank(fn(text)), micros: since() };
  } catch (error) {
    return { answer: null, micros: since(), error: (error as Error).message.split("\n")[0] };
  }
};

const day = await import(pathToFileURL(solution).href);
const text = fs.readFileSync(input, "utf8").replace(/\s+$/, "");

const result = Object.fromEntries(parts.map((part) => [part, time(day[part], text)]));
parentPort?.postMessage({ kind: "result", result });
