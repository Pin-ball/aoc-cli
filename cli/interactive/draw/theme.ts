import { PALETTE } from "../../tui/style.ts";
import type { Style } from "../../tui/style.ts";

/** One vocabulary of styles, so every screen shares a palette. */
export const THEME = {
  title: { fg: PALETTE.fg, bold: true },
  text: { fg: PALETTE.fg },
  muted: { fg: PALETTE.muted },
  faint: { fg: PALETTE.faint },
  line: { fg: PALETTE.line },
  star: { fg: PALETTE.gold },
  ok: { fg: PALETTE.green },
  bad: { fg: PALETTE.red },
  warn: { fg: PALETTE.warn },
  // No background: an overlay blanks what is under it by filling with spaces
  // and lets the terminal's own through. Terminals with background-colour-erase
  // spread a set background past the frame.
  overlay: { fg: PALETTE.fg },
  hintKey: { fg: PALETTE.muted },
  hintLabel: { fg: PALETTE.faint },
  selected: { bg: PALETTE.line, fg: PALETTE.fg, bold: true },
  selectedStar: { bg: PALETTE.line, fg: PALETTE.gold, bold: true },
  selectedFaint: { bg: PALETTE.line, fg: PALETTE.muted },
} as const satisfies Record<string, Style>;

export const LANG_STYLE: Record<string, Style> = {
  ts: { fg: PALETTE.ts },
  py: { fg: PALETTE.py },
};
