// nukernel/src/copy/global.ts — HOW A BUNDLE REACHES THE ONE CATALOGUE.
//
// `src/table`, `src/envelope` and `src/menus` are their own build entries, so
// an `import { t } from "../copy/index.js"` would bundle a SECOND copy of the
// whole catalogue into ui/table.js and a third into ui/envelope.js. Three
// copies of the strings is three tables to translate and the exact drift the
// one-owner law exists to refuse.
//
// So a bundle imports THIS file instead: five lines that hold no strings and
// read the table `ui/copy.js` published on `globalThis` when it loaded. The
// catalogue ships once, in one file, and every surface reads that one.

import type { Params } from "./api.js";

interface CopyGlobal {
  t(key: string, p?: Params): string;
  tn(key: string, n: number, p?: Params): string;
  has(key: string): boolean;
  fmt(n: number, unit?: string): string;
}

const C = (): CopyGlobal => (globalThis as unknown as { COPY: CopyGlobal }).COPY;

export const t = (key: string, p?: Params): string => C().t(key, p);
export const tn = (key: string, n: number, p?: Params): string => C().tn(key, n, p);
export const fmt = (n: number, unit?: string): string => C().fmt(n, unit);
