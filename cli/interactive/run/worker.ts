import fs from "node:fs";
import { parentPort, workerData } from "node:worker_threads";
import { pathToFileURL } from "node:url";

const { solution, input } = workerData as { solution: string; input: string };

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

parentPort?.postMessage({ part1: time(day.part1, text), part2: time(day.part2, text) });
