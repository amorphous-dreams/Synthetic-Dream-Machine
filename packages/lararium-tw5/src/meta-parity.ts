/**
 * meta-parity — the frame's line read of the sealed meta and smol-toml's read name ONE address, or tear.
 *
 * The frame reads the head-binding keys (`title`, `uri-path`, `namespace`) without a TOML parser, inside a
 * grammar where a line read and a TOML read cannot part (head-bind.ts). This is the belt beside those
 * braces: every house reader that holds the parser (the ingest gate, `lares meme check`, promotion) asks
 * `memeticVerdict`, which compares the frame's keys with smol-toml's root keys over the same root fence
 * (`rootMetaFence`, the fence that opens the body) and tears, `head-meta-split`, on any difference — or
 * where the parser refuses a meta the frame bound, since the record would then hold none of its fields.
 * A frame and a body that read two addresses for one carrier never stand under one `match` (blind
 * security read A1, 2026-11-01).
 *
 * PYRE LEDGER: KEEP — a parser-differential guard, a live invariant.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext-framing
 */
import { parse as smolParse } from "smol-toml";
import { rootMetaFence, sealedBindingKeys, verdict, type FrameFault, type FrameVerdict } from "@lararium/memetic-frame";

const KEYS = ["title", "uri-path", "namespace"] as const;

/** Each binding key the frame and smol-toml read differently, named; empty where they agree. */
export function metaParityFaults(text: string): FrameFault[] {
  const frameKeys = sealedBindingKeys(text);
  const fence = rootMetaFence(text);
  if (frameKeys === null || fence === null) return [];
  let parsed: Record<string, unknown>;
  try {
    parsed = smolParse(fence.body) as Record<string, unknown>;
  } catch (e) {
    return [{ kind: "head-meta-split", message: `the sealed meta binds the head, and TOML refuses it (${String(e).split("\n")[0]}) — the record would hold none of the fields the head binds against` }];
  }
  const faults: FrameFault[] = [];
  for (const key of KEYS) {
    const read = Object.hasOwn(parsed, key) ? parsed[key] : undefined;
    const smol = typeof read === "string" ? read : read === undefined ? undefined : String(read);
    if (smol !== frameKeys[key]) {
      faults.push({ kind: "head-meta-split", message: `the frame reads \`${key}\` as ${frameKeys[key] === undefined ? "absent" : `\`${frameKeys[key]}\``} where TOML reads ${smol === undefined ? "absent" : `\`${smol}\``} — two readings of one sealed meta` });
    }
  }
  return faults;
}

/** The frame verdict, torn where the frame's meta read and smol-toml's part. The house's verdict door. */
export function memeticVerdict(text: string): FrameVerdict {
  const v = verdict(text);
  if (v.kind !== "match" && v.kind !== "head-unbound") return v;
  const faults = metaParityFaults(text);
  return faults.length > 0 ? { kind: "torn", faults } : v;
}
