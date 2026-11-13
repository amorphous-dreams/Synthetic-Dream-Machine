/**
 * `lares nexus promote {open | sign | check}` — the seats' approval of ONE promotion's exact bytes, carried
 * between vaults as a file (stable-founding-road, "Planes ~ cabal, realm, Nexus").
 *
 *   open  <file> --purpose <p> --surface <s> [--class ordinary|high-impact] [--nexus <aid>] --out <approval>
 *         read the file's exact bytes, sign an approval of their hash with the seats held here, write it
 *   sign  <approval> --confirm-statement <digest> [--confirm-hash <hash>] [--nexus <aid>] --out <approval>
 *         add the seats held here to an approval; the person names the statement digest `open` printed (the
 *         digest of the signed bytes: bytes hash, purpose, surface, class, epoch), and may also name the bytes hash
 *   check <approval> <file> [--nexus <aid>]
 *         the verdict over the file's bytes against this vault's charter head (exit 0 only on ok)
 *
 * The seat rows rest in this vault, so these run on the CLI side like `nexus contract --out`: the door opens
 * the vault's own key session, and the approval file holds public material alone.
 *
 * Meme: lar:///ha.ka.ba/lararium/mesh/kahu#/chartered-classes
 */
import { readFileSync } from "node:fs";
import { runPromoteOpen, runPromoteSign, runPromoteCheck, PromoteError } from "@lararium/node";
import type { PromotionApprovalVerdict } from "@lararium/mesh";
import { larSealHome } from "../env.js";
import { emit, exitFor, refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";
import { storeFailure } from "../store-door.js";
import { partialOutOrRefuse, writePartialFile } from "./partial-file.js";
import type { ParsedArgs } from "../parse-args.js";

const refuse = (msg: string): Error => new PromoteError(msg);
const verdictLine = (v: PromotionApprovalVerdict): string =>
  v.ok ? `ok — ${v.counted} of ${v.threshold} seats${v.reviewOwed ? " (a review is owed)" : ""}`
    : `${v.reason}${v.counted !== undefined ? ` — ${v.counted} of ${v.threshold} seats` : ""}`;

function readApproval(path: string): unknown {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { throw new PromoteError(`cannot read ${path} as an approval file`); }
}

export async function cmdPromote(args: ParsedArgs): Promise<number> {
  const sub = args.positional[1];
  if (sub !== "open" && sub !== "sign" && sub !== "check") return refuseUsage(args, "nexus promote", helpLines("nexus promote"), sub ? `unknown verb "${sub}"` : undefined);
  const sealHome = larSealHome();
  const aid = args.options["nexus"];
  const nexus = aid !== undefined ? { aid } : {};
  try {
    if (sub === "open") {
      const file = args.positional[2], purpose = args.options["purpose"], surface = args.options["surface"], out = args.options["out"];
      if (!file || !purpose || !surface || !out) return refuseUsage(args, "nexus promote", helpLines("nexus promote"), "open needs <file>, --purpose, --surface and --out");
      const klass = args.options["class"] ?? "high-impact";
      if (klass !== "ordinary" && klass !== "high-impact") return refuseUsage(args, "nexus promote", helpLines("nexus promote"), "--class takes ordinary or high-impact");
      partialOutOrRefuse(refuse, out);
      const r = await runPromoteOpen({ file, purpose, surface, actClass: klass, sealHome, ...nexus });
      const written = writePartialFile(out, r.approval);
      emit(args, { ok: true, data: { ...r, written: written.path },
        human: () => {
          console.log(`nexus promote open — ${r.approval.bytesHash}`);
          console.log(`  statement: ${r.statement}`);
          console.log(`  signed here: ${r.signed.length} seat${r.signed.length === 1 ? "" : "s"} · ${verdictLine(r.verdict)}`);
          console.log(written.path !== null ? `  approval:    ${written.path}` : `  approval: ${written.error ?? "not written"}\n${JSON.stringify(r.approval)}`);
          if (!r.verdict.ok) console.log(`  carry the file to the next seat's vault: \`lares nexus promote sign ${out} --confirm-statement ${r.statement} --out <file>\``);
        } });
      return 0;                                  // a partial reads as progress; `check` alone answers ok or not
    }
    if (sub === "sign") {
      const path = args.positional[2], confirmHash = args.options["confirm-hash"], confirmStatement = args.options["confirm-statement"], out = args.options["out"];
      if (!path) return refuseUsage(args, "nexus promote", helpLines("nexus promote"), "sign needs <approval.json>");
      if (confirmStatement !== undefined && !out) return refuseUsage(args, "nexus promote", helpLines("nexus promote"), "a confirmed sign needs --out <file>");
      if (out !== undefined) partialOutOrRefuse(refuse, out, path);
      const r = await runPromoteSign({ approval: readApproval(path), sealHome, ...nexus, ...(confirmHash !== undefined ? { confirmHash } : {}), ...(confirmStatement !== undefined ? { confirmStatement } : {}) });
      const written = out !== undefined && r.would === undefined ? writePartialFile(out, r.approval) : null;
      emit(args, { ok: true, data: { ...r, written: written?.path ?? null },
        human: () => {
          console.log(`nexus promote sign — ${r.approval.bytesHash}`);
          console.log(`  statement: ${r.statement}`);
          console.log(`  purpose:  ${r.approval.purpose} · surface: ${r.approval.surface} · class: ${r.approval.actClass}`);
          console.log(`  seats:    ${r.counted} of ${r.threshold}${r.complete ? " (complete)" : ""}`);
          if (r.would) console.log(`  read only — confirm with \`--confirm-statement ${r.statement} --out <file>\` to sign with the seats held here`);
          else console.log(`  added:    ${r.added.length} seat${r.added.length === 1 ? "" : "s"}${written?.path ? ` · approval: ${written.path}` : ""}`);
        } });
      return 0;
    }
    const path = args.positional[2], file = args.positional[3];
    if (!path || !file) return refuseUsage(args, "nexus promote", helpLines("nexus promote"), "check needs <approval.json> and <file>");
    const verdict = await runPromoteCheck({ approval: readApproval(path), file, sealHome, ...nexus });
    emit(args, { ok: verdict.ok, data: { verdict }, human: () => console.log(`nexus promote check — ${verdictLine(verdict)}`) });
    return verdict.ok ? 0 : 1;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const failure = storeFailure(err, err instanceof PromoteError ? "refused" : "error");
    emit(args, { ok: false, error: failure, human: () => console.error(`lares nexus promote ${sub}: ${msg}`) });
    return exitFor(failure.code);
  }
}
