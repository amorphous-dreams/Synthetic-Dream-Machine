/**
 * FLOOR THEN FACE, ONE COMPOSITION ON EVERY HOST (the-veil-ladder#/the-base-model; the controller's addendum: "the founding
 * act asks for a face; it's not a host trait").
 *
 *   W1  the floor record `foundThePlace` stands holds the place alone: its daemon document names the hearth and carries none
 *       of the seven pins a face writes, so a face that lands later overlays a floor that named no face.
 *   W2  THE WELD: the node's founding (`commands/init.ts`) and the browser's boot (`open-browser-vessel.ts`) both stand the
 *       place through `foundThePlace` and land a face through `foundTheFace`, in that order, and neither host calls the
 *       fused `runFoundingCeremony`. A host that founds a face by another path reads red here.
 *   W3  a face-0 landing over a floor that wrote nothing runs the Lift and finds nothing: no row moves, nothing re-files.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  makeIslandRepo, CompositeStore, CONTROL_HOME_ID, DAEMON_BAG_ID, HEARTH_TRUE_NAME_TIDDLER, MESH_CABAL_SENTINEL_URI, PERSONA_GROUP_ID_TIDDLER, SIGNER_DID_TIDDLER,
  PERSONA_KEL_PREFIX_TIDDLER, DEVICE_DELEGATION_SELF_TIDDLER, MESH_CABAL_DOC_ID_TIDDLER, HEARTH_DAEMON_URL_TIDDLER, didFromVerifyingKey, emptyLarDoc,
  type LarDoc,
} from "@lararium/mesh";
import { MemoryTiddlerStore, makeCatalogAccessor } from "@lararium/tw5";
import { foundThePlace, meshCabalSentinelUriFor } from "../src/ceremony-core.js";
import { KeyhiveProvider } from "../src/keyhive-provider.js";
import { makeSlotDocResolver } from "../src/slot-doc-resolver.js";
import { makeFaceBagDoor } from "../src/face-bag-door.js";

const FACE_PINS = [PERSONA_GROUP_ID_TIDDLER, SIGNER_DID_TIDDLER, PERSONA_KEL_PREFIX_TIDDLER, DEVICE_DELEGATION_SELF_TIDDLER, MESH_CABAL_DOC_ID_TIDDLER, HEARTH_DAEMON_URL_TIDDLER];
const REPO = resolve(import.meta.dirname, "../../..");
const source = (path: string): string => readFileSync(resolve(REPO, path), "utf8");
/** The first CALL of `name(` in a source, past its imports and its comments; -1 where none stands. */
const firstCall = (text: string, name: string): number => {
  const code = text.split("\n").map((line) => (/^\s*(\/\/|\*|\/\*)/.test(line) || /^\s*import\b/.test(line) ? "" : line)).join("\n");
  return code.search(new RegExp(`\\b${name}\\(`));
};

