/**
 * nexus-convergence-secret-store — the vessel's keyring row: every convergence secret it holds, named by
 * (Nexus AID, epoch CID), sealed under the vessel key and read through the custody seat.
 *
 *   S1  the custody's founding seals the row holding no secret: it reads as none held, and no reader moves it.
 *       A ROW THAT GOES MISSING READS AS A LOSS: with the file gone every door refuses `absent`, nothing mints
 *       or joins, and no file comes back.                    control: the founded row takes a mint
 *   S2  THE SEAT'S MINT seals a secret at rest and reads back whole; under a held name it changes nothing and no
 *       byte at rest moves.                                  control: under a second name a second secret lands
 *   S3  NOTHING MINTS OVER A ROW IT COULD NOT READ. A tampered row (one ciphertext byte moved), a truncated row and
 *       a bare row each refuse by name at every door (load, held, mint, install), never read null, and the bytes
 *       at rest never move.                                  control: the intact row reads
 *   S4  a row that opens to another shape refuses `malformed` at every door: a counter-named entry, one name held
 *       twice, a short secret, a non-list. Nothing mints or joins over it.   control: the well-shaped row reads
 *   S5  A DELIVERY JOINS BY SCOPED NAME. The same bytes again change nothing and move no byte at rest; a new name
 *       joins beside the held ones.
 *   S6  DIFFERENT BYTES UNDER A HELD NAME REFUSE THE WHOLE DELIVERY: the conflict gets named, the fresh entry that
 *       rode with it lands nowhere, the held secret stays, and no byte at rest moves.
 *                                                            control: the same delivery less the conflict joins
 *   S7  A DELIVERY FOR NEXUS A LEAVES NEXUS B UNTOUCHED, even where both name the same epoch CID.
 *   S8  a malformed delivery, or one that carries a name twice, refuses before anything lands.
 *   S9  at the floor every door refuses `CustodyLocked` and no file moves.
 *   S10 THE TAMPER PROBE. A secret minted under key A rests sealed. A holder that keeps ANOTHER key sits in the
 *       seat and the store's own mint and join run under it: each reaches the sealed writer, which refuses the
 *       stranger key (`TreeVkRefusal`); the standing bytes never move, and back under A they open to A's secret.
 *                                                            control: under A the same two acts land
 *       The real reader under key B refuses the standing row `key-fails`; it never reads it empty.
 *   S11 A HOLDER THAT KEPT A RETIRED KEY, real from its own door to the sealed writer: after the custody rotates
 *       under another hand, every door of the store refuses `key-fails` under the seated holder and no byte
 *       moves.                                               control: a holder over the new key reads the secret
 *   S12 a case variant of a held name names the SAME secret: different bytes under it conflict, and no second
 *       entry lands.
 *   S13 TWO HOLDERS OVER ONE TREE NEVER LOSE AN ENTRY. A second holder over the same homes (another process's
 *       shape) and the seated one each mint and join at once: every entry lands, whatever order the writes take.
 *                                                            control: each holder then reads the whole set
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { hex, mintVk, openSealedCarrier, readVkCarrier, writeSealedCarrier, TreeVkRefusal, type KeyringEntryWire } from "@lararium/mesh";
import {
  loadNexusKeyring, mintNexusEpochSecret, installDeliveredKeyring, heldNexusKeyringEntries,
  NexusKeyringConflict, NEXUS_KEYRING_FILE,
} from "../src/nexus-convergence-secret-store.js";
import { CustodyLocked, CustodyRowUnavailable, makeCustodyHolder, type CustodyHolder } from "../src/custody-holder.js";
import { FsCustodyIo } from "../src/custody-io.js";
import { encodeNexusKeyringRow } from "../src/nexus-convergence-keyring.js";
import { seatCustody } from "../src/custody-seat.js";
import { vkSlotsPath } from "../src/vault-carriers.js";
import { seatScratchCustody, FIXTURE_PASSPHRASE, type SeatedScratchCustody } from "./custody-seat-fixture.js";
import { rotateCustody } from "../src/custody-session.js";

vi.setConfig({ testTimeout: 120_000 });

const AID_A = "epoch0-" + "a1".repeat(32);
const AID_B = "epoch0-" + "b2".repeat(32);
const GENESIS_A = AID_A;
const ROLLED = "epoch-" + "c3".repeat(32);
const A0 = { nexusAid: AID_A, epochCid: GENESIS_A };
const A1 = { nexusAid: AID_A, epochCid: ROLLED };
const wire = (name: { nexusAid: string; epochCid: string }, fill: string): KeyringEntryWire => ({ ...name, secretHex: fill.repeat(32) });

let c: SeatedScratchCustody;
const rowPath = (): string => join(c.homes.identity, NEXUS_KEYRING_FILE);
const atRest = (): Buffer => readFileSync(rowPath());
const secretOf = async (name: { nexusAid: string; epochCid: string }): Promise<string | undefined> => {
  const s = (await loadNexusKeyring({ nexusAid: name.nexusAid, headEpochCid: name.epochCid }))?.forEpoch(name.epochCid);
  return s ? hex(s) : undefined;
};
/** Every door of the store, each expected to refuse the same way. */
const everyDoor = (): Array<[string, () => Promise<unknown>]> => [
  ["load",    () => loadNexusKeyring({ nexusAid: AID_A, headEpochCid: GENESIS_A })],
  ["held",    () => heldNexusKeyringEntries()],
  ["mint",    () => mintNexusEpochSecret(A1)],
  ["install", () => installDeliveredKeyring([wire(A1, "5e")])],
];

