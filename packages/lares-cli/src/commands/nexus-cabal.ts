/**
 * `lares nexus cabal {admit | remove | cosign | standing}` — the seat quorum's admission of a PersonaGroup into a
 * Nexus's Kahu cabal (kahu#/seed-and-nexus: ADMISSION TAKES THE SEAT QUORUM), and where one group stands.
 *
 *   admit  <group> [--nexus <aid>] [--out <partial>]    open the act and sign with the seats held here
 *   remove <group> [--nexus <aid>] [--out <partial>]    the same, taking the group back out
 *   cosign <partial> --act <cid> [--nexus <aid>] [--out <file>]
 *          add the seats held here to a carried act; a person names the act CID they read aloud first
 *   standing <group> [--nexus <aid>]                    the group's standing as of this vessel's last sync
 *
 * Each sub-verb rides the store door (`nexus-cabal-*`), so a standing vessel's own Repo takes the write and a
 * bare tree holds the store for the moment of the act, exactly as `nexus contract --out` does. Where the seats
 * held here fall short of the high-impact threshold, the act stays a PARTIAL: it prints with its act CID so a
 * person reads it aloud, and `--out` writes it for the next vault. The file holds public material alone.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/kahu#/cabal-admission
 */
import { readFileSync } from "node:fs";
import { NexusCabalError, type NexusCabalActResult } from "@lararium/node";
import { emit, exitFor, refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";
import { storeVerb, storeFailure } from "../store-door.js";
import { partialOutOrRefuse, writePartialFile, type PartialWritten } from "./partial-file.js";
import type { ParsedArgs } from "../parse-args.js";

const DOOR = "nexus cabal";
const refuse = (msg: string): Error => new NexusCabalError(msg);
const usage = (args: ParsedArgs, why?: string): number => refuseUsage(args, DOOR, helpLines(DOOR), why);

/** Report one act step: the act CID read aloud, the seats counted, and the partial or the landing. */
function emitAct(args: ParsedArgs, step: string, r: NexusCabalActResult, written: PartialWritten | null): number {
  emit(args, {
    ok: true,
    data: { ...r, written: written?.path ?? null, ...(written?.error ? { outError: written.error } : {}) },
    human: () => {
      console.log(`nexus cabal ${step} → ${r.landed ? "LANDED" : "PARTIAL"} ${r.act.action} ${r.act.group.slice(0, 16)}…`);
      console.log(`  act:     ${r.actCid}`);
      console.log(`  seats:   ${r.seated} of ${r.threshold} (signed here: ${r.signedHere.length})`);
      console.log(`  epoch:   ${r.act.sealEpochCid}`);
      if (r.landed) { console.log("  the act counts and rests on this Nexus's carriage board"); return; }
      if (written?.path) console.log(`  partial: ${written.path}`);
      else {
        if (written?.error) console.log(`  partial: ${written.error}`);
        console.log(JSON.stringify(r.act));
      }
      console.log(`  read the act CID aloud; the next seat's vault runs \`lares nexus cabal cosign <partial> --act ${r.actCid} --out <file>\``);
    },
  });
  return 0;   // a partial reads as progress; `standing` answers where the group stands
}

function readPartial(path: string): unknown {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch { throw new NexusCabalError(`cannot read ${path} as a partial file`); }
}

export async function cmdNexusCabal(args: ParsedArgs): Promise<number> {
  const sub = args.positional[1];
  if (sub !== "admit" && sub !== "remove" && sub !== "cosign" && sub !== "standing") {
    return usage(args, sub ? `unknown verb "${sub}"` : undefined);
  }
  const aid = args.options["nexus"];
  const nexus = aid !== undefined ? { aid } : {};
  const out = args.options["out"];
  try {
    if (sub === "cosign") {
      const path = args.positional[2], act = args.options["act"];
      if (!path || !act) return usage(args, "cosign needs <partial> and --act <cid>, the act CID you read aloud");
      if (out !== undefined) partialOutOrRefuse(refuse, out, path);
      const { output } = await storeVerb("nexus-cabal-cosign", { partial: readPartial(path), act, ...nexus }, NexusCabalError);
      const r = output as unknown as NexusCabalActResult;
      return emitAct(args, "cosign", r, out !== undefined && !r.landed ? writePartialFile(out, r.act) : null);
    }
    const group = args.positional[2];
    if (!group) return usage(args, `${sub} needs <group>, the PersonaGroup id`);
    if (sub === "standing") {
      const { output } = await storeVerb("nexus-cabal-standing", { group, ...nexus }, NexusCabalError);
      const r = output as unknown as { nexus: string; group: string; standing: string; heads: readonly string[] };
      emit(args, { ok: true, data: r, human: () => {
        console.log(`nexus cabal standing — ${r.group.slice(0, 16)}… ${r.standing.toUpperCase()} in ${r.nexus.slice(0, 22)}…`);
        for (const h of r.heads) console.log(`  head ${h}`);
      } });
      return 0;
    }
    if (out !== undefined) partialOutOrRefuse(refuse, out);
    const { output } = await storeVerb("nexus-cabal-act", { group, action: sub, ...nexus }, NexusCabalError);
    const r = output as unknown as NexusCabalActResult;
    return emitAct(args, sub, r, out !== undefined && !r.landed ? writePartialFile(out, r.act) : null);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const failure = storeFailure(err, err instanceof NexusCabalError ? "refused" : "error");
    emit(args, { ok: false, error: failure, human: () => console.error(`lares nexus cabal ${sub}: ${msg}`) });
    return exitFor(failure.code);
  }
}
