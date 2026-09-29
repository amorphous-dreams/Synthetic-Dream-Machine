/** `lares nexus offering inspect <offering-cid>` — read one exact local gift. */
import { runNexusInspectOffering, NexusOfferingInspectError } from "@lararium/node";
import { emit, exitFor, refuseUsage } from "../render.js";
import type { ParsedArgs } from "../parse-args.js";

const USAGE: readonly string[] = [
  "usage: lares nexus offering inspect <offering-cid>",
  "",
  "  inspect one exact signed offering already carried by this Nexus Crossroads board.",
  "  This reads local CAS only, never fetches, installs, mutates genesis, or changes grammar.",
];

export async function cmdOffering(args: ParsedArgs): Promise<number> {
  const verb = args.positional[1];
  const cid = args.positional[2];
  const unsupportedFlags = Object.keys(args.flags).filter((name) => name !== "json");
  const unsupportedOptions = Object.keys(args.options);
  if (unsupportedFlags.length > 0 || unsupportedOptions.length > 0) {
    const name = unsupportedFlags[0] ?? unsupportedOptions[0];
    return refuseUsage(args, "nexus offering", USAGE, `unsupported option --${name}`);
  }
  if (verb !== "inspect" || !cid || args.positional.length > 3) {
    return refuseUsage(args, "nexus offering", USAGE, verb === "inspect" && !cid ? "name one offering CID" : undefined);
  }
  try {
    const result = await runNexusInspectOffering({ offeringCid: cid });
    emit(args, {
      ok: true,
      data: result as unknown as Record<string, unknown>,
      human: () => {
        console.log("nexus offering inspect — local immutable gift:");
        console.log(`  offering: ${result.offeringCid}`);
        console.log(`  board:    ${result.boardUrl}`);
        console.log(`  transport: ${result.transport.status} · ${result.transport.source} · remote fetch ${result.transport.remoteFetch ? "used" : "none"}`);
        console.log(`  inspection: ${result.inspection.status} · bytes ${result.inspection.byteStatus} · adoption ${result.inspection.adoption}`);
        console.log(`  signed:   yes · ${result.verification.blobCount ?? 0} blob(s)`);
        console.log(`  bytes:    ${result.bytes.held.length} held · ${result.bytes.missing.length} missing · ${result.bytes.invalid.length} invalid`);
        console.log("  antigen:  unavailable · not configured");
        console.log("  no bytes fetched; no installation or grammar mutation occurred");
      },
    });
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err instanceof NexusOfferingInspectError ? "not-found" : "error";
    emit(args, { ok: false, error: { code, message }, human: () => console.error(`lares nexus offering inspect: ${message}`) });
    return exitFor(code);
  }
}
