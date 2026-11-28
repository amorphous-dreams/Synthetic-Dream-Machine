/**
 * hearth-daemon-crossing (road row `L4f`) — the face's signed log names the hearth's daemon working document for a device,
 * and the hearth's tables read which of its documents that name may point at.
 *
 * Reds: a root-signed `device-edge` act that names `hearthDaemon` folds into `hearthDaemons` under its device; the state
 * document's `daemon-slot/working/<group>` row answers the hearth's own working slot; the device table answers the group a
 * working slot belongs to. Controls: an edge that names none folds none; a later edge that names none clears the earlier
 * name; a barred device names none; a draft slot, another group's slot, a canon and a floor slot answer no working group.
 */
import { describe, expect, test } from "vitest";
import { PERSONA_ACT_DOMAIN } from "../src/domains.js";
import { ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } from "../src/ed25519-door.js";
import { makeHandLineage } from "../src/hand-lineage.js";
import { projectPersonaLog, type PersonaActBody } from "../src/persona-act.js";
import { actCid, signAct } from "../src/signed-act.js";
import { VESSEL_STATE_ID } from "../src/lar-uris.js";
import { wikiSlotUri } from "../src/wiki-recipe.js";
import { emptyLarDoc, type LarDoc } from "../src/base-doc.js";
import { storedLarRecord } from "../src/stored-record.js";
import { deviceDaemonDocs, floorDaemonSlotTitle, hearthDaemonOf } from "../src/device-daemon-docs.js";
import { taggedAdmission } from "./vessel-tag-fixture.js";

const seed = (n: number): Uint8Array => new Uint8Array(32).fill(n);
const who = async (n: number) => ({ key: await ed25519VerifyingKeyFromSeed(seed(n)), sign: ed25519SignerFromSeed(seed(n)) });
const G = "g1";
const HEARTH = "automerge:hearth-working";
const act = (seq: number, prior: string | null, kind: PersonaActBody["act"], extra: Record<string, unknown> = {}) =>
  ({ kind: PERSONA_ACT_DOMAIN, group: G, seq, prior, act: kind, epoch: 0, ...extra }) as PersonaActBody;
const lineageOf = (...keys: string[][]) => makeHandLineage(keys.map((signers, epoch) => ({ epoch, signers, threshold: 1 })))!;

async function seated(edge: Record<string, unknown>) {
  const root = await who(1);
  const f = await signAct(act(0, null, "founding", { personaKelPrefix: "kel1", rootCommitment: "rc" }), root);
  const a = await signAct(act(1, actCid(f.body), "admission", { ...(await taggedAdmission(10, G, "dev1")) }), root);
  const l = await signAct(act(2, actCid(a.body), "device-edge", { deviceKey: "dev1", edgeDigest: "ed1", ...edge }), root);
  const project = (log: unknown[]) => projectPersonaLog(log, { group: G, lineage: lineageOf([root.key]), authorize: () => true });
  return { root, log: [f, a, l], project };
}

describe("the face's signed log names the hearth's daemon working document for a device", () => {
  test("RED: a device-edge act that names the hearth's daemon document folds it under that device", async () => {
    const { log, project } = await seated({ hearthDaemon: HEARTH });
    expect(project(log).hearthDaemons).toEqual({ dev1: HEARTH });
    expect(project(log).edges).toEqual({ dev1: "ed1" });
  });

  test("CONTROL: an edge that names none folds none, and a renewal that carries none clears the earlier name", async () => {
    const bare = await seated({});
    expect(bare.project(bare.log).hearthDaemons).toEqual({});
    const { root, log, project } = await seated({ hearthDaemon: HEARTH });
    const renewal = await signAct(act(3, actCid(log[2]!.body), "device-edge", { deviceKey: "dev1", edgeDigest: "ed2" }), root);
    expect(project([...log, renewal]).hearthDaemons).toEqual({});
  });

  test("CONTROL: an edge for a device no admission seats names nothing, and a value that reads no string names nothing", async () => {
    const { root, log, project } = await seated({ hearthDaemon: 7 });
    expect(project(log).hearthDaemons).toEqual({});
    const refused = await signAct(act(3, actCid(log[2]!.body), "admission", { deviceKey: "dev2" }), root);   // no tag: the fold bars dev2
    const stray = await signAct(act(4, actCid(refused.body), "device-edge", { deviceKey: "dev2", edgeDigest: "ed9", hearthDaemon: HEARTH }), root);
    expect(project([...log, refused, stray]).hearthDaemons).toEqual({});
  });
});

function state(entries: Record<string, string>): LarDoc {
  const doc = emptyLarDoc();
  for (const [title, id] of Object.entries(entries)) doc.tiddlers[title] = storedLarRecord(title, { text: `automerge:${id}` }, "test");
  return doc as LarDoc;
}
const slot = (group: string, kind = "working") => `${VESSEL_STATE_ID}/daemon-slot/${kind}/${encodeURIComponent(group)}`;

describe("the hearth reads its own working slot off its state document", () => {
  test("RED: the state row of the face's working slot answers its document", () => {
    expect(hearthDaemonOf(state({ [slot("group one")]: "w1" }).tiddlers, "group one")).toBe("automerge:w1");
  });

  test("CONTROL: a draft slot, another group's slot and an absent state document answer none", () => {
    expect(hearthDaemonOf(state({ [slot("g1", "draft")]: "d1", [slot("g2")]: "w2" }).tiddlers, "g1")).toBeNull();
    expect(hearthDaemonOf(undefined, "g1")).toBeNull();
  });

  test("RED: the device table answers the group a working slot belongs to; CONTROL: a draft slot, a canon, a floor slot and an unnamed slot answer none", () => {
    const docs = deviceDaemonDocs({ enrollFloor: () => {} });
    const F1 = "11111111-1111-4111-8111-111111111111";
    docs.readState(state({ [slot("g1")]: "w1", [slot("g1", "draft")]: "d1", [`${VESSEL_STATE_ID}/daemon-canon/${F1}`]: "c1" }));
    docs.readFloor(state({ [floorDaemonSlotTitle("working")]: "f1" }));
    docs.announced(wikiSlotUri("daemon", "working"), "unnamed");
    expect(docs.workingGroupOf("w1")).toBe("g1");
    for (const id of ["d1", "c1", "f1", "unnamed", "stranger"]) expect(docs.workingGroupOf(id), id).toBeNull();
  });
});
