import { spawn } from "node:child_process";

/** `start` is a shell builtin on Windows, so it cannot be spawned directly. */
const OPENERS: Record<string, string[]> = {
  darwin: ["open"],
  win32: ["cmd", "/c", "start", ""],
  linux: ["xdg-open"],
};

/** Hands a URL or file to the desktop's default handler, without blocking. */
export function openInBrowser(target: string): void {
  const [command, ...args] = OPENERS[process.platform] ?? OPENERS.linux;
  spawn(command, [...args, target], { detached: true, stdio: "ignore" }).unref();
}

/**
 * Asks for a word back before something irreversible. A pipe cannot answer, so
 * it is refused rather than taken for consent.
 */
export async function confirm(question: string, expected: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    throw new Error("This needs a terminal to confirm in, and stdin is not one.");
  }
  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim() === expected;
  } finally {
    rl.close();
  }
}
