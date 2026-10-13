/**
 * keyhive-provider-surface — what `KeyhiveProvider` promises its callers at the keyhive boundary, pinned
 * against the live WASM: the wasm stands from content on either feed, ids read as `0x` + 64 hex of raw bytes,
 * an archive restores the identity that sealed and still opens its content, a REVOKED event stamps the
 * document it acts on, and `verify` keeps its binary verdict table over keyhive's four grades.
 */
import { describe, expect, test } from "vitest";

const RAW_ID = /^0x[0-9a-f]{64}$/;

describe("KeyhiveProvider at the keyhive boundary", () => {
  // The keyhive package loads once per test file, so its wasm instance outlives a module reset: this test
  // runs first and is the only one that meets the build before any feed.
  test("the slim build is dead until fed; a feed that is no wasm refuses loudly; host-fed bytes stand it", async () => {
    const [KH, { setKeyhiveWasmBytes, ensureKeyhiveWasm, KeyhiveProvider }, { wasmBase64 }, { base64ToBytes }, { InMemoryEventStore }] = await Promise.all([
      import("@keyhive/keyhive/slim"),
      import("../src/keyhive-provider.js"),
      import("@keyhive/keyhive/wasm-base64"),
      import("../src/bytes-base64.js"),
      import("../src/event-store.js"),
    ]);
    const sign = (): number => KH.Signer.memorySignerFromBytes(new Uint8Array(32).fill(0x70)).verifyingKey.length;
    expect(sign, "CONTROL: nothing has instantiated the wasm, so a keyhive call throws").toThrow();
    setKeyhiveWasmBytes(new Uint8Array([1, 2, 3, 4]));
    expect(() => ensureKeyhiveWasm(), "a feed that is no wasm module surfaces at the feed").toThrow();
    expect(sign, "a refused feed leaves the build dead").toThrow();
    setKeyhiveWasmBytes(base64ToBytes(wasmBase64));
    ensureKeyhiveWasm();
    expect(sign()).toBe(32);
    expect(() => ensureKeyhiveWasm(), "a second feed finds the instance live and agrees with it").not.toThrow();
    const provider = new KeyhiveProvider();
    await provider.init({ seed: new Uint8Array(32).fill(0x72), eventStore: new InMemoryEventStore() });
    expect(await provider.whoami()).toMatch(RAW_ID);
    await provider.dispose();
  });

  test("an archive restores the identity that sealed, and that identity still opens its content", async () => {
    const { KeyhiveProvider, InMemoryEventStore } = await import("../src/index.js");
    const seed = new Uint8Array(32).fill(0x73);
    const bagUrl = "lar:///probe.archive.content-round-trip";
    const source = new KeyhiveProvider();
    await source.init({ seed, eventStore: new InMemoryEventStore() });
    const { docId } = await source.registerBag(bagUrl);
    const cleartext = new TextEncoder().encode("the archive keeps the content key");
    const ciphertext = await source.encryptContent(bagUrl, cleartext);
    const identity = await source.whoami();
    const archiveBytes = await source.exportArchive();

    // CONTROL: a same-seed provider standing WITHOUT the archive holds the name and none of the keys.
    const bare = new KeyhiveProvider();
    await bare.init({ seed, eventStore: new InMemoryEventStore() });
    bare.adoptBag(bagUrl, docId);
    expect(await bare.whoami()).toBe(identity);
    await expect(bare.decryptContent(bagUrl, ciphertext)).rejects.toThrow();

    const restored = new KeyhiveProvider();
    await restored.init({ seed, eventStore: new InMemoryEventStore(), archiveBytes });
    restored.adoptBag(bagUrl, docId);
    expect(docId).toMatch(RAW_ID);
    expect(await restored.whoami()).toBe(identity);
    expect(await restored.decryptContent(bagUrl, ciphertext)).toEqual(cleartext);
    await Promise.all([source.dispose(), bare.dispose(), restored.dispose()]);
  });

  test("a sentinel names its document and its agent, and DELEGATED and REVOKED events stamp that document", async () => {
    const { KeyhiveProvider, InMemoryEventStore } = await import("../src/index.js");
    const rows: { variant: string; island?: string }[] = [];
    const eventStore = { put: async (r: { variant: string; island?: string }) => { rows.push(r); }, list: async () => [] };
    const founder = new KeyhiveProvider();
    const reader = new KeyhiveProvider();
    await founder.init({ seed: new Uint8Array(32).fill(0x74), eventStore: eventStore as never });
    await reader.init({ seed: new Uint8Array(32).fill(0x75), eventStore: new InMemoryEventStore() });
    const { docIdHex, agentIdHex } = await founder.createSentinelDoc("lar:///probe.revocation.island");
    expect(docIdHex).toMatch(RAW_ID);
    expect(agentIdHex).toMatch(RAW_ID);
    const { id: readerId } = await founder.receiveContactCard(await reader.contactCard());
    expect(readerId).toBe(await reader.whoami());
    await founder.addSentinelMember(readerId, docIdHex);
    expect((await founder.verifySentinelMembership(readerId, docIdHex)).ok).toBe(true);
    await founder.revokeSentinelMember(readerId, docIdHex);
    await founder.settleEvents();

    const delegated = rows.filter((r) => r.variant === "DELEGATED");
    const revoked = rows.filter((r) => r.variant === "REVOKED");
    expect(delegated.length).toBeGreaterThan(0);                       // CONTROL: the capture heard the grant
    expect(delegated.every((r) => r.island === docIdHex)).toBe(true);
    expect(revoked.length).toBeGreaterThan(0);
    expect(revoked.every((r) => r.island === docIdHex)).toBe(true);
    await Promise.all([founder.dispose(), reader.dispose()]);
  });

  test("verify's verdict table over keyhive's four grades: any grant answers a read, only admin answers admin", async () => {
    const [{ KeyhiveProvider, InMemoryEventStore }, KH] = await Promise.all([import("../src/index.js"), import("@keyhive/keyhive/slim")]);
    const bytesOf = (idHex: string): Uint8Array => Uint8Array.from(Buffer.from(idHex.replace(/^0x/, ""), "hex"));
    const owner = new KeyhiveProvider();
    await owner.init({ seed: new Uint8Array(32).fill(0x76), eventStore: new InMemoryEventStore() });
    const bagUrl = "lar:///probe.verify.grades";
    const { docId } = await owner.registerBag(bagUrl);
    const kh = (owner as unknown as { requireKh: () => InstanceType<typeof KH.Keyhive> }).requireKh();
    const stranger = new KeyhiveProvider();
    await stranger.init({ seed: new Uint8Array(32).fill(0x7f), eventStore: new InMemoryEventStore() });
    const { id: strangerId } = await owner.receiveContactCard(await stranger.contactCard());
    // CONTROL: a known agent holding no grant is refused both ways.
    expect((await owner.verify({ bagUrl, presenter: strangerId, access: "read" })).ok).toBe(false);
    expect((await owner.verify({ bagUrl, presenter: strangerId, access: "admin" })).ok).toBe(false);
    const verdicts: Record<string, { read: boolean; admin: boolean }> = {};
    for (const [i, grade] of (["relay", "read", "edit", "admin"] as const).entries()) {
      const peer = new KeyhiveProvider();
      await peer.init({ seed: new Uint8Array(32).fill(0x80 + i), eventStore: new InMemoryEventStore() });
      const { id } = await owner.receiveContactCard(await peer.contactCard());
      // Granted through keyhive itself: the provider's own `delegate` door carries only read and admin.
      await kh.addMember(new KH.Identifier(bytesOf(id)), KH.MemberedId.document(new KH.DocumentId(bytesOf(docId))), KH.Access.fromString(grade), []);
      verdicts[grade] = {
        read: (await owner.verify({ bagUrl, presenter: id, access: "read" })).ok,
        admin: (await owner.verify({ bagUrl, presenter: id, access: "admin" })).ok,
      };
      await peer.dispose();
    }
    // The gate is BINARY (capability-provider: read or admin). The relay row reads true because the gate asks
    // "any grant?", never "a grant that carries the key?": keyhive itself orders relay BELOW read. No door of
    // this tree grants relay, so the row stays unreachable until one does; that day this row wants a ruling.
    expect(verdicts).toEqual({
      relay: { read: true, admin: false },
      read:  { read: true, admin: false },
      edit:  { read: true, admin: false },
      admin: { read: true, admin: true },
    });
    await Promise.all([owner.dispose(), stranger.dispose()]);
  });
});
