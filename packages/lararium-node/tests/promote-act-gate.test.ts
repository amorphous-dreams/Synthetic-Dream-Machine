/**
 * promote-act-gate — the RAISING device's own raise completes before its daemon island restarts; nothing else ever holds an arrival.
 *
 * The raise (`lares kapae raise`) runs as a face row on the daemon island and the board watcher sees its act land before the row's reply
 * leaves; a bare restart then rejects the row (`daemon-restarting`) though the act landed. The gate counts the promote acts a session has
 * begun. `after(kinds, run)` hands `run` to the completion of the acts of those kinds standing NOW and returns true; with none standing it
 * returns false and the caller restarts at once. It never awaits and never holds a promise: a hung act leaves a plain restart (the owner
 * door's `island.restart`) free to force the swap, and an act that begins later is never waited on.
 */
import { expect, test } from "vitest";
import { promoteActGate, isPromoteAct } from "../src/promote-act-gate.js";

test("the names the gate counts: promote and kapae rows, nothing else", () => {
  for (const act of ["promote-commit", "promote-drop", "promote-orphan", "promote-prepare", "kapae-raise", "kapae-lower", "kapae-flag"]) expect(isPromoteAct(act), act).toBe(true);
  for (const act of ["kahua-lift", "face.resolve", "island.restart", "promote", ""]) expect(isPromoteAct(act), act).toBe(false);
});

test("RED: a local raise in flight defers the restart to its own completion; CONTROL: with none standing the caller restarts at once", () => {
  const gate = promoteActGate();
  const ran: string[] = [];
  expect(gate.after(["kapae-raise"], () => ran.push("idle")), "no raise stands: the caller restarts at once").toBe(false);
  expect(ran).toEqual([]);
  const raise = {};
  gate.begin(raise, "kapae-raise");
  expect(gate.after(["kapae-raise"], () => ran.push("after-raise"))).toBe(true);
  expect(ran, "the restart waits for the raise's reply").toEqual([]);
  gate.end(raise);
  expect(ran).toEqual(["after-raise"]);
});

test("RED (Luna final, MED): an unrelated promote act pending forever never holds an arrival; CONTROL: a commit's own reload does wait for the commit", () => {
  const gate = promoteActGate();
  const stuck = {};
  gate.begin(stuck, "promote-commit");           // never ends in this test
  const ran: string[] = [];
  expect(gate.after(["kapae-raise"], () => ran.push("arrival")), "a remote raise restarts at once").toBe(false);
  expect(gate.after(["promote-commit", "promote-drop", "promote-orphan"], () => ran.push("reload"))).toBe(true);
  expect(ran).toEqual([]);
  gate.end(stuck);
  expect(ran).toEqual(["reload"]);
});

test("RED: a raise whose reply never writes holds only its own deferred run; the run fires once, never for an act that begins later, and a stray end is a no-op", () => {
  const gate = promoteActGate();
  const first = {}, later = {};
  gate.begin(first, "kapae-raise");
  const ran: string[] = [];
  expect(gate.after(["kapae-raise"], () => ran.push("a"))).toBe(true);
  gate.begin(later, "kapae-raise");
  gate.end(first);
  expect(ran, "the deferred run follows the act standing at the request alone").toEqual(["a"]);
  gate.end(later);
  gate.end({});
  gate.end(first);
  expect(ran).toEqual(["a"]);
});

test("RED: a raise whose reply never writes leaves a plain holder restart (the owner door's island.restart) free to force the swap", async () => {
  const { holdDaemonVm } = await import("@lararium/tw5");
  const shut: string[] = [];
  const vm = (id: string) => ({ shutdown: async () => { shut.push(id); return { acked: true }; }, dispose: () => undefined }) as never;
  const held = holdDaemonVm({ vm: vm("old"), reopen: async () => vm("new") });
  const gate = promoteActGate();
  const hung = {};
  gate.begin(hung, "kapae-raise");                // its reply never writes: `end` never fires
  let deferred = false;
  expect(gate.after(["kapae-raise"], () => { deferred = true; })).toBe(true);
  const forced = await held.restart("island.restart");
  expect(forced.restarts).toBe(1);
  expect(shut).toEqual(["old"]);
  expect(deferred, "the hung raise's own deferred run never fired").toBe(false);
});

