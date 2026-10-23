import { describe, expect, test } from "vitest";
import {
  DEVICE_DELEGATION_SELF_TIDDLER, HEARTH_DAEMON_URL_TIDDLER, HEARTH_TRUE_NAME_TIDDLER,
  MESH_CABAL_DOC_ID_TIDDLER, PERSONA_GROUP_ID_TIDDLER, PERSONA_KEL_PREFIX_TIDDLER,
  SIGNER_DID_TIDDLER, groupSecretOpenerFromSeed, makeIslandRepo, materializeSharedLarDoc,
  personaKelBoardDocUrl, personaKelChainForPrefix, seedDaemonDoc, vesselDyads,
} from "@lararium/mesh";
import { founderAndJoineeActs, frontierFromFoundingSeed } from "./admit-acts.js";
import { foundTheFace, foundThePlace, runApplyAdmitPayload, runDeviceAdmitEdge } from "../src/index.js";

const pins = [
  SIGNER_DID_TIDDLER, HEARTH_TRUE_NAME_TIDDLER, DEVICE_DELEGATION_SELF_TIDDLER,
  PERSONA_KEL_PREFIX_TIDDLER, PERSONA_GROUP_ID_TIDDLER, MESH_CABAL_DOC_ID_TIDDLER,
  HEARTH_DAEMON_URL_TIDDLER,
];
const key = (seed: Uint8Array) => groupSecretOpenerFromSeed(seed).deviceKey;
const repo = () => makeIslandRepo({ syncPort: new MessageChannel().port1 });

async function admitInput() {
  const founderRepo = repo();
  const founderSeed = new Uint8Array(32).fill(41);
  const signerSeed = new Uint8Array(32).fill(42);
  const atomSeed = new Uint8Array(32).fill(43);
  const founder = await foundThePlace({ repo: founderRepo, vesselSeed: founderSeed, hearthTrueName: "hearth" });
  const face = await foundTheFace({
    repo: founderRepo, daemonHandle: founder.daemonHandle, vesselVerifyingKey: key(founderSeed),
    vesselDisplayName: "founder", binding: { mode: "self-stood", signerSeed },
    hearthTrueName: "hearth", nexusPubkey: key(founderSeed), atomSeed: new Uint8Array(32).fill(44),
  });
  const board = await materializeSharedLarDoc(founderRepo, personaKelBoardDocUrl(key(founderSeed)), "board:persona-kel");
  const chain = personaKelChainForPrefix(board.doc(), face.personaKelPrefix);
  if (!chain) throw new Error("founder KEL chain absent");
  const payload = await runDeviceAdmitEdge({
    signerSeed, edgeFrontier: await frontierFromFoundingSeed(signerSeed), joineeVerifyingKey: key(atomSeed), personaKelPrefix: face.personaKelPrefix,
    personaKelChain: chain, hearthTrueName: "hearth", personaGroupId: face.personaGroupId,
    meshCabalDocIdHex: face.meshCabalDocIdHex, syncUrl: null,
    hearthDaemonUrl: founder.daemonUrl, personaUrl: face.personaUrl,
    personaActs: await founderAndJoineeActs({ face, signerSeed, founderAtomSeed: new Uint8Array(32).fill(44), joineeKey: key(atomSeed), chain }),
  });
  const joineeRepo = repo();
  const daemonHandle = seedDaemonDoc(joineeRepo);
  return { repo: joineeRepo, daemonHandle, atomSeed, vesselDisplayName: "joinee", payload, nexusPubkey: key(founderSeed) };
}

const pinImage = (doc: ReturnType<Awaited<ReturnType<typeof admitInput>>["daemonHandle"]["doc"]>) =>
  Object.fromEntries(pins.map((title) => [title, JSON.stringify(doc?.tiddlers[title] ?? null)]));

describe("an admitted face chooses whether to mount", () => {
  test("the default admit writes the singular pins", async () => {
    const input = await admitInput();
    await runApplyAdmitPayload(input);
    for (const title of pins) expect(input.daemonHandle.doc().tiddlers[title]).toBeDefined();
  });

  test("mount false keeps every singular pin already at rest", async () => {
    const input = await admitInput();
    input.daemonHandle.change((doc) => {
      for (const title of pins) doc.tiddlers[title] = {
        tiddler: { title, text: "worn-face", kind: "sentinel" }, meta: { authority: "test" },
      } as never;
    });
    const before = pinImage(input.daemonHandle.doc());
    await runApplyAdmitPayload({ ...input, mount: false });
    expect(pinImage(input.daemonHandle.doc())).toEqual(before);
    expect(vesselDyads(input.daemonHandle.doc())).toHaveLength(1);
  });
});
