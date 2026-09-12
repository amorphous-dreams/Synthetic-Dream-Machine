/**
 * nexus-kahuli — the OVERTURN door: advance one ratchet tier of this Nexus's genesis composition.
 *
 * One verb, the TIER is the argument (parity with `nexus seal <sub>` + `vessel rite <name>`). kāhuli is
 * the act; ʻōlelo kāhuli is the result-state of `kahuli grammar`. Two ratchets ride one genesis doc:
 *   · ENGINE  (engineCid = the hearth true-name) — SLOW, signed into every device delegation edge, so it
 *             binds MEMBERSHIP. Advancing it re-binds the whole fleet; HELD until the graceful forward-
 *             rebind (predecessor pointer + a both-epoch read span, ending by non-renewal) has its rulings.
 *   · GRAMMAR (grammarCid = the REQUIRED memetic-wikitext grammar ALONE) — FAST, never the true-name.
 * An operator's OWN plugin collection (pluginsCid) is NOT a kāhuli tier: it layers on the required base,
 * overturns nobody else's reading, and moves with no ratchet act at all.
 *
 * The epochs read through the SAME composable genesis cap the vessel boots from (`LAR_GENESIS` →
 * `~/.lares/config.json` → repo-relative `<corpus>/genesis`). A hand-rolled `larRoot()/genesis` read
 * honoured neither, so with the cap pointed elsewhere this verb reported the epochs of an island the
 * vessel does not boot — and the epoch it prints is the hearth true-name, the value an operator reads
 * before deciding whether an overturn strands a fleet. A silent wrong answer is the worst shape here.
 *
 * ── WHAT THIS DOOR OWES ITS PARENT ──────────────────────────────────────────────────────────────
 * Nothing. It reads three genesis epochs and refuses through the shared choke point, and it holds no
 * reference back into `nexus.ts` — the dependency runs one way, parent to child, as every other
 * companion in this directory runs.
 */
import { readGenesisEngineCid, readGenesisGrammarCid, readGenesisPluginsCid } from "@lararium/node";
import { refuseUsage } from "../render.js";
import type { ParsedArgs } from "../parse-args.js";

const KAHULI_USAGE: readonly string[] = [
  "usage: lares nexus kahuli <engine | grammar>",
  "",
  "  the OVERTURN — advance one ratchet tier of this Nexus's genesis composition:",
  "    engine   the SLOW ratchet: the hearth true-name (engineCid), signed into every device",
  "             delegation edge — it binds MEMBERSHIP. HELD: advancing re-binds the fleet mesh-wide;",
  "             the graceful forward-rebind span (predecessor + both-epoch reads) awaits its rulings.",
  "    grammar  the FAST ratchet: the REQUIRED memetic-wikitext grammar alone (grammarCid) —",
  "             never the true-name. Reads the current epoch; --apply re-derives the island (the bake).",
  "",
  "  a read NEVER builds — the deliberate build+push lives behind --apply and in `nexus rite kahuli`.",
];

/**
 * `lares nexus kahuli engine` — the SLOW ratchet, HELD. A deliberate not-yet, never an unknown verb: the
 * tier is real and its advance is withheld on purpose, because moving engineCid re-binds every device edge.
 */
function kahuliEngineHeld(): number {
  const engineCid = readGenesisEngineCid();
  console.error("nexus kahuli engine — HELD.");
  console.error(`  current engine epoch (true-name): ${engineCid ?? "(no island baked in this root yet)"}`);
  console.error("  advancing the engine re-binds MEMBERSHIP mesh-wide — every device delegation edge signs it.");
  console.error("  the graceful forward-rebind (predecessor pointer + a both-epoch read span, ending by");
  console.error("  non-renewal — NOT a unilateral fleet reset) awaits its coexistence-span rulings. See");
  console.error("  memory: project_nexus_identity_kahuli_onboarding — engine-watch EW-7.");
  return 2;
}

/**
 * `lares nexus kahuli grammar` — the FAST ratchet. This first version READS the current grammar epoch
 * (grammarCid) and reports it beside the operator's own collection; a read never builds. `--apply` is where the overturn composes the bake
 * (`vessel bake` re-derives the island at the freshly-packed plugin) and the mesh-push — both wired next.
 */
function kahuliGrammar(args: ParsedArgs): number {
  const grammarCid = readGenesisGrammarCid();
  const pluginsCid = readGenesisPluginsCid();
  const engineCid  = readGenesisEngineCid();

  if (args.flags["apply"]) {
    console.error("nexus kahuli grammar --apply — HELD (the overturn's payload is wired next).");
    console.error("  --apply composes the diff-gate → the genesis re-derive (`bakePlan`/`build-genesis-island`,");
    console.error("  the internal primitive — never a `vessel` door) → the mesh-push, which advances the LIVE");
    console.error("  Nexus's grammar epoch on the DreamNet. ONE hold remains: the push rides the same");
    console.error("  coexistence-span rulings as `kahuli engine`. Ledgered in the kāhuli onboarding memory.");
    return 2;
  }

  console.log("nexus kahuli grammar — the current genesis epoch (a read; nothing built):");
  const none = "(no island baked in this root yet)";
  console.log(`  grammar (grammarCid, fast ratchet): ${grammarCid ?? none}   the REQUIRED memetic-wikitext grammar`);
  console.log(`  engine  (engineCid, true-name):     ${engineCid ?? none}   the slow ratchet, binds membership`);
  console.log(`  plugins (pluginsCid, not a tier):   ${pluginsCid ?? none}   THIS operator's own collection`);
  console.log("");
  console.log("  to OVERTURN the grammar: pack the plugin, then compose the re-derive + push —");
  console.log("    pnpm --filter @lararium/tw5 build:plugin   (pack the memetic-wikitext grammar)");
  console.log("    lares nexus rite kahuli                    (diff-gate → re-derive → push; idempotent, skips-unchanged)");
  console.log("  the diff-gate (candidate grammarCid vs current) + --apply are wired next.");
  return 0;
}

/**
 * `lares nexus rite kahuli` — the composed OVERTURN, the deliberate build's home (so a read never builds).
 * Diff-gated + idempotent-by-intent: it runs whichever tier actually moved and skips an unchanged one. This
 * first version reports each tier's state and the holds; the bake+push payload lands as the zones settle.
 */
export async function runKahuliRite(args: ParsedArgs): Promise<number> {
  const rest = { ...args, positional: args.positional.slice(2) };
  console.log("nexus rite kahuli — the composed overturn (diff-gated, idempotent, skips-unchanged):");
  console.log("  engine:  HELD — the slow ratchet's forward-rebind span awaits its rulings (see `kahuli engine`).");
  console.log("  grammar:");
  return await Promise.resolve(kahuliGrammar(rest));
}

export async function cmdKahuli(args: ParsedArgs): Promise<number> {
  const tier = args.positional[1];
  switch (tier) {
    case "engine":  return kahuliEngineHeld();
    case "grammar": return await Promise.resolve(kahuliGrammar(args));
    default:
      return refuseUsage(args, "nexus kahuli", KAHULI_USAGE, tier ? `unknown tier "${tier}"` : undefined);
  }
}
