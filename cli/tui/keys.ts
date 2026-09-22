export type Key = {
  /** `up`, `enter`, `escape`, `char`, …: what the key is, not what it types. */
  name: string;
  shift: boolean;
  ctrl: boolean;
  /** The character produced, for `name: "char"`. */
  char?: string;
};

const ARROWS: Record<string, string> = { A: "up", B: "down", C: "right", D: "left" };
const TILDES: Record<string, string> = {
  "1": "home", "3": "delete", "4": "end", "5": "pageup", "6": "pagedown",
  "7": "home", "8": "end", "15": "f5", "17": "f6",
};
const LETTERS: Record<string, string> = { H: "home", F: "end", P: "f1", Q: "f2", R: "f3", S: "f4" };

const plain = (name: string, extra: Partial<Key> = {}): Key =>
  ({ name, shift: false, ctrl: false, ...extra });

/** Modifier bitfield as xterm sends it: 1 + 1 shift + 2 alt + 4 ctrl. */
function modifiers(parameters: string[]): { shift: boolean; ctrl: boolean } {
  const code = Number(parameters[1] ?? "1") - 1;
  return { shift: (code & 1) !== 0, ctrl: (code & 4) !== 0 };
}

/** Turns one chunk of raw stdin into key events, since a chunk can hold several. */
export function decode(chunk: string): Key[] {
  const keys: Key[] = [];
  let at = 0;

  while (at < chunk.length) {
    const char = chunk[at];

    if (char === "\u001b" && chunk[at + 1] === "[") {
      const match = /^\u001b\[([0-9;]*)([A-Za-z~])/.exec(chunk.slice(at));
      if (match) {
        const [whole, parameters, final] = match;
        const parts = parameters.split(";");
        at += whole.length;

        if (final === "Z") keys.push(plain("tab", { shift: true }));
        else if (final === "~") keys.push(plain(TILDES[parts[0]] ?? "unknown", modifiers(parts)));
        else if (ARROWS[final]) keys.push(plain(ARROWS[final], modifiers(parts)));
        else if (LETTERS[final]) keys.push(plain(LETTERS[final], modifiers(parts)));
        else keys.push(plain("unknown"));
        continue;
      }
    }

    if (char === "\u001b" && chunk.length === 1) {
      keys.push(plain("escape"));
      at += 1;
      continue;
    }

    at += 1;
    if (char === "\r" || char === "\n") keys.push(plain("enter"));
    else if (char === "\t") keys.push(plain("tab"));
    else if (char === "\u007f" || char === "\b") keys.push(plain("backspace"));
    else if (char === "\u0003") keys.push(plain("c", { ctrl: true }));
    else if (char < " ") keys.push(plain(String.fromCharCode(char.charCodeAt(0) + 96), { ctrl: true }));
    else keys.push(plain("char", { char }));
  }

  return keys;
}
