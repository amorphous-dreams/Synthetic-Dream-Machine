/**
 * custody-root.test — the custody root is a hot carrier minted at founding, its children derive only under a
 * registered domain, and the weld vectors pin what a later input move may change and what it may not.
 *
 * Two roots stand apart: the FLOOR key (the vessel key, outside the VK) signs and derives every floor act;
 * the CUSTODY root (sealed under the VK) derives what only an unlocked vessel uses. The weld pins both
 * sides with fixed inputs, so a move of the veil's INPUT from the floor key to the custody root changes no
 * derivation byte, and no floor derivation moves at all.
 */
import { describe, test, expect } from "vitest";
import { hkdfSync } from "node:crypto";
import { basename, join } from "node:path";
import * as ed from "@noble/ed25519";
import {
  ALL_DOMAINS, DEVICE_DELEGATION_DOMAIN, deriveDyadVeil, groupSecretOpenerFromSeed,
  bindSlot, commitSlotTree, mintVk, writeSealedCarrier, type VesselKey,
} from "@lararium/mesh";
import {
  CUSTODY_ROOT_BYTES, CustodyRootRefused, custodyDerive, custodyRootCarrier, custodyRootFromBytes, custodyRootPath,
  custodyVeil, isCustodyRoot, mintCustodyRoot, openCustodyRootCarrier, sealCustodyRoot, type CustodyRoot,
} from "../src/custody-root.js";
import { resolveRelayGateSeed } from "../src/carriage-relay.js";
import { carrierTable, vkSlotsPath } from "../src/vault-carriers.js";
import { ScratchCustodyIo, scratchHomes } from "./custody-io-fixture.js";

const hex = (b: Uint8Array): string => Buffer.from(b).toString("hex");
/** Fixed inputs: bytes 0..31 for the custody root, bytes 32..63 for the floor key. */
const FIXED_ROOT  = Uint8Array.from({ length: 32 }, (_, i) => i);
const FIXED_FLOOR = Uint8Array.from({ length: 32 }, (_, i) => 32 + i);
const TAG = "fixture-group";

/** A founded scratch vessel: a slot tree over a fresh VK, committed at the identity home's tree path. */
async function founded(): Promise<{ io: ScratchCustodyIo; vk: VesselKey; identity: string; treePath: string; drop: () => void }> {
  const { homes, drop } = scratchHomes();
  const io = new ScratchCustodyIo(homes);
  const vk = mintVk();
  const treePath = vkSlotsPath(homes.identity);
  await commitSlotTree({ io, path: treePath, expected: null, vk, tree: bindSlot(null, vk, { t: 1, pins: [{ kind: "passphrase", passphrase: "fixture" }] }) });
  return { io, vk, identity: homes.identity, treePath, drop };
}

/** The custody root a sealed custody carrier holding `bytes` opens to — the only road from fixed bytes to a root. */
async function rootHolding(bytes: Uint8Array): Promise<CustodyRoot> {
  const v = await founded();
  try {
    await writeSealedCarrier({ io: v.io, vk: v.vk, treePath: v.treePath, carrier: custodyRootCarrier(v.identity), plaintext: bytes });
    const o = await openCustodyRootCarrier({ io: v.io, vk: v.vk, identityDir: v.identity });
    if (o.reading !== "opens") throw new Error(`the custody carrier reads ${o.reading}`);
    return custodyRootFromBytes(o.opened);
  } finally { v.drop(); }
}

describe("the custody root — a branded 32-byte carrier", { timeout: 30_000 }, () => {
  test("a mint yields 32 fresh bytes, branded; two mints differ", () => {
    const a = mintCustodyRoot();
    const b = mintCustodyRoot();
    expect(a.bytes.length).toBe(CUSTODY_ROOT_BYTES);
    expect(isCustodyRoot(a)).toBe(true);
    expect(hex(a.bytes)).not.toBe(hex(b.bytes));
  });

  test("CONTROL: a minted root seals through the custody carrier and opens back to its bytes, branded", async () => {
    const v = await founded();
    try {
      const minted = mintCustodyRoot();
      await sealCustodyRoot({ io: v.io, vk: v.vk, treePath: v.treePath, root: minted, identityDir: v.identity });
      const o = await openCustodyRootCarrier({ io: v.io, vk: v.vk, identityDir: v.identity });
      expect(o.reading).toBe("opens");
      const back = custodyRootFromBytes((o as { opened: never }).opened);
      expect(isCustodyRoot(back)).toBe(true);
      expect(hex(back.bytes)).toBe(hex(minted.bytes));
    } finally { v.drop(); }
  });

  test("RED (M4) — the load door takes only an opening of the sealed custody carrier: raw bytes and forged openings refuse, named", () => {
    for (const forged of [
      FIXED_ROOT, FIXED_FLOOR, new Uint8Array(31), { bytes: FIXED_FLOOR }, { reading: "opens", plaintext: FIXED_FLOOR },
      Object.freeze({}),
    ]) {
      expect(() => custodyRootFromBytes(forged as never)).toThrow(CustodyRootRefused);
    }
  });

  test("RED (M4) — a VK that did not seal the carrier opens no root, and a carrier of the wrong width brands nothing", async () => {
    const v = await founded();
    try {
      await sealCustodyRoot({ io: v.io, vk: v.vk, treePath: v.treePath, root: mintCustodyRoot(), identityDir: v.identity });
      expect((await openCustodyRootCarrier({ io: v.io, vk: mintVk(), identityDir: v.identity })).reading).toBe("key-fails");
      await writeSealedCarrier({ io: v.io, vk: v.vk, treePath: v.treePath, carrier: custodyRootCarrier(v.identity), plaintext: new Uint8Array(31) });
      await expect(openCustodyRootCarrier({ io: v.io, vk: v.vk, identityDir: v.identity })).rejects.toThrow(CustodyRootRefused);
    } finally { v.drop(); }
  });

  test("RED (M4) — the seal door takes only a root a custody door handed out: the floor key never reaches the carrier", async () => {
    const v = await founded();
    try {
      await expect(sealCustodyRoot({ io: v.io, vk: v.vk, treePath: v.treePath, root: { bytes: FIXED_FLOOR } as never, identityDir: v.identity }))
        .rejects.toThrow(CustodyRootRefused);
      expect(await v.io.read(custodyRootCarrier(v.identity).path)).toBeNull();
    } finally { v.drop(); }
  });

  test("each root holds its own copy: zeroing one root's bytes moves no other root branded from the same opening", async () => {
    const v = await founded();
    try {
      await writeSealedCarrier({ io: v.io, vk: v.vk, treePath: v.treePath, carrier: custodyRootCarrier(v.identity), plaintext: FIXED_ROOT });
      const o = await openCustodyRootCarrier({ io: v.io, vk: v.vk, identityDir: v.identity });
      if (o.reading !== "opens") throw new Error(o.reading);
      const first = custodyRootFromBytes(o.opened);
      const second = custodyRootFromBytes(o.opened);
      const before = hex(custodyDerive(second, DEVICE_DELEGATION_DOMAIN));
      (first.bytes as Uint8Array).fill(0);
      expect(hex(custodyDerive(second, DEVICE_DELEGATION_DOMAIN))).toBe(before);
    } finally { v.drop(); }
  });

  test("the carrier names itself by its home and file: the AAD binds where the bytes rest", () => {
    expect(custodyRootCarrier("/scratch/identity")).toEqual({ name: "identity/custody-root.bin", path: join("/scratch/identity", "custody-root.bin") });
  });

  test("the table's custody-root row spells the carrier through the writer's own path function, hot", () => {
    const row = carrierTable().find((r) => r.row === "custody-root")!;
    expect(row.custody).toBe("hot");
    expect(row.match.test(basename(custodyRootPath()))).toBe(true);
  });
});

