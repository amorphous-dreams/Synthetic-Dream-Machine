/**
 * carriage-log-file — the place's carriage log on disk: one JSON line per receipt, appended and synced before the log
 * keeps it (`@lararium/mesh` carriage-log).
 *
 * APPEND-ONLY, UNSEALED, DURABLE. The journal only ever appends: no receipt leaves, and no rewrite moves one. Each line is
 * a public, signed receipt (a carriage id, a lane, the place key and its signature), so it rests in clear on the place's
 * floor beside the drop journal. An append that does not land throws, and the log keeps nothing it could not rest. A torn
 * or planted line reads back as nothing: the log re-verifies every line it loads.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/lamplighters#/the-carriage-log
 */
import { closeSync, fstatSync, fsyncSync, mkdirSync, openSync, readFileSync, readSync, writeSync } from "node:fs";
import { dirname } from "node:path";
import type { CarriageLogJournal } from "@lararium/mesh";

/** The place's carriage log under its store: the file a vessel keeps beside its drop journal. */
export const CARRIAGE_LOG_FILE = "carriage-log.jsonl";

export function fileCarriageJournal(path: string): CarriageLogJournal {
  return {
    load() {
      let text: string;
      try { text = readFileSync(path, "utf8"); } catch { return []; }
      const out: unknown[] = [];
      for (const line of text.split("\n")) {
        if (line.length === 0) continue;
        try { out.push(JSON.parse(line)); } catch { /* a torn line reads as nothing */ }
      }
      return out;
    },
    append(receipt) {
      mkdirSync(dirname(path), { recursive: true });
      const fd = openSync(path, "a+");
      try {
        // A line a crash tore stays torn alone: the next receipt starts on a line of its own.
        const size = fstatSync(fd).size;
        const last = new Uint8Array(1);
        const opens = size > 0 && readSync(fd, last, 0, 1, size - 1) === 1 && last[0] !== 0x0a ? "\n" : "";
        writeSync(fd, `${opens}${JSON.stringify(receipt)}\n`);
        fsyncSync(fd);
      }
      finally { closeSync(fd); }
    },
  };
}
