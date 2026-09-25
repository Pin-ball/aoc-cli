import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { account } from "./aoc-api.ts";
import { ROOT } from "./config.ts";
import { settings } from "./env.ts";

export type Status = "ok" | "warn" | "fail";
export type Check = { label: string; status: Status; note: string };

const MIN_NODE = 24;
const MIN_PYTHON = [3, 12] as const;

/** Whether this Node is recent enough. */
export function nodeCheck(version: string): Check {
  const major = Number(version.split(".")[0]);
  return major >= MIN_NODE
    ? { label: "node", status: "ok", note: `v${version}` }
    : { label: "node", status: "fail", note: `v${version}, needs ${MIN_NODE} or later` };
}

/** Whether python3 is there and recent enough, as reported by `python3 --version`. */
export function pythonCheck(reported: string | null): Check {
  if (reported === null) {
    return {
      label: "python",
      status: "warn",
      note: "python3 not found, only the py track needs it",
    };
  }
  const [major, minor] = (reported.match(/(\d+)\.(\d+)/)?.slice(1) ?? []).map(Number);
  const recent = major > MIN_PYTHON[0] || (major === MIN_PYTHON[0] && minor >= MIN_PYTHON[1]);
  const version = reported.replace(/^Python\s*/i, "").trim();
  return recent
    ? { label: "python", status: "ok", note: version }
    : {
        label: "python",
        status: "warn",
        note: `${version}, the py track needs ${MIN_PYTHON.join(".")}`,
      };
}

/** Where `aoc` resolves on PATH, compared with this clone. */
export function pathCheck(found: string | null, here: string): Check {
  if (found === null) return { label: "aoc on PATH", status: "warn", note: "not linked, see the README" };
  return found === here
    ? { label: "aoc on PATH", status: "ok", note: "this clone" }
    : { label: "aoc on PATH", status: "warn", note: `runs another clone: ${found}` };
}

async function pythonVersion(): Promise<string | null> {
  try {
    const { stdout, stderr } = await promisify(execFile)("python3", ["--version"]);
    return (stdout || stderr).trim();
  } catch {
    return null;
  }
}

function aocOnPath(): string | null {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    const candidate = path.join(dir, "aoc");
    if (fs.existsSync(candidate)) return fs.realpathSync(candidate);
  }
  return null;
}

function agentCheck(): Check {
  const { userAgent } = settings();
  return userAgent.problem === null
    ? { label: "user agent", status: "ok", note: userAgent.value }
    : { label: "user agent", status: "fail", note: userAgent.problem };
}

async function sessionCheck(): Promise<Check> {
  const { session, userAgent } = settings();
  if (session.problem !== null) return { label: "session", status: "fail", note: session.problem };
  if (userAgent.problem !== null) {
    return { label: "session", status: "warn", note: "not checked until the user agent is set" };
  }

  try {
    const { signedIn, name } = await account();
    return signedIn
      ? { label: "session", status: "ok", note: name ? `signed in as ${name}` : "signed in" }
      : { label: "session", status: "fail", note: "not accepted by AoC, it has probably expired" };
  } catch (error) {
    return { label: "session", status: "fail", note: (error as Error).message };
  }
}

/** Everything aoc needs from this machine and this .env, checked in order. */
export async function diagnose(): Promise<Check[]> {
  return [
    nodeCheck(process.versions.node),
    pythonCheck(await pythonVersion()),
    pathCheck(aocOnPath(), fs.realpathSync(path.join(ROOT, "aoc"))),
    agentCheck(),
    await sessionCheck(),
  ];
}