beforeEach(async () => { c = await seatScratchCustody("keyring"); });
afterEach(async () => { await c.drop(); });

describe("the keyring row", () => {
  test("S1 the founded row holds no secret; a row that goes missing reads as a loss", async () => {
    expect(readVkCarrier(atRest())).toBe("sealed");
    const born = atRest();
    expect(await loadNexusKeyring({ nexusAid: AID_A, headEpochCid: GENESIS_A })).toBeNull();
    expect(await heldNexusKeyringEntries()).toEqual([]);
    expect(atRest().equals(born)).toBe(true);
    rmSync(rowPath());
    for (const [door, run] of everyDoor()) {
      await expect(run(), door).rejects.toThrow(CustodyRowUnavailable);
      await expect(run(), door).rejects.toThrow(/\.nexus-convergence-secrets\.json reads absent/);
    }
    expect(existsSync(rowPath())).toBe(false);
    // control: the founded row takes the same mint
    writeFileSync(rowPath(), born);
    expect((await mintNexusEpochSecret(A1)).minted).toBe(true);
  });

  test("S2 the seat's mint seals at rest, reads back, and changes nothing under a held name", async () => {
    expect((await mintNexusEpochSecret(A0)).minted).toBe(true);
    const first = await secretOf(A0);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(readVkCarrier(atRest())).toBe("sealed");
    expect(atRest().includes(Buffer.from(first!))).toBe(false);
    expect(atRest().includes(Buffer.from(AID_A))).toBe(false);
    const standing = atRest();
    expect((await mintNexusEpochSecret({ nexusAid: AID_A.toUpperCase(), epochCid: GENESIS_A.toUpperCase() })).minted).toBe(false);
    expect(atRest().equals(standing)).toBe(true);
    expect(await secretOf(A0)).toBe(first);
    // control: a second name mints a second secret and the first stays
    expect((await mintNexusEpochSecret(A1)).minted).toBe(true);
    expect(atRest().equals(standing)).toBe(false);
    expect(await secretOf(A0)).toBe(first);
    expect(await secretOf(A1)).not.toBe(first);
    const ring = (await loadNexusKeyring({ nexusAid: AID_A, headEpochCid: ROLLED }))!;
    expect(ring.epochCids).toEqual([GENESIS_A, ROLLED]);
    expect(hex(ring.current().secret)).toBe(await secretOf(A1));
  });

  test("S3 nothing mints over a tampered, truncated or bare row", async () => {
    await mintNexusEpochSecret(A0);
    const intact = atRest();
    expect(await secretOf(A0)).toMatch(/^[0-9a-f]{64}$/);   // control

    const tampered = Buffer.from(intact);
    tampered[tampered.length - 5] = tampered[tampered.length - 5]! ^ 0x01;
    expect(tampered.equals(intact)).toBe(false);            // the probe moved a byte of the frame itself
    const truncated = intact.subarray(0, intact.length - 9);
    const bare = Buffer.from(JSON.stringify({ secrets: [{ epoch: 0, secretHex: "ab".repeat(32) }] }));
    for (const [label, bytes, reads] of [
      ["tampered", tampered, /reads (key-fails|torn)/], ["truncated", truncated, /reads (key-fails|torn)/], ["bare", bare, /reads bare/],
    ] as const) {
      writeFileSync(rowPath(), bytes);
      for (const [door, run] of everyDoor()) {
        await expect(run(), `${label} · ${door}`).rejects.toThrow(CustodyRowUnavailable);
        await expect(run(), `${label} · ${door}`).rejects.toThrow(reads);
      }
      expect(atRest().equals(bytes), `${label}: the bytes at rest never moved`).toBe(true);
    }
    writeFileSync(rowPath(), intact);
    expect((await mintNexusEpochSecret(A1)).minted).toBe(true);   // control: the intact row takes the mint
  });

  test("S4 a row that opens to another shape refuses malformed at every door", async () => {
    const shapes: unknown[] = [
      { secrets: [{ epoch: 0, secretHex: "ab".repeat(32) }] },
      { secrets: [wire(A0, "ab"), wire({ nexusAid: AID_A.toUpperCase(), epochCid: GENESIS_A }, "cd")] },
      { secrets: [{ ...A0, secretHex: "ab".repeat(31) }] },
      { secrets: { [GENESIS_A]: "ab".repeat(32) } },
      { secrets: [null] },
      [],
    ];
    for (const shape of shapes) {
      await c.holder.writeRow("identity", NEXUS_KEYRING_FILE, new TextEncoder().encode(JSON.stringify(shape)));
      const standing = atRest();
      for (const [door, run] of everyDoor()) {
        await expect(run(), `${JSON.stringify(shape).slice(0, 40)} · ${door}`).rejects.toThrow(/\.nexus-convergence-secrets\.json reads malformed/);
      }
      expect(atRest().equals(standing)).toBe(true);
    }
    await c.holder.writeRow("identity", NEXUS_KEYRING_FILE, new TextEncoder().encode("not json"));
    await expect(heldNexusKeyringEntries()).rejects.toThrow(/reads malformed/);
    // control: the well-shaped row reads
    await c.holder.writeRow("identity", NEXUS_KEYRING_FILE, new TextEncoder().encode(JSON.stringify({ secrets: [wire(A0, "ab")] })));
    expect(await secretOf(A0)).toBe("ab".repeat(32));
  });
});

