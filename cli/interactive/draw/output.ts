import type { Surface } from "../../tui/buffer.ts";
import type { OutputLine } from "../run/runner.ts";
import { PAD } from "./chrome.ts";
import { LANG_STYLE, THEME } from "./theme.ts";

const BAR = 14;
const TEXT = 16;

/** A laid-out row: a line with whether it opens a run, or a gap between runs. */
type Laid = { line: OutputLine; opensRun: boolean } | null;

/**
 * The lines as they are laid out: a blank row wherever the run changes, so the
 * same prints from the sample and from the real input read as two passes.
 */
function rowsOf(lines: OutputLine[]): Laid[] {
  const rows: Laid[] = [];
  let group = "";

  for (const line of lines) {
    const key = `${line.lang}/${line.source}`;
    const opensRun = key !== group;
    if (opensRun && rows.length > 0) rows.push(null);
    rows.push({ line, opensRun });
    group = key;
  }
  return rows;
}

export const rowCount = (lines: OutputLine[]): number => rowsOf(lines).length;

/** Whatever the solutions printed, newest at the bottom, one gutter per run. */
export function drawOutput(surface: Surface, lines: OutputLine[], scroll: number): void {
  if (lines.length === 0) {
    surface.write(PAD, 1, "nothing printed", THEME.muted);
    surface.write(PAD, 3, "console.log and print() land here, stderr in red", THEME.faint);
    return;
  }

  const rows = rowsOf(lines);
  const top = Math.max(0, rows.length - surface.height - scroll);
  const shown = rows.slice(top, top + surface.height);

  for (const [index, row] of shown.entries()) {
    if (row === null) continue;
    const { line, opensRun } = row;

    // Repeated at the top of the view so a pane scrolled into the middle of a
    // run still says which run it is.
    if (opensRun || index === 0) {
      surface.write(PAD, index, line.lang, LANG_STYLE[line.lang] ?? THEME.text);
      surface.write(PAD + line.lang.length + 1, index, line.source, THEME.faint);
    }
    surface.write(BAR, index, line.stream === "stderr" ? "┃" : "│", line.stream === "stderr" ? THEME.bad : THEME.faint);
    surface.write(
      TEXT,
      index,
      line.text.slice(0, Math.max(0, surface.width - TEXT - 1)),
      line.stream === "stderr" ? THEME.bad : THEME.text,
    );
  }
}
