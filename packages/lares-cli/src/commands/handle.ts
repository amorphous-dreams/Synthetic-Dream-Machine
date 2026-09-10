/**
 * `lares handle {publish|rotate|graft|burn|attest}` — the Handle's verb family.
 *
 * A Handle names a persona's public "here I am" note: a self-certifying card announced onto the Nexus WHO
 * board. Its lifecycle rides the handle-KEL (a sibling grammar to the persona-KEL): publish · rotate · graft ·
 * burn · attest. `publish` stands live; the other four scaffold their ahu — the KEL MINT primitives already
 * live in @lararium/mesh (mintHandleRotation · mintHandleGraft · mintHandleBurn · attestUnderHead), and each
 * stub names the vessel-side orchestration a later pass wires (read the chain, gather authorization, mint,
 * write back). A Handle anchors to its persona (the persona-KEL prefix owns it), so a lost presentation key
 * recovers through the persona; that owner-binding is why these verbs cannot fold into `persona`.
 */
import type { ParsedArgs } from "../parse-args.js";
import { runHandlePublish, runHandleBurn } from "@lararium/node";

/** A recognized-but-unwired verb reports its shape and where its ahu waits, then declines to act. */
function declared(verb: string, willDo: string, mint: string): number {
  console.error(`[lares handle ${verb}] declared, not yet wired — ${willDo}`);
  console.error(`  the KEL mint stands (@lararium/mesh ${mint}); the vessel-side orchestration awaits its pass.`);
  console.error(`  canon: lar:///ha.ka.ba/lararium/mesh/handle-card`);
  return 3;
}

async function handlePublish(args: ParsedArgs): Promise<number> {
  const glamour = args.positional[1] ?? args.options["glamour"];
  if (!glamour) {
    console.error('[lares handle publish] a glamour (display name) is required: lares handle publish "Guru-Josh"');
    return 2;
  }
  const opts: Parameters<typeof runHandlePublish>[0] = { glamour };
  if (args.options["persona"] !== undefined) Object.assign(opts, { handleIndex: Number(args.options["persona"]) });
  const card = await runHandlePublish(opts);
  console.log(`[lares handle] published "${card.glamour}" — nym ${card.nym.slice(0, 24)}… (v${card.version})`);
  return 0;
}

export async function cmdHandle(args: ParsedArgs): Promise<number> {
  const sub = args.positional[0];
  switch (sub) {
    case "publish": return await handlePublish(args);
    case "rotate":
      return declared("rotate", "seat a fresh presentation key under the same name, the owner authorizing", "mintHandleRotation");
    case "graft":
      return declared("graft", "turn the presenting owner-set over (succession); TRUE k-of-n graft governance rides declared", "mintHandleGraft");
    case "burn": {
      const opts: Parameters<typeof runHandleBurn>[0] = {};
      if (args.options["persona"] !== undefined) Object.assign(opts, { handleIndex: Number(args.options["persona"]) });
      const card = await runHandleBurn(opts);
      console.log(`[lares handle] burned "${card.glamour}" — nym ${card.nym.slice(0, 24)}… is buried, terminal (readers refuse it)`);
      return 0;
    }
    case "attest":
      return declared("attest", "carry a signed claim ON the card (e.g. a domain), bound to the head event", "attestUnderHead");
    default:
      console.error('[lares handle] usage: lares handle publish "<glamour>" [--persona <index>]');
      console.error('  verb family: publish (live) · rotate · graft · burn · attest (declared — the KEL mints stand, orchestration awaits)');
      return 2;
  }
}