describe("a delivery joins by scoped name", () => {
  test("S5 the same bytes again change nothing; a new name joins", async () => {
    expect(await installDeliveredKeyring([wire(A0, "11")])).toEqual({ joined: 1, held: 1 });
    const standing = atRest();
    expect(await installDeliveredKeyring([wire(A0, "11")])).toEqual({ joined: 0, held: 1 });
    expect(await installDeliveredKeyring([{ nexusAid: ` ${AID_A.toUpperCase()} `, epochCid: GENESIS_A, secretHex: "11".repeat(32).toUpperCase() }]))
      .toEqual({ joined: 0, held: 1 });
    expect(atRest().equals(standing)).toBe(true);
    expect(await installDeliveredKeyring([wire(A0, "11"), wire(A1, "22")])).toEqual({ joined: 1, held: 2 });
    expect(await secretOf(A0)).toBe("11".repeat(32));
    expect(await secretOf(A1)).toBe("22".repeat(32));
  });

  test("S6 different bytes under a held name refuse the whole delivery and the held value stays", async () => {
    await installDeliveredKeyring([wire(A0, "11")]);
    const standing = atRest();
    const conflicting = [wire(A1, "22"), wire(A0, "99")];
    await expect(installDeliveredKeyring(conflicting)).rejects.toThrow(NexusKeyringConflict);
    const err = await installDeliveredKeyring(conflicting).catch((e: unknown) => e as NexusKeyringConflict);
    expect(err.conflicts).toEqual([A0]);
    expect(err.message).not.toContain("99".repeat(32));
    expect(err.message).not.toContain("11".repeat(32));
    expect(atRest().equals(standing)).toBe(true);
    expect(await secretOf(A0)).toBe("11".repeat(32));
    expect(await secretOf(A1)).toBeUndefined();              // the fresh entry that rode with the conflict landed nowhere
    // control: the same delivery less the conflict joins
    expect(await installDeliveredKeyring([wire(A1, "22")])).toEqual({ joined: 1, held: 1 });
    expect(await secretOf(A1)).toBe("22".repeat(32));
  });

  test("S7 a delivery for Nexus A leaves Nexus B untouched", async () => {
    const B_ROLLED = { nexusAid: AID_B, epochCid: ROLLED };    // the SAME epoch CID string under another Nexus
    await mintNexusEpochSecret(B_ROLLED);
    const bSecret = await secretOf(B_ROLLED);
    expect(await installDeliveredKeyring([wire(A0, "11"), wire(A1, "22")])).toEqual({ joined: 2, held: 2 });
    expect(await secretOf(B_ROLLED)).toBe(bSecret);
    expect(await secretOf(A1)).toBe("22".repeat(32));
    const ringB = (await loadNexusKeyring({ nexusAid: AID_B, headEpochCid: ROLLED }))!;
    expect(ringB.epochCids).toEqual([ROLLED]);
    expect(ringB.forEpoch(GENESIS_A)).toBeUndefined();
    // a conflict inside A refuses A's delivery and still leaves B as it stood
    await expect(installDeliveredKeyring([wire(A1, "77")])).rejects.toThrow(NexusKeyringConflict);
    expect(await secretOf(B_ROLLED)).toBe(bSecret);
    // control: the same bytes under B's own name DO conflict with B's held secret
    await expect(installDeliveredKeyring([wire(B_ROLLED, "22")])).rejects.toThrow(NexusKeyringConflict);
  });

  test("S8 a malformed delivery, or one name carried twice, refuses before anything lands", async () => {
    const born = atRest();
    expect(() => installDeliveredKeyring([wire(A0, "11"), { ...A1, secretHex: "zz".repeat(32) }])).toThrow(/malformed/);
    expect(() => installDeliveredKeyring([{ epoch: 0, secretHex: "11".repeat(32) } as unknown as KeyringEntryWire])).toThrow(/malformed/);
    expect(() => installDeliveredKeyring([wire(A0, "11"), wire(A0, "11")])).toThrow(/rides twice/);
    expect(() => installDeliveredKeyring([wire(A0, "11"), wire({ nexusAid: AID_A, epochCid: GENESIS_A.toUpperCase() }, "11")])).toThrow(/rides twice/);
    expect(await installDeliveredKeyring([])).toEqual({ joined: 0, held: 0 });   // control: an empty delivery lands nothing
    expect(atRest().equals(born)).toBe(true);
    expect(await heldNexusKeyringEntries()).toEqual([]);
  });
});

