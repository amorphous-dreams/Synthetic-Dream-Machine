/**
 * module-pins — the island evaluates a module only where its bytes match a pin the house carries.
 *
 * The SES gate's soundness reads as one equality: the set of code the island evaluates equals the set the host hash-verified
 * (`lar:///ha.ka.ba/lares/api/pono/island-host-contract#/ses-gate`). The core blob carries its pin into the bridge; every other
 * piece of code reaches the engine through ONE door, `$tw.modules.define(name, type, definition)`, and a string definition there
 * later runs through `evalSandboxed`. The gate stands at that door: a string definition no pin names (its title, module type and
 * text together) never enters the module table, and the refusal reads by name (`ModuleUnpinned`).
 *
 * WHERE A PIN COMES FROM. A pin names one module's title, module type and text, and it reaches the gate only off bytes some other pin already
 * verified: the modules the pinned core blob packs (read off its own preloads before any caller's preload joins them), the modules
 * a CAS blob packs once its bytes hash to the CID the manifest or the genesis seed names (`casBlobPreloads`), and a granted module
 * the trusted-module gate admitted after it checked the grant and the `source-sha256`. `modulePinsOf` reads digests off records;
 * a caller hands it only records a pin already covers, never records it has not verified.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/island-host-contract#/ses-gate
 */
import { sha256HexBytesSync, sha256HexSync } from "@lararium/mesh/crypto";
import { preloadsFromCasBlob } from "./cas-preloads.js";

/** The named refusal a module meets when no pin the house carries names its bytes. */
export const MODULE_UNPINNED = "ModuleUnpinned";
/** The named refusal a CAS blob meets when its bytes hash to another value than the CID that names it. */
export const BLOB_PIN_MISMATCH = "BlobPinMismatch";

/** The lowercase hex SHA-256 of a module text's UTF-8 bytes, the string TW5 evaluates: what a refusal reports. */
export function moduleDigest(text: string): string {
  return sha256HexSync(text);
}

/**
 * One module's pin: the SHA-256 of its title, its module type and its text together, so a pin admits those bytes under the title
 * and the type the verified record gave them and nowhere else. A pinned no-op's text under a guard module's title refuses.
 */
export function modulePin(title: string, moduleType: string, text: string): string {
  return sha256HexSync(JSON.stringify([title, moduleType, text]));
}

/**
 * The pins of every module the records pack: each loose record carrying a title, a `module-type` and a string text, and each shadow
 * a plugin record packs with one (under the key TW5 names the shadow by). Hand it only records whose bytes a pin already verified.
 */
export function modulePinsOf(records: readonly Record<string, unknown>[]): Set<string> {
  const pins = new Set<string>();
  for (const record of records) {
    if (!record || typeof record !== "object") continue;
    if (typeof record["title"] === "string" && typeof record["module-type"] === "string" && typeof record["text"] === "string") {
      pins.add(modulePin(record["title"], record["module-type"], record["text"]));
    }
    if (record["plugin-type"] === undefined || typeof record["text"] !== "string") continue;
    let packed: unknown;
    try { packed = (JSON.parse(record["text"]) as { tiddlers?: unknown }).tiddlers; } catch { continue; }
    if (!packed || typeof packed !== "object") continue;
    for (const [title, shadow] of Object.entries(packed as Record<string, unknown>)) {
      const fields = shadow as Record<string, unknown> | null;
      if (fields && typeof fields === "object" && typeof fields["module-type"] === "string" && typeof fields["text"] === "string") {
        pins.add(modulePin(title, fields["module-type"], fields["text"]));
      }
    }
  }
  return pins;
}

/** A CAS blob's preloads, read only once its bytes hash to the CID that names it; another hash refuses by name. */
export function casBlobPreloads(bytes: Uint8Array, cid: string): Record<string, unknown>[] {
  const actual = sha256HexBytesSync(bytes);
  if (actual !== cid.toLowerCase()) throw new Error(`${BLOB_PIN_MISMATCH}: the blob named ${cid.slice(0, 12)}… hashes to ${actual.slice(0, 12)}…`);
  return preloadsFromCasBlob(bytes);
}

interface ModuleTable { define(name: string, moduleType: string, definition: unknown): unknown }
const GATED = Symbol.for("lararium.tw5.module-pin-gate");

/**
 * Stand the gate on an engine's module door, once per engine: a later call widens nothing and returns the gate already standing.
 * `pins` stays the caller's live set, so a pin the trusted-module gate adds after boot admits that module alone.
 */
export function armModulePinGate(
  tw: { modules: ModuleTable },
  pins: Set<string>,
  onRefuse: (title: string, digest: string) => void,
): void {
  const modules = tw.modules as (ModuleTable & { [GATED]?: true }) | undefined;
  if (typeof modules?.define !== "function") throw new Error(`${MODULE_UNPINNED}: the engine exposes no module door the pin gate can stand on`);
  if (modules[GATED]) return;
  const define = modules.define.bind(modules);
  Object.defineProperty(modules, GATED, { value: true });
  modules.define = (name: string, moduleType: string, definition: unknown): unknown => {
    if (typeof definition === "string" && !pins.has(modulePin(name, moduleType, definition))) {
      onRefuse(name, moduleDigest(definition));
      return undefined;
    }
    return define(name, moduleType, definition);
  };
}
