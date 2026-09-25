import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { ROOT } from "./config.ts";

export const ENV_FILE = path.join(ROOT, ".env");

const PLACEHOLDER = /example\.com|github\.com\/you\//;

export type Setting = { value: string; problem: null } | { value: null; problem: string };

export type Settings = { session: Setting; userAgent: Setting };

const usable = (value: string): Setting => ({ value, problem: null });
const refused = (problem: string): Setting => ({ value: null, problem });

function sessionFrom(values: Record<string, string | undefined> | null): Setting {
  if (values === null) return refused("No .env file. Copy .env.example to .env and fill it in.");
  const session = (values.AOC_SESSION ?? "").trim().replace(/^session=/, "");
  if (session === "") return refused("AOC_SESSION is empty in .env.");
  if (!/^[0-9a-f]+$/i.test(session)) {
    return refused("AOC_SESSION does not look like a session cookie, which is a long hex string.");
  }
  return usable(session);
}

function userAgentFrom(values: Record<string, string | undefined> | null): Setting {
  const agent = (values?.AOC_USER_AGENT ?? "").trim();
  if (agent === "") {
    return refused("AOC_USER_AGENT is empty in .env. Name yourself: your repository and an email.");
  }
  if (PLACEHOLDER.test(agent)) {
    return refused("AOC_USER_AGENT is still the example in .env. Put your own repository and email.");
  }
  return usable(agent);
}

/** Reads settings out of a parsed .env, or out of none when the file is missing. */
export function settingsFrom(values: Record<string, string | undefined> | null): Settings {
  return { session: sessionFrom(values), userAgent: userAgentFrom(values) };
}

/** The settings in .env, read fresh on every call. */
export function settings(): Settings {
  if (!fs.existsSync(ENV_FILE)) return settingsFrom(null);
  return settingsFrom(parseEnv(fs.readFileSync(ENV_FILE, "utf8")));
}
