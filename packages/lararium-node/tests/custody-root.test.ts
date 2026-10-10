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
import { basename } from "node:path";
import * as ed from "@noble/ed25519";
import {
  ALL_DOMAINS, DEVICE_DELEGATION_DOMAIN, deriveDyadVeil, groupSecretOpenerFromSeed,
} from "@lararium/mesh";
import {
  CUSTODY_ROOT_BYTES, CustodyRootRefused, custodyDerive, custodyRootFromBytes, custodyRootPath, custodyVeil,
  isCustodyRoot, mintCustodyRoot,
} from "../src/custody-root.js";
import { resolveRelayGateSeed } from "../src/carriage-relay.js";
import { carrierTable } from "../src/vault-carriers.js";

const hex = (b: Uint8Array): string => Buffer.from(b).toString("hex");
/** Fixed inputs: bytes 0..31 for the custody root, bytes 32..63 for the floor key. */
const FIXED_ROOT  = Uint8Array.from({ length: 32 }, (_, i) => i);
const FIXED_FLOOR = Uint8Array.from({ length: 32 }, (_, i) => 32 + i);
const TAG = "fixture-group";

describe("the custody root — a branded 32-byte carrier", () => {
  test("a mint yields 32 fresh bytes, branded; two mints differ", () => {
    const a = mintCustodyRoot();
    const b = mintCustodyRoot();
    expect(a.bytes.length).toBe(CUSTODY_ROOT_BYTES);
    expect(isCustodyRoot(a)).toBe(true);
    expect(hex(a.bytes)).not.toBe(hex(b.bytes));
  });

  test("the load door brands opened bytes and refuses any other length, named", () => {
    expect(isCustodyRoot(custodyRootFromBytes(FIXED_ROOT))).toBe(true);
    expect(() => custodyRootFromBytes(new Uint8Array(31))).toThrow(CustodyRootRefused);
  });

  test("the root holds its own copy: a caller zeroing its buffer moves no derivation", () => {
    const buf = Uint8Array.from(FIXED_ROOT);
    const root = custodyRootFromBytes(buf);
    const before = hex(custodyDerive(root, DEVICE_DELEGATION_DOMAIN));
    buf.fill(0);
    expect(hex(custodyDerive(root, DEVICE_DELEGATION_DOMAIN))).toBe(before);
  });

  test("the table's custody-root row spells the carrier through the writer's own path function, hot", () => {
    const row = carrierTable().find((r) => r.row === "custody-root")!;
    expect(row.custody).toBe("hot");
    expect(row.match.test(basename(custodyRootPath()))).toBe(true);
  });
});

describe("custodyDerive — a child derives only from a custody root, only under a registered domain", () => {
  test("RED — the floor key, raw or dressed as a root, refuses by name", () => {
    expect(() => custodyDerive(FIXED_FLOOR as never, DEVICE_DELEGATION_DOMAIN)).toThrow(CustodyRootRefused);
    expect(() => custodyDerive({ bytes: FIXED_FLOOR } as never, DEVICE_DELEGATION_DOMAIN)).toThrow(CustodyRootRefused);
  });

  test("RED — a domain the registry never declared refuses by name", () => {
    const root = custodyRootFromBytes(FIXED_ROOT);
    expect(() => custodyDerive(root, "lar-test/unregistered")).toThrow(CustodyRootRefused);
  });

  test("CONTROL: a custody root derives 32 bytes, stable per domain and apart across domains", () => {
    const root = custodyRootFromBytes(FIXED_ROOT);
    const seen = new Set<string>();
    for (const domain of ALL_DOMAINS) {
      const child = custodyDerive(root, domain);
      expect(child.length).toBe(32);
      expect(hex(custodyDerive(root, domain))).toBe(hex(child));
      seen.add(hex(child));
    }
    expect(seen.size).toBe(ALL_DOMAINS.length);
  });

  test("WELD — the derivation is RFC 5869 HKDF-SHA256 with an empty salt and the domain as info, pinned", () => {
    const root = custodyRootFromBytes(FIXED_ROOT);
    const child = custodyDerive(root, DEVICE_DELEGATION_DOMAIN);
    const construction = new Uint8Array(hkdfSync("sha256", FIXED_ROOT, new Uint8Array(0), DEVICE_DELEGATION_DOMAIN, 32));
    expect(hex(child)).toBe(hex(construction));
    expect(hex(child)).toBe("3b5176603f19c581d5a0cb63e79a0f1ce39dd959660d758aa5378a9f3089cb95");
  });
});

describe("the weld vectors — the veil under frozen dyad-veil, and the floor key's derivations", () => {
  test("WELD — the veil from a fixed custody root equals its pinned vector", async () => {
    const veil = await custodyVeil(custodyRootFromBytes(FIXED_ROOT), TAG);
    expect(veil.verifyingKey).toBe("858579048e229bcf22e70e56f82af831d8109e4db1760d7481c9d4891a26afde");
  });

  test("WELD — a custody root holding the floor key's bytes derives the floor key's veil: only the INPUT moves", async () => {
    const fromRoot  = await custodyVeil(custodyRootFromBytes(FIXED_FLOOR), TAG);
    const fromFloor = await deriveDyadVeil(FIXED_FLOOR, TAG);
    expect(fromRoot).toEqual(fromFloor);
  });

  test("WELD — the floor key's derivations stand unchanged", async () => {
    expect(hex(await ed.getPublicKeyAsync(FIXED_FLOOR))).toBe("29acbae141bccaf0b22e1a94d34d0bc7361e526d0bfe12c89794bc9322966dd7");
    expect(hex(resolveRelayGateSeed(FIXED_FLOOR))).toBe("505791b3116befe81caf6109602ba6b1a836af328cd887d4c3a97587181c83fa");
    expect(groupSecretOpenerFromSeed(FIXED_FLOOR).deviceKey).toBe("29acbae141bccaf0b22e1a94d34d0bc7361e526d0bfe12c89794bc9322966dd7");
    expect((await deriveDyadVeil(FIXED_FLOOR, TAG)).verifyingKey).toBe("1073f44806bb9b99be402d4bc4844f989ac14cb7778a72d4fc19c9deea7af413");
  });
});
