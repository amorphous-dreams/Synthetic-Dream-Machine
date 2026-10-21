import { describe, expect, test } from "vitest";
import { groupSecretOpenerFromSeed, type LarTiddlerRecord, type LarTiddlerStore } from "@lararium/mesh";
import { runDeviceAdmitEdge } from "../src/ceremony-core.js";
import { faceOperationTitle, readFaceOperation } from "../src/face-operation-record.js";

describe("a face operation record", () => {
  test("an issued seal survives a throw after the record write and re-enters byte for byte", async () => {
    const records = new Map<string, LarTiddlerRecord>();
    let writes = 0;
    const store = {
      get: async (title: string) => records.get(title) ?? null,
      put: async (record: LarTiddlerRecord) => {
        writes += 1;
        records.set(record.tiddler.title, record);
        if (writes === 1) throw new Error("cut after operation record");
      },
    } as unknown as LarTiddlerStore;
    const atomSeed = new Uint8Array(32).fill(71);
    const signedInput = new TextEncoder().encode("signed fleet join request");
    const input = {
      signerSeed: new Uint8Array(32).fill(72),
      joineeVerifyingKey: groupSecretOpenerFromSeed(new Uint8Array(32).fill(73)).deviceKey,
      personaKelPrefix: "prefix", personaKelChain: [{}] as never, personaActs: [],
      hearthTrueName: "hearth", personaGroupId: "group", meshCabalDocIdHex: "cabal",
      syncUrl: null, hearthDaemonUrl: null, personaUrl: "automerge:face",
      operation: { store, atomSeed, signedInput },
    };
    await expect(runDeviceAdmitEdge(input)).rejects.toThrow("cut after operation record");
    const issued = await readFaceOperation(store, atomSeed, signedInput);
    expect(issued).toBeTruthy();
    const replay = await runDeviceAdmitEdge(input);
    expect(replay).toEqual(issued);
    expect(writes).toBe(1);
    expect([...records.keys()]).toEqual([await faceOperationTitle(signedInput)]);
    expect(JSON.stringify([...records.values()])).not.toContain(replay.groupSecretSeal.c);
  });
});
