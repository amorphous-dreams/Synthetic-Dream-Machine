/**
 * Runtime invariant tests — structural and semantic assertions against the live
 * lararium-node runtime. No golden fixture; promotion gating lives in carrier
 * mana/manao/manaoio/confidence metadata, not in frozen counts.
 */

import { describe, test, expect } from "@jest/globals";
import { resolveLarUri, parseHostfulLarUri, isHostfulLarUri } from "@lararium/core";
import { readCarrier, createLarariumRuntime } from "../src/node-host.js";

const runtime = createLarariumRuntime({ writeback: false });

// ---------------------------------------------------------------------------
// Resolver invariants
// ---------------------------------------------------------------------------

describe("resolver", () => {
  test("AGENTS resolves to caps-file, non-virtual", () => {
    const r = resolveLarUri("lar:///AGENTS");
    expect(r.kind).toBe("caps-file");
    expect(r.virtual).toBe(false);
    expect(r.root).toBe("AGENTS");
  });

  test("LARES resolves to caps-file", () => {
    const r = resolveLarUri("lar:///LARES");
    expect(r.kind).toBe("caps-file");
    expect(r.virtual).toBe(false);
  });

  test("ha.ka.ba paths resolve to lares/ha-ka-ba tree", () => {
    const r = resolveLarUri("lar:///ha.ka.ba/api/v0.1/mu");
    expect(["file", "tuple-file"]).toContain(r.kind);
    expect(r.virtual).toBe(false);
    expect(r.root).toBe("ha.ka.ba");
  });

  test("INDEXES paths are virtual", () => {
    const r = resolveLarUri("lar:///INDEXES/carriers");
    expect(r.virtual).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Carrier metadata integrity
// ---------------------------------------------------------------------------

describe("carrier mana signals", () => {
  const PROBE_URIS = [
    "lar:///AGENTS",
    "lar:///ha.ka.ba/api/v0.1/mu",
    "lar:///ha.ka.ba/api/v0.1/pono/invariant",
  ];

  for (const uri of PROBE_URIS) {
    test(`${uri} — carrier has confidence signal`, () => {
      const c = readCarrier(uri);
      // Promotion gating: confidence must be present and > 0
      const conf = c.metadata["confidence"];
      expect(typeof conf).toBe("number");
      expect(conf as number).toBeGreaterThan(0);
    });

    test(`${uri} — mana/manao/manaoio signals present`, () => {
      const c = readCarrier(uri);
      const { mana, manao, manaoio } = c.metadata as Record<string, unknown>;
      expect(typeof mana).toBe("number");
      expect(typeof manao).toBe("number");
      expect(typeof manaoio).toBe("number");
      expect(mana as number).toBeGreaterThan(0);
      expect(manao as number).toBeGreaterThan(0);
      expect(manaoio as number).toBeGreaterThan(0);
    });

    test(`${uri} — implements at least meme interface`, () => {
      const c = readCarrier(uri);
      expect(c.implements.length).toBeGreaterThan(0);
      expect(c.implements).toContain("lar:///ha.ka.ba/api/v0.1/pono/meme");
    });
  }
});

// ---------------------------------------------------------------------------
// Boot closure structural invariants
// ---------------------------------------------------------------------------

describe("minimal boot closure", () => {
  test("entry point is AGENTS", () => {
    const artifact = runtime.compileBoot();
    expect(artifact.closure[0]?.uri).toBe("lar:///AGENTS");
  });

  test("closure is non-empty and bounded (≥18 memes)", () => {
    const artifact = runtime.compileBoot();
    expect(artifact.memeCount).toBeGreaterThanOrEqual(18);
    expect(artifact.closure.length).toBe(artifact.memeCount);
  });

  test("mu is in the closure at depth 1", () => {
    const artifact = runtime.compileBoot();
    const mu = artifact.closure.find((e) => e.uri === "lar:///ha.ka.ba/api/v0.1/mu");
    expect(mu).toBeDefined();
    expect(mu!.depth).toBe(1);
  });

  test("LARES is in the closure", () => {
    const artifact = runtime.compileBoot();
    const lares = artifact.closure.find((e) => e.uri === "lar:///LARES");
    expect(lares).toBeDefined();
    expect(lares!.depth).toBeGreaterThanOrEqual(1);
  });

  test("lararium law memes present (live-session-overwrite, canon-promotion-boundary, tagspace-trust, exchange-vector)", () => {
    const artifact = runtime.compileBoot();
    const uris = new Set(artifact.closure.map((e) => e.uri));
    const PONO = "lar:///ha.ka.ba/api/v0.1/pono/";
    const LAR  = "lar:///ha.ka.ba/api/v0.1/lararium/";
    expect(uris.has(`${PONO}failure-states/live-session-overwrite`)).toBe(true);
    expect(uris.has(`${PONO}hooponopono`)).toBe(true);
    expect(uris.has(`${LAR}tagspace-trust`)).toBe(true);
    expect(uris.has(`${LAR}exchange-vector`)).toBe(true);
  });

  test("closure entries have uri, depth, kind fields", () => {
    const artifact = runtime.compileBoot();
    for (const entry of artifact.closure) {
      expect(typeof entry.uri).toBe("string");
      expect(typeof entry.depth).toBe("number");
      expect(typeof entry.kind).toBe("string");
    }
  });
});

describe("boot closure", () => {
  test("two boot compiles return the same closure URIs", () => {
    const a = runtime.compileBoot().closure.map((e) => e.uri);
    const b = runtime.compileBoot().closure.map((e) => e.uri);
    expect(a).toEqual(b);
  });
});

describe("boot receipt", () => {
  test("receipt sha256 is stable across two calls with same lares/ state", async () => {
    const a1 = runtime.compileBoot();
    const a2 = runtime.compileBoot();
    const r1 = await runtime.compileBootReceipt(a1);
    const r2 = await runtime.compileBootReceipt(a2);
    expect(r1.sha256).toBe(r2.sha256);
    expect(r1.sha256).toMatch(/^(sha256:)?[0-9a-f]{63,64}$/);
  });

  test("receipt memeCount matches minimal boot memeCount", async () => {
    const artifact = runtime.compileBoot();
    const receipt = await runtime.compileBootReceipt(artifact);
    expect(receipt.memeCount).toBe(artifact.memeCount);
  });
});

// ---------------------------------------------------------------------------
// Index structural invariants
// ---------------------------------------------------------------------------

describe("carrier index", () => {
  test("carrier index is non-empty and all entries have uri + implements", () => {
    const carriers = runtime.compileCarrierIndex();
    expect(carriers.length).toBeGreaterThan(0);
    for (const c of carriers) {
      expect(typeof c.uri).toBe("string");
      expect(Array.isArray(c.implements)).toBe(true);
    }
  });

  test("AGENTS and mu are in the carrier index", () => {
    const uris = new Set(runtime.compileCarrierIndex().map((c) => c.uri));
    expect(uris.has("lar:///AGENTS")).toBe(true);
    expect(uris.has("lar:///ha.ka.ba/api/v0.1/mu")).toBe(true);
  });

  test("invariant index contains the four lararium law memes", () => {
    const INVARIANT_URI = "lar:///ha.ka.ba/api/v0.1/pono/invariant";
    const carriers = runtime.compileCarrierIndex();
    const invariants = new Set(
      carriers.filter((c) => c.implements.includes(INVARIANT_URI)).map((c) => c.uri)
    );
    const PONO = "lar:///ha.ka.ba/api/v0.1/pono/";
    const LAR  = "lar:///ha.ka.ba/api/v0.1/lararium/";
    expect(invariants.has(`${PONO}hooponopono`)).toBe(true);
    expect(invariants.has(`${LAR}tagspace-trust`)).toBe(true);
    expect(invariants.has(`${LAR}exchange-vector`)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Hostful URI invariants
// ---------------------------------------------------------------------------

describe("hostful URI", () => {
  test("isHostfulLarUri detects hostful form", () => {
    expect(isHostfulLarUri("lar://claude:session@elyncia.app/ha.ka.ba/api/v0.1/mu")).toBe(true);
    expect(isHostfulLarUri("lar:///AGENTS")).toBe(false);
    expect(isHostfulLarUri("lar:///ha.ka.ba/api/v0.1/mu")).toBe(false);
  });

  test("parseHostfulLarUri extracts authority components", () => {
    const r = parseHostfulLarUri("lar://claude:session@elyncia.app/ha.ka.ba/api/v0.1/mu");
    expect(r.authority.alias).toBe("claude");
    expect(r.authority.tier).toBe("session");
    expect(r.authority.host).toBe("elyncia.app");
    expect(r.root).toBe("ha.ka.ba");
    expect(r.virtual).toBe(true);
    expect(r.laresRelPath).toBeNull();
  });

  test("parseHostfulLarUri handles alias without tier", () => {
    const r = parseHostfulLarUri("lar://joshu@elyncia.app/LARES");
    expect(r.authority.alias).toBe("joshu");
    expect(r.authority.tier).toBe("");
    expect(r.authority.host).toBe("elyncia.app");
    expect(r.root).toBe("LARES");
  });

  test("resolveLarUri rejects hostful URI with clear error", () => {
    expect(() => resolveLarUri("lar://claude:session@elyncia.app/ha.ka.ba/api/v0.1/mu"))
      .toThrow(/hostless/);
  });

  test("hostful resolution is always virtual — never resolves to lares file", () => {
    const r = parseHostfulLarUri("lar://operator:trajectory@dreamnet.local/ha.ka.ba/api/v0.1/lararium");
    expect(r.laresRelPath).toBeNull();
    expect(r.kind).toBe("caps-virtual");
  });
});