test("RED (Sol #6): an arrival defers only to a local raise for the SAME (wiki, digest) edge; a stuck raise for another edge never holds it. CONTROL: the same edge defers", async () => {
  const { promoteActEdge } = await import("../src/promote-act-gate.js");
  const A = "a".repeat(64), B = "b".repeat(64);
  expect(promoteActEdge({ digest: A })).toBe(promoteActEdge({ digest: A, wiki: "daemon" }));
  expect(promoteActEdge({ digest: A, wiki: "garden" })).not.toBe(promoteActEdge({ digest: A }));
  expect(promoteActEdge({ digest: "nope" })).toBeUndefined();
  const gate = promoteActGate();
  const stuck = {};
  gate.begin(stuck, "kapae-raise", promoteActEdge({ digest: A }));       // never ends: a raise for edge A
  const ran: string[] = [];
  expect(gate.after(["kapae-raise"], () => ran.push("B"), [promoteActEdge({ digest: B })!]), "a remote raise over B restarts at once").toBe(false);
  expect(gate.after(["kapae-raise"], () => ran.push("A"), [promoteActEdge({ digest: A })!]), "the same edge defers to its own raise").toBe(true);
  expect(gate.after(["kapae-raise"], () => ran.push("legacy")), "no edges given keeps the kind-wide reading").toBe(true);
  gate.end(stuck);
  expect(ran).toEqual(["A", "legacy"]);
});

test("RED (Sol: mixed edges): an arrival carrying a raised edge AND another edge defers only when a local raise stands over EVERY carried edge; CONTROL: all edges covered defers", async () => {
  const { promoteActEdge } = await import("../src/promote-act-gate.js");
  const A = promoteActEdge({ digest: "a".repeat(64) })!, B = promoteActEdge({ digest: "b".repeat(64) })!;
  const gate = promoteActGate();
  const raiseA = {};
  gate.begin(raiseA, "kapae-raise", A);
  const ran: string[] = [];
  expect(gate.after(["kapae-raise"], () => ran.push("mixed"), [A, B]), "B has no local raise: restart now").toBe(false);
  expect(gate.after(["kapae-raise"], () => ran.push("A"), [A])).toBe(true);
  const raiseB = {};
  gate.begin(raiseB, "kapae-raise", B);
  expect(gate.after(["kapae-raise"], () => ran.push("both"), [A, B])).toBe(true);
  gate.end(raiseA);
  expect(ran, "the both-edge run waits for BOTH raises").toEqual(["A"]);
  gate.end(raiseB);
  expect(ran).toEqual(["A", "both"]);
});