describe("custodyDerive — a child derives only from a custody root, only under a registered domain", { timeout: 30_000 }, () => {
  test("RED — the floor key, raw or dressed as a root, refuses by name", () => {
    expect(() => custodyDerive(FIXED_FLOOR as never, DEVICE_DELEGATION_DOMAIN)).toThrow(CustodyRootRefused);
    expect(() => custodyDerive({ bytes: FIXED_FLOOR } as never, DEVICE_DELEGATION_DOMAIN)).toThrow(CustodyRootRefused);
  });

  test("RED — a domain the registry never declared refuses by name", async () => {
    const root = await rootHolding(FIXED_ROOT);
    expect(() => custodyDerive(root, "lar-test/unregistered")).toThrow(CustodyRootRefused);
  });

  test("CONTROL: a custody root derives 32 bytes, stable per domain and apart across domains", async () => {
    const root = await rootHolding(FIXED_ROOT);
    const seen = new Set<string>();
    for (const domain of ALL_DOMAINS) {
      const child = custodyDerive(root, domain);
      expect(child.length).toBe(32);
      expect(hex(custodyDerive(root, domain))).toBe(hex(child));
      seen.add(hex(child));
    }
    expect(seen.size).toBe(ALL_DOMAINS.length);
  });

  test("WELD — the derivation is RFC 5869 HKDF-SHA256 with an empty salt and the domain as info, pinned", async () => {
    const root = await rootHolding(FIXED_ROOT);
    const child = custodyDerive(root, DEVICE_DELEGATION_DOMAIN);
    const construction = new Uint8Array(hkdfSync("sha256", FIXED_ROOT, new Uint8Array(0), DEVICE_DELEGATION_DOMAIN, 32));
    expect(hex(child)).toBe(hex(construction));
    expect(hex(child)).toBe("3b5176603f19c581d5a0cb63e79a0f1ce39dd959660d758aa5378a9f3089cb95");
  });
});

describe("the weld vectors — the veil under frozen dyad-veil, and the floor key's derivations", { timeout: 30_000 }, () => {
  test("WELD — the veil from a fixed custody root equals its pinned vector", async () => {
    const veil = await custodyVeil(await rootHolding(FIXED_ROOT), TAG);
    expect(veil.verifyingKey).toBe("858579048e229bcf22e70e56f82af831d8109e4db1760d7481c9d4891a26afde");
  });

  test("WELD — the veil from a custody root is deriveDyadVeil over the root's bytes: only the INPUT moves", async () => {
    const fromRoot  = await custodyVeil(await rootHolding(FIXED_ROOT), TAG);
    const direct    = await deriveDyadVeil(FIXED_ROOT, TAG);
    expect(fromRoot).toEqual(direct);
  });

  test("WELD — the floor key's derivations stand unchanged", async () => {
    expect(hex(await ed.getPublicKeyAsync(FIXED_FLOOR))).toBe("29acbae141bccaf0b22e1a94d34d0bc7361e526d0bfe12c89794bc9322966dd7");
    expect(hex(resolveRelayGateSeed(FIXED_FLOOR))).toBe("505791b3116befe81caf6109602ba6b1a836af328cd887d4c3a97587181c83fa");
    expect(groupSecretOpenerFromSeed(FIXED_FLOOR).deviceKey).toBe("29acbae141bccaf0b22e1a94d34d0bc7361e526d0bfe12c89794bc9322966dd7");
    expect((await deriveDyadVeil(FIXED_FLOOR, TAG)).verifyingKey).toBe("1073f44806bb9b99be402d4bc4844f989ac14cb7778a72d4fc19c9deea7af413");
  });
});
