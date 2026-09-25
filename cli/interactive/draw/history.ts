import type { Surface } from "../../tui/buffer.ts";
import type { Ref } from "../../core/config.ts";
import { elapsed } from "../../core/format.ts";
import { PARTS, readMeta } from "../../core/meta.ts";
import { PAD } from "./chrome.ts";
import { THEME } from "./theme.ts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type Moment = {
  /** ISO instant, or null for what `meta.json` records without a time. */
  at: string | null;
  what: string;
  detail: string;
  took: string | null;
  isStar: boolean;
};

function stamp(at: string | null): string {
  if (at === null) return "";
  const when = new Date(at);
  const two = (value: number) => String(value).padStart(2, "0");
  return `${two(when.getDate())} ${MONTHS[when.getMonth()]}  ${two(when.getHours())}:${two(when.getMinutes())}`;
}

const moment = (at: string | null, what: string, detail: string, extra: Partial<Moment> = {}): Moment => ({
  at,
  what,
  detail,
  took: null,
  isStar: false,
  ...extra,
});

/**
 * What `meta.json` remembers of a day, as a timeline. Nothing new is stored:
 * every moment here is already committed, so it survives a clone.
 */
export function momentsOf(ref: Ref): Moment[] {
  const meta = readMeta(ref);
  const moments: Moment[] = [];

  if (meta.started !== null) moments.push(moment(meta.started, "fetched", ""));

  for (const [index, part] of PARTS.entries()) {
    const record = meta[part];
    const name = `part ${index + 1}`;

    if (record.answer !== null) {
      moments.push(
        moment(record.solved, `${name} accepted`, record.answer, {
          took: elapsed(meta.started, record.solved),
          isStar: true,
        }),
      );
    }
    for (const wrong of record.wrong) moments.push(moment(null, `${name} rejected`, wrong));

    const langs = Object.keys(record.verified).filter((lang) => record.verified[lang]);
    if (langs.length > 0) moments.push(moment(null, `${name} reproduced`, langs.join(", ")));
  }

  // Oldest first. What meta.json records without a time sorts to the end rather
  // than guessing where it belongs.
  return moments.sort((a, b) => {
    if (a.at === b.at) return 0;
    if (a.at === null) return 1;
    if (b.at === null) return -1;
    return a.at < b.at ? -1 : 1;
  });
}

const WHAT = 17;
const DETAIL = 37;

/** The day's record: what was accepted, what was rejected, what reproduces it. */
export function drawHistory(surface: Surface, ref: Ref, scroll: number): void {
  const moments = momentsOf(ref);
  if (moments.length === 0) {
    surface.write(PAD, 1, "nothing has happened yet", THEME.muted);
    surface.write(PAD, 3, "the record fills as you fetch, run and submit", THEME.faint);
    return;
  }

  const shown = moments.slice(scroll, scroll + surface.height);
  for (const [index, moment] of shown.entries()) {
    surface.write(PAD, index, stamp(moment.at), THEME.faint);
    surface.write(WHAT, index, moment.what, moment.isStar ? THEME.star : THEME.muted);
    surface.write(DETAIL, index, moment.detail.slice(0, Math.max(0, surface.width - DETAIL - 10)), THEME.text);
    if (moment.took !== null) surface.writeRight(index, `${moment.took}  `, THEME.faint);
  }
}