// ── the ward binds the daemon realm's promotions (row 7, S2) ─────────────────────────────────────────────────────────────
test("RED: a daemon or kahua ledger row written straight into custody, with no ward signature, voids at boot, and so does a dropped signed row a custody write puts back; CONTROL: a user-wiki row with none stands, and a fresh-unlocked commit lands and runs", async () => {
  const { seatScratchCustody } = await import("./custody-seat-fixture.js");
  const { personaGroupDigest } = await import("../src/persona-group-file.js");
  const { generateOrLoadPersonaGroupRoot, loadPersonaGroupRootVerifyingKey, setMountedFace } = await import("../src/node-vessel-identity.js");
  const { wardCredential } = await import("../src/ward-credential.js");
  const { wardRootSigner } = await import("../src/ward-signer.js");
  const { nodePromoteStores, promotedFile } = await import("../src/promoted-store.js");
  const { updateCustodyRow } = await import("../src/custody-seat.js");
  const { EMPTY_LEDGER, decodeLedger, encodeLedger, ledgerCommit, promoteDigest, promotions, readPromoteBoard, promoteBoardDoor, ed25519SignerFromSeed, ed25519VerifyingKeyFromSeed } = await import("@lararium/mesh");
  const PASS = "promote-ward-route", GROUP = "promote-ward-group";
  const seat = await seatScratchCustody("promote-ward");
  try {
    setMountedFace(undefined);
    await seat.holder.foundFace({ group: personaGroupDigest(GROUP), slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: PASS }] }] });
    await generateOrLoadPersonaGroupRoot(0, wardCredential([{ kind: "passphrase", passphrase: PASS }]));
    const rootKey = (await loadPersonaGroupRootVerifyingKey(0))!;
    const rite = { title: "rites/a", text: "exports.startup = function(){}", fields: { "module-type": "startup" } };
    const digest = promoteDigest(rite);
    const hand = { kind: "hand" as const, id: "hand-1" };
    // A script holding unlocked custody writes the ledger straight, under the face key: no ward act signs these rows.
    let forged = ledgerCommit(EMPTY_LEDGER, { wiki: "daemon", digest, item: rite, revision: "r1" }, hand);
    forged = ledgerCommit(forged, { wiki: "kahua", digest, item: rite, revision: "r1" }, hand);
    forged = ledgerCommit(forged, { wiki: "garden", digest, item: rite, revision: "r1" }, hand);
    await updateCustodyRow("identity", promotedFile(GROUP), () => ({ plaintext: encodeLedger(forged), value: undefined }));
    const cas = new Map<string, Uint8Array>();
    // The face-private board: a bound row a commit replaces lands its drop here, signed by this device's atom (road L23).
    const atom = { key: await ed25519VerifyingKeyFromSeed(new Uint8Array(32).fill(3)), sign: ed25519SignerFromSeed(new Uint8Array(32).fill(3)) };
    const acts: unknown[] = [];
    const face = { group: GROUP, grant: (k: string) => k === rootKey, device: (k: string) => k === atom.key };
    const boardDoor = promoteBoardDoor({ group: GROUP, face, atom, epoch: () => 0, rootSigner: async () => { throw new Error("no lower rides this red"); },
      board: { records: async () => acts, land: async (act) => { acts.push(act); } }, projection: () => ({ planes: {} }), cosign: () => { throw new Error("no co-sign rides this red"); } });
    const doorOf = (wiki: string, extra: object = {}) => promotions({
      wiki, ...nodePromoteStores(GROUP), who: hand, items: async () => [{ ...rite, revision: "r1", origin: { seat: "s", device: "d", session: "x" } }],
      board: async () => readPromoteBoard(acts, { ...face, ward: { accepts: () => true } }), cas: { put: (d, b) => { cas.set(d, b); }, pin: () => {} }, face,
      landDrops: (tombstones) => boardDoor.drop(tombstones), owner: atom.key, ...extra,
    });
    for (const wiki of ["daemon", "kahua"]) {
      const booted = await doorOf(wiki).boot();
      expect(booted.pluginCids, wiki).toEqual([]);
      expect(booted.voided, wiki).toEqual([{ digest, reason: "ward-unsigned" }]);
    }
    expect((await doorOf("garden").boot()).pluginCids).toEqual([digest]);
    // A commit with no ward route refuses; a fresh-unlocked one signs its row and the row runs.
    await expect(doorOf("daemon").promote({ digest })).rejects.toMatchObject({ code: "ward-needs-fresh-unlock" });
    const ward = wardCredential([{ kind: "passphrase", passphrase: PASS }]);
    const row = await doorOf("daemon", { wardSigner: () => wardRootSigner(0, ward) }).promote({ digest });
    expect(row.wardSig?.key).toBe(rootKey);
    expect((await doorOf("daemon").boot()).pluginCids).toEqual([digest]);
    // THE DROP FLOOR on the real custody row (road L23): the hand drops the signed row; a plain custody write strips its tombstone and
    // puts the row back, ward signature and all; the board's drop voids it at boot.
    await doorOf("daemon").unpromote({ digest });
    await updateCustodyRow("identity", promotedFile(GROUP), (bytes) => { const l = decodeLedger(bytes!); return { plaintext: encodeLedger({ seq: l.seq, rows: [...l.rows, row] }), value: undefined }; });
    const replay = await doorOf("daemon").boot();
    expect(replay.pluginCids).toEqual([]);
    expect(replay.voided).toEqual([{ digest, reason: "ward-dropped" }]);
  } finally { setMountedFace(undefined); await seat.drop(); }
});
