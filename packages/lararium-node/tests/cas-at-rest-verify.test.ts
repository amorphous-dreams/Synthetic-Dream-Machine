/**
 * cas-at-rest-verify — bytes that fail to recompute to their address never leave a holder.
 *
 * The relay's serve door reads a block off disk and hands it to a peer. A block altered at rest reads as a block
 * this holder lacks: the peer draws the same Mu a miss draws, on the sealed tier and on the cleartext tier.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/the-address
 */
import { describe, test, expect } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DeterministicFederationGate, sha256HexBytesSync, utf8Bytes, hex } from "@lararium/mesh";
import { decideAndServeWantBlock, CAS_BLOCK, CAS_MU } from "../src/cas-wire.js";
import { readCasBlobFromFs, readVerifiedCasBlobFromFs, writeCasEntriesFs } from "../src/node-cas.js";
import { publicCasShore } from "../src/bulb-read-face.js";
import { membershipOf, antigenOf, sealABody } from "./cas-test-setup.js";

const BODY = utf8Bytes("a private body a member carries and a relay serves");
const MEMBER = "member-peer";
const NEXUS_PUBKEY = "ab".repeat(32);

function flipOneByte(path: string): void {
  const before = new Uint8Array(readFileSync(path));
  const after = Uint8Array.from(before);
  after[after.length - 1] = after[after.length - 1]! ^ 1;
  expect(hex(after)).not.toBe(hex(before));                                   // the setup took
  writeFileSync(path, after);
}

describe("a holder serves only bytes that still match their address", () => {
  test("RED: a sealed block altered at rest draws Mu; CONTROL: the untouched block serves", async () => {
    const { registry, cadDir, installed, cleanup } = sealABody(BODY);
    try {
      const deps = { cadDir, seal: registry.seal, membership: membershipOf([MEMBER]), antigen: antigenOf([]), fedGate: new DeterministicFederationGate(NEXUS_PUBKEY) };
      const served = await decideAndServeWantBlock(deps, MEMBER, installed.cid);
      expect(served.kind).toBe(CAS_BLOCK);                                    // CONTROL
      flipOneByte(join(cadDir, installed.cid));
      expect(readCasBlobFromFs(installed.cid, cadDir)).not.toBeNull();        // the altered bytes still sit on disk
      expect(readVerifiedCasBlobFromFs(installed.cid, cadDir)).toBeNull();
      const after = await decideAndServeWantBlock(deps, MEMBER, installed.cid);
      expect(after.kind).toBe(CAS_MU);
    } finally { cleanup(); }
  });

  test("RED: a cleartext blob altered at rest draws Mu at the fleet door; CONTROL: the untouched blob serves", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cas-at-rest-"));
    try {
      const cidDir = join(dir, "cas"), cadDir = join(dir, "cad");
      const bytes = utf8Bytes("a public page, in the clear under its plaintext address");
      const cid = sha256HexBytesSync(bytes);
      writeCasEntriesFs([{ cid, bytes }], cidDir);
      const registry = sealABody(BODY);
      try {
        const deps = { cadDir, cidDir, fleet: async () => true, seal: registry.registry.seal, membership: membershipOf([]), antigen: antigenOf([]), fedGate: new DeterministicFederationGate(NEXUS_PUBKEY) };
        expect((await decideAndServeWantBlock(deps, MEMBER, cid)).kind).toBe(CAS_BLOCK);   // CONTROL
        expect(readVerifiedCasBlobFromFs(cid, cidDir)).toEqual(bytes);
        flipOneByte(join(cidDir, cid));
        expect(readVerifiedCasBlobFromFs(cid, cidDir)).toBeNull();
        expect((await decideAndServeWantBlock(deps, MEMBER, cid)).kind).toBe(CAS_MU);
      } finally { registry.cleanup(); }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("RED: the public shore hands on no blob altered at rest; CONTROL: the untouched blob reads", () => {
    const dir = mkdtempSync(join(tmpdir(), "cas-at-rest-"));
    try {
      const bytes = utf8Bytes("a public page a herm serves to anyone who asks by its address");
      const cid = sha256HexBytesSync(bytes);
      writeCasEntriesFs([{ cid, bytes }], dir);
      const shore = publicCasShore({ casDir: dir, references: () => [], bagTier: () => null });
      expect(shore.read(cid)).toEqual(bytes);                                 // CONTROL
      flipOneByte(join(dir, cid));
      expect(shore.read(cid)).toBeNull();
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("RED: a write-through replaces a file altered at rest; CONTROL: a sound file stays as it stands", () => {
    const dir = mkdtempSync(join(tmpdir(), "cas-at-rest-"));
    try {
      const bytes = utf8Bytes("a blob a holder fetched again after its own disk changed it");
      const cid = sha256HexBytesSync(bytes);
      expect(writeCasEntriesFs([{ cid, bytes }], dir)).toBe(1);
      expect(writeCasEntriesFs([{ cid, bytes }], dir)).toBe(0);              // CONTROL: content-addressed, written once
      flipOneByte(join(dir, cid));
      expect(readVerifiedCasBlobFromFs(cid, dir)).toBeNull();
      expect(writeCasEntriesFs([{ cid, bytes }], dir)).toBe(1);              // the verified bytes take the altered file's place
      expect(readVerifiedCasBlobFromFs(cid, dir)).toEqual(bytes);
      // Bytes that fail the address never replace anything, sound or altered.
      const wrong = utf8Bytes("bytes that hash elsewhere");
      expect(writeCasEntriesFs([{ cid, bytes: wrong }], dir)).toBe(0);
      expect(readVerifiedCasBlobFromFs(cid, dir)).toEqual(bytes);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  test("a verified read answers null for a block this holder lacks", () => {
    const dir = mkdtempSync(join(tmpdir(), "cas-at-rest-"));
    try { expect(readVerifiedCasBlobFromFs("blake3:" + "0".repeat(64), dir)).toBeNull(); }
    finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
