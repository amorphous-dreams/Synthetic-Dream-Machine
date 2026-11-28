/**
 * `lares vessel release <documentId> [keep=true|fresh=true]` — THE HAND'S RELEASE OF ONE QUARANTINED ID, a write with a door of
 * its own (`read` inspects and starts nothing).
 *
 *   (bare)    returns the quarantined bytes under the id; the next stand probes them again.
 *   keep=true    ends the hold and keeps whatever stands under the id; the moved-aside copy rests where it lies.
 *   fresh=true   starts a plane no sibling carries empty under its own name; the bytes stay aside.
 *
 * THE ACT HOLDS THE STORE. A live Repo would never see bytes move beneath it, so the release claims the store for its moment
 * (`claimStore`, the one claim a standing vessel also holds, and the one a container vessel's presence answers for) and
 * refuses by name where a holder answers, naming the stop that frees it. A fall during boot frees the claim while its husk
 * stays up, so the release also reads the resting falls (`fallenHolder`): a fall whose process still lives holds the store
 * too, and refuses the same way, naming its pid. Through the host shim a standing container refuses
 * before anything execs, and a stopped one hands the act to the offline door.
 */
import { claimStore, fallenHolder, releaseQuarantinedDoc, StoreHeld, type QuarantineReleaseAct } from "@lararium/node";
import { larDataDir } from "../env.js";
import { emit, proseFirst } from "../render.js";
import type { ParsedArgs } from "../parse-args.js";

export const RELEASE_USAGE = "lares vessel release <documentId> [keep=true|fresh=true]";

/** `args` with the sub-door name already consumed: `positional[0]` names the id. */
export async function cmdRelease(given: ParsedArgs): Promise<number> {
  // A hand act answers a pipe in prose (render.ts `proseFirst`); `--json` answers the envelope.
  const args = proseFirst(given);
  if (args.options["root"]) process.env["LAR_ROOT"] = args.options["root"];
  const documentId = args.positional[0];
  if (documentId === undefined || args.positional.length > 1) {
    console.error(`usage: ${RELEASE_USAGE} (\`lares vessel read\` lists the held ids)`);
    return 2;
  }
  const keep = args.flags["keep"] === true;
  const fresh = args.flags["fresh"] === true;
  if (keep && fresh) {
    console.error(`lares vessel release: name one act at a time, keep=true or fresh=true (${RELEASE_USAGE})`);
    return 2;
  }
  const act: QuarantineReleaseAct = keep ? "kept" : fresh ? "fresh" : "restored";
  const storageDir = larDataDir();
  let claim: Awaited<ReturnType<typeof claimStore>>;
  try { claim = await claimStore(storageDir); }
  catch (err) {
    if (!(err instanceof StoreHeld)) throw err;
    console.error(`lares vessel release: a holder answers for the store (${err.message}); stop the vessel first with \`lares vessel stop\`, then release again`);
    return 2;
  }
  let r: ReturnType<typeof releaseQuarantinedDoc>;
  try {
    const husk = fallenHolder(storageDir);
    if (husk !== null) {
      console.error(`lares vessel release: a fallen vessel (pid ${husk.pid}, fell ${husk.cause} on the ${husk.path} path at ${husk.since}) still stands over the store though its claim let go; stop the vessel first with \`lares vessel stop\`, then release again (a pid the kernel has since reused reads as living too: \`ps -p ${husk.pid}\` shows which process holds it)`);
      return 2;
    }
    r = releaseQuarantinedDoc(storageDir, documentId, act);
  }
  finally { await claim.release(); }
  emit(args, {
    ok: r.ok,
    data: r as unknown as Record<string, unknown>,
    ...(r.ok ? {} : { error: { code: "refused", message: r.why } }),
    human: () => r.ok
      ? console.log(r.act === "restored"
        ? `[lares] released ${documentId}: the bytes returned from ${r.from}; the next stand probes them again`
        : r.act === "kept"
          ? `[lares] released ${documentId}: what stands under the id stays; any moved-aside copy rests where it lay`
          : `[lares] released ${documentId}: the id starts empty under its own name; the bytes stay aside`)
      : console.error(`lares vessel release: ${r.why}`),
  });
  return r.ok ? 0 : 2;
}