describe("the key and the floor", () => {
  test("S9 at the floor every door refuses CustodyLocked and no file moves", async () => {
    await mintNexusEpochSecret(A0);
    const standing = atRest();
    await c.holder.lock();
    for (const [door, run] of everyDoor()) await expect(run(), door).rejects.toThrow(CustodyLocked);
    expect(atRest().equals(standing)).toBe(true);
  });

  test("S10 TAMPER PROBE: under another key the store's own writes refuse and the standing bytes still open under the first", async () => {
    await mintNexusEpochSecret(A0);
    const underA = await secretOf(A0);
    const standing = atRest();

    // Key B: a vessel key the slot tree never committed to. The holder's own door refuses to adopt it, so the
    // stranger sits in the seat as a holder that kept a retired key would: its read answers the empty row that
    // key once opened, and it hands its own key to the one sealed writer.
    const keyB = mintVk();
    const wrote: string[] = [];
    const stranger: CustodyHolder = {
      ...c.holder,
      isUnlocked: () => true,
      readRow: async () => ({ reading: "opens", plaintext: encodeNexusKeyringRow([]) }),
      updateRow: async (home, file, decide) => {
        const next = decide({ reading: "opens", plaintext: encodeNexusKeyringRow([]) });
        if (next.plaintext !== null) {
          wrote.push(`${home}/${file}`);
          await writeSealedCarrier({
            io: c.io, vk: keyB, treePath: vkSlotsPath(c.homes.identity),
            carrier: { name: `${home}/${file}`, path: join(c.homes[home], file), keyClass: "relation" }, plaintext: next.plaintext,
          });
        }
        return next.value;
      },
    };
    seatCustody(stranger);
    await expect(mintNexusEpochSecret(A0)).rejects.toThrow(TreeVkRefusal);
    await expect(installDeliveredKeyring([wire(A0, "66")])).rejects.toThrow(TreeVkRefusal);
    expect(wrote).toEqual([`identity/${NEXUS_KEYRING_FILE}`, `identity/${NEXUS_KEYRING_FILE}`]);   // both acts reached the writer
    expect(atRest().equals(standing)).toBe(true);
    expect(existsSync(`${rowPath()}.vk-sealing`)).toBe(false);

    // The real reader under key B refuses what stands; it never reads it as empty.
    const underB = await openSealedCarrier({ io: c.io, vk: keyB, carrier: { name: `identity/${NEXUS_KEYRING_FILE}`, path: rowPath(), keyClass: "relation" } });
    expect(underB.reading).toBe("key-fails");

    seatCustody(c.holder);
    expect(await secretOf(A0)).toBe(underA);
    // control: under A the same two acts land
    expect((await mintNexusEpochSecret(A1)).minted).toBe(true);
    expect(await installDeliveredKeyring([wire({ nexusAid: AID_B, epochCid: ROLLED }, "66")])).toEqual({ joined: 1, held: 1 });
    expect(atRest().equals(standing)).toBe(false);
  });

  test("S11 a HOLDER THAT KEPT A RETIRED KEY refuses at every door and moves no byte", async () => {
    await mintNexusEpochSecret(A0);
    const underA = await secretOf(A0);
    // The custody rotates under another hand: every carrier re-seals under a fresh key, and the seated holder still
    // holds the key the rotation retired. This holder stands real from its own door to the one sealed writer.
    const rotated = await rotateCustody({ io: c.io, homes: c.homes, oldVk: c.vk, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: FIXTURE_PASSPHRASE }] }] });
    const standing = atRest();
    for (const [door, run] of everyDoor()) {
      await expect(run(), door).rejects.toThrow(CustodyRowUnavailable);
      await expect(run(), door).rejects.toThrow(/reads key-fails/);
    }
    expect(atRest().equals(standing)).toBe(true);
    expect(existsSync(`${rowPath()}.vk-sealing`)).toBe(false);
    // control: a holder over the key the tree now commits to reads the secret the first key sealed
    const fresh = makeCustodyHolder({ io: c.io, homes: c.homes });
    await fresh.adopt(rotated.vk);
    seatCustody(fresh);
    expect(await secretOf(A0)).toBe(underA);
    expect((await mintNexusEpochSecret(A1)).minted).toBe(true);
    await fresh.lock();
    seatCustody(c.holder);
  });

  test("S12 a case variant of a held name names the same secret", async () => {
    await installDeliveredKeyring([wire(A1, "11")]);
    const shouted = { nexusAid: AID_A.toUpperCase(), epochCid: ROLLED.toUpperCase() };
    await expect(installDeliveredKeyring([wire(shouted, "99")])).rejects.toThrow(NexusKeyringConflict);
    expect(await installDeliveredKeyring([wire(shouted, "11")])).toEqual({ joined: 0, held: 1 });
    expect((await heldNexusKeyringEntries()).length).toBe(1);
    const ring = (await loadNexusKeyring({ nexusAid: shouted.nexusAid, headEpochCid: shouted.epochCid }))!;
    expect(hex(ring.current().secret)).toBe("11".repeat(32));
    expect(hex(ring.forEpoch(ROLLED.toUpperCase())!)).toBe("11".repeat(32));
  });

  test("S13 two holders over one tree never lose an entry", async () => {
    // A second holder with its OWN io over the same homes: the shape of another process. Its read-decide-write
    // shares the tree's one custody claim with the seated holder's, so neither writes over a snapshot it read
    // before the other's entry landed.
    const other = makeCustodyHolder({ io: new FsCustodyIo(c.homes), homes: c.homes });
    await other.adopt(c.vk);
    const names = Array.from({ length: 6 }, (_, i) => ({ nexusAid: AID_A, epochCid: `epoch-${String(i).repeat(64)}` }));
    const viaOther = async (name: { nexusAid: string; epochCid: string }, fill: string): Promise<void> => {
      await other.updateRow("identity", NEXUS_KEYRING_FILE, (standing) => {
        if (standing.reading !== "opens") throw new Error(`the row reads ${standing.reading}`);
        const held = (JSON.parse(new TextDecoder().decode(standing.plaintext)) as { secrets: KeyringEntryWire[] }).secrets;
        return { plaintext: new TextEncoder().encode(JSON.stringify({ secrets: [...held, wire(name, fill)] })), value: undefined };
      });
    };
    await Promise.all([
      mintNexusEpochSecret(names[0]!), viaOther(names[1]!, "b1"),
      installDeliveredKeyring([wire(names[2]!, "c2")]), viaOther(names[3]!, "d3"),
      mintNexusEpochSecret(names[4]!), viaOther(names[5]!, "e5"),
    ]);
    const held = (await heldNexusKeyringEntries()).map((e) => e.epochCid).sort();
    expect(held).toEqual(names.map((n) => n.epochCid).sort());
    // control: the other holder reads the same whole set
    const seen = await other.readRow("identity", NEXUS_KEYRING_FILE);
    expect(seen.reading).toBe("opens");
    if (seen.reading === "opens") {
      expect((JSON.parse(new TextDecoder().decode(seen.plaintext)) as { secrets: unknown[] }).secrets.length).toBe(6);
    }
    await other.lock();
  });
});
