import { runVerb, verbFailure } from "../verb-call.js";
import { vesselDid } from "../env.js";
import { emit, exitFor } from "../render.js";
import { summaryOutput } from "../verb-result.js";
import type { JournalCursor } from "@lararium/mesh";
import type { ParsedArgs } from "../parse-args.js";

type EventKind = "bag-projected";

const EVENT_KINDS: ReadonlySet<EventKind> = new Set(["bag-projected"]);
const TIMEOUT_WAIT_MS = 120_000;
const TIMEOUT_READ_MS = 10_000;

function parseSince(raw: string): JournalCursor | null {
  const last = raw.lastIndexOf(":");
  if (last <= 0) return null;
  const second = raw.lastIndexOf(":", last - 1);
  if (second <= 0) return null;
  const epoch = raw.slice(0, second);
  const writer = raw.slice(second + 1, last);
  const seqText = raw.slice(last + 1);
  const seq = Number(seqText);
  if (epoch.length === 0 || writer.length === 0 || !Number.isInteger(seq) || seq < 1) return null;
  return { epoch, writer, seq };
}

export async function cmdEvents(args: ParsedArgs): Promise<number> {
  const kindRaw = args.options["kind"];
  if (kindRaw !== undefined && !EVENT_KINDS.has(kindRaw as EventKind)) {
    console.error("usage: lares events [--since <epoch:writer:seq>] [--kind <bag-projected>] [--wait] --json");
    console.error(`lares events: unknown kind "${kindRaw}"`);
    return 2;
  }
  const sinceRaw = args.options["since"];
  const since = typeof sinceRaw === "string" ? parseSince(sinceRaw) : undefined;
  if (sinceRaw !== undefined && since === null) {
    console.error("usage: lares events [--since <epoch:writer:seq>] [--kind <bag-projected>] [--wait] --json");
    console.error(`lares events: invalid --since cursor "${sinceRaw}"`);
    return 2;
  }

  const wait = args.flags["wait"] === true;
  const did = await vesselDid();
  const verbArgs: Record<string, unknown> = {
    ...(kindRaw !== undefined ? { kind: kindRaw } : {}),
    ...(since ? { since } : {}),
    ...(wait ? { wait: true } : {}),
  };

  let result;
  try {
    result = await runVerb("events", verbArgs, did, { timeoutMs: wait ? TIMEOUT_WAIT_MS : TIMEOUT_READ_MS });
  } catch (err) {
    const f = verbFailure(err);
    emit(args, {
      ok: false, ...(f.requestId !== undefined ? { requestId: f.requestId } : {}),
      error: { code: f.code, message: f.message, ...(f.hint !== undefined ? { hint: f.hint } : {}) },
      human: () => {
        console.error(`lares events: ${f.message}`);
        if (f.hint !== undefined) console.error(`  ${f.hint}`);
      },
    });
    return exitFor(f.code);
  }

  if (result.status === "error") {
    const msg = result.errorMessage ?? "unknown";
    emit(args, { ok: false, error: { code: "verb-error", message: msg }, human: () => console.error(`lares events: ${msg}`) });
    return exitFor("verb-error");
  }

  const data = (summaryOutput(result) ?? {}) as Record<string, unknown>;
  emit(args, {
    ok: true,
    data,
    human: () => {
      const entries = Array.isArray(data["entries"]) ? data["entries"] : [];
      console.log(`events: ${entries.length}`);
      for (const entry of entries) console.log(JSON.stringify(entry));
    },
  });
  return 0;
}