describe("the floor stands first and a face lands over it, on every host", () => {
  test("W1 the floor record names a place and no face", async () => {
    const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
    const place = await foundThePlace({ repo: repo as never });
    expect(place.daemonUrl).toBe(place.daemonHandle.url);
    const titles = Object.keys((place.daemonHandle.doc() as LarDoc | undefined)?.tiddlers ?? {});
    // A PLACE BINDS NO HEARTH. The true-name record states the hearth a face's edge binds; before this cut a node's place
    // wrote the genesis engine CID under that title and its face later wrote the Nexus AID over it: one record, two meanings.
    expect(titles, "the true name waits for a face").not.toContain(HEARTH_TRUE_NAME_TIDDLER);
    for (const pin of FACE_PINS) expect(titles, `${pin} waits for a face`).not.toContain(pin);
    await repo.shutdown();
  });

  test("W1b a leaf's cabal sentinel seeds from the bare URI; a hearth's seeds under its Nexus AID", () => {
    expect(meshCabalSentinelUriFor("")).toBe(MESH_CABAL_SENTINEL_URI);
    expect(meshCabalSentinelUriFor("  ")).toBe(MESH_CABAL_SENTINEL_URI);
    expect(meshCabalSentinelUriFor("aid-of-one-hearth")).toBe(`${MESH_CABAL_SENTINEL_URI}/aid-of-one-hearth`);
  });

  test("W1c THE TRUE NAME NEVER READS THE ENGINE: no source hands an engine CID to an edge, a founding or a place", () => {
    // An engine-CID move (a kāhuli) must leave every edge byte-identical, a gateless leaf's ("" by design) and a
    // hearth's (its seed-charter Nexus AID) alike. The edge builder takes no engine input, so the law holds wherever no
    // caller feeds one in under the true name's field. This census reads every package's source for that feed.
    const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
    const feeds: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const at = join(dir, entry.name);
        if (entry.isDirectory()) { if (entry.name !== "node_modules" && entry.name !== "dist") walk(at); continue; }
        if (!/\.(ts|mts|mjs)$/.test(entry.name) || /\.d\.ts$/.test(entry.name)) continue;
        readFileSync(at, "utf8").split("\n").forEach((line, i) => {
          if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
          if (/hearthTrueName\s*[:=]\s*(await\s+)?(GENESIS_ENGINE_CID|readGenesisEngineCid|engineCid\b|coreHash\b)/.test(line)) feeds.push(`${at.slice(root.length + 1)}:${i + 1}`);
          if (/foundThePlace\(\{[^}]*hearthTrueName/.test(line)) feeds.push(`${at.slice(root.length + 1)}:${i + 1}`);
        });
      }
    };
    for (const pkg of readdirSync(root, { withFileTypes: true })) if (pkg.isDirectory() && existsSync(join(root, pkg.name, "src"))) walk(join(root, pkg.name, "src"));
    expect(feeds).toEqual([]);
  });

  test("W2 THE WELD: node and browser found the place, then the face, through the same two acts", () => {
    for (const host of ["packages/lararium-node/src/commands/init.ts", "packages/lararium-browser/src/open-browser-vessel.ts"]) {
      const text = source(host);
      const place = firstCall(text, "foundThePlace"), face = firstCall(text, "foundTheFace");
      expect(place, `${host} stands the place through foundThePlace`).toBeGreaterThan(-1);
      expect(face, `${host} lands a face through foundTheFace`).toBeGreaterThan(place);
      expect(firstCall(text, "runFoundingCeremony"), `${host} never fuses the two`).toBe(-1);
    }
  });

  test("W3 a face-0 landing over an unwritten floor lifts nothing", async () => {
    const kh = new KeyhiveProvider();
    await kh.init({ seed: new Uint8Array(32).fill(7), eventStore: { put: async () => {}, list: async () => [] } });
    const group = await kh.createGroup();
    const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
    const catalogHandle = repo.create<LarDoc>(emptyLarDoc());
    const daemon = new CompositeStore();
    daemon.addLayer({ bagId: DAEMON_BAG_ID, store: new MemoryTiddlerStore(DAEMON_BAG_ID), writable: true });
    const control = new CompositeStore();
    control.addLayer({ bagId: CONTROL_HOME_ID, store: new MemoryTiddlerStore(CONTROL_HOME_ID), writable: true, defaultWritable: true });
    const key = "cd".repeat(32);
    const refiled: string[] = [];
    const faced = makeSlotDocResolver({
      repo, daemonStore: daemon, control, keyhive: kh, deviceScoped: (slug: string) => slug === "daemon", catalog: makeCatalogAccessor(repo, catalogHandle.url),
      vesselDid: () => didFromVerifyingKey(key), mintedByHex: () => key, personaGroupId: group.groupId, faceSeated: async () => true,
      faceDoor: makeFaceBagDoor({ face: kh, groupId: group.groupId }) as never,
      announceLifted: (slug: string, documentId: string) => { refiled.push(`${slug}:${documentId}`); },
    } as never);
    const out = await faced.liftFloor();
    expect(out.moved).toEqual([]);
    expect(out.finished).toEqual([]);
    expect(out.skipped).toEqual([]);
    expect(refiled).toEqual([]);
    await kh.dispose();
    await repo.shutdown();
  });
});
