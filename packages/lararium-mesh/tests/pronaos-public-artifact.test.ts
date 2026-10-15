import { describe, expect, test } from "vitest";
import {
  deliverPublicArtifact,
  PUBLIC_ARTIFACT_DELIVERY_ABILITY,
  PUBLIC_ARTIFACT_FORBIDDEN_ABILITIES,
  validatePublicArtifactPublication,
  type PublicArtifactPublication,
} from "../src/index.js";
import { sha256HexBytesSync, utf8Bytes } from "../src/crypto.js";

const bytes = utf8Bytes("the one exact public artifact");
const cid = `sha256:${sha256HexBytesSync(bytes)}`;

const publication = (): PublicArtifactPublication => ({
  schema: "lararium-pronaos-public-artifact/v1",
  operator: { id: "house-operator", authentication: "local-operator" },
  artifactCid: cid,
  integrity: cid,
  route: { path: "/", contentType: "text/html; charset=utf-8", cache: "no-store" },
  ability: PUBLIC_ARTIFACT_DELIVERY_ABILITY,
});

describe("Pronaos public artifact publication", () => {
  test("declared route and CID release the exact bytes", () => {
    validatePublicArtifactPublication(publication());
    const delivered = deliverPublicArtifact(
      publication(),
      { path: "/", artifactCid: cid },
      bytes,
    );
    expect(delivered).toMatchObject({ path: "/", artifactCid: cid, contentType: "text/html; charset=utf-8" });
    expect(delivered.bytes).toEqual(bytes);
    expect(delivered.bytes).not.toBe(bytes);
  });

  test("a different CID or route cannot widen the publication", () => {
    expect(() => deliverPublicArtifact(publication(), { path: "/private", artifactCid: cid }, bytes))
      .toThrow(/route is not declared/);
    expect(() => deliverPublicArtifact(publication(), { path: "/", artifactCid: `sha256:${"b".repeat(64)}` }, bytes))
      .toThrow(/CID is not declared/);
  });

  test("altered bytes fail the declared integrity witness", () => {
    const altered = bytes.slice();
    altered[0] = altered[0]! ^ 1;
    expect(() => deliverPublicArtifact(publication(), { path: "/", artifactCid: cid }, altered))
      .toThrow(/fail integrity/);
  });

  test("the alpha publication is local-operator authenticated and refuses widening", () => {
    expect(() => validatePublicArtifactPublication({
      ...publication(),
      operator: { id: "house-operator", authentication: "cross-operator" as "local-operator" },
    })).toThrow(/local-operator/);
    expect(() => validatePublicArtifactPublication({
      ...publication(),
      ability: "arbitrary-cas-read" as typeof PUBLIC_ARTIFACT_DELIVERY_ABILITY,
    })).toThrow(/only public-artifact:deliver/);
    expect(PUBLIC_ARTIFACT_FORBIDDEN_ABILITIES).toEqual([
      "document-read", "document-write", "persona", "admission", "delegate", "arbitrary-cas-read",
    ]);
  });

  test("delivery returns only public bytes and route facts", () => {
    const delivered = deliverPublicArtifact(publication(), { path: "/", artifactCid: cid }, bytes);
    expect(Object.keys(delivered).sort()).toEqual(["artifactCid", "bytes", "contentType", "path"]);
    expect("documentRead" in delivered).toBe(false);
    expect("documentWrite" in delivered).toBe(false);
    expect("admit" in delivered).toBe(false);
    expect("delegate" in delivered).toBe(false);
    expect("resolveCas" in delivered).toBe(false);
  });
});
