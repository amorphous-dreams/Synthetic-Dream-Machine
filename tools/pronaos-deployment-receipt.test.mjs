import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePronaosDeploymentReceipt } from "./pronaos-deployment-receipt.mjs";

const artifactRecord = {
  schema: "lararium-pronaos-artifact/v1",
  routes: [{ path: "/", file: "index.html", sha256: "artifact-route-digest" }],
};

const receipt = {
  schema: "lararium-pronaos-deployment/v1",
  // Only the record's location and digest cross this boundary. Route bytes
  // remain in the artifact record, even though this fixture holds both values.
  artifact: {
    recordPath: ".pronaos-build/pronaos-artifact.json",
    recordSha256: "sha256:" + "a".repeat(64),
  },
  owner: { id: "operator-house", kind: "operator", subject: "synthetic-house" },
  source: {
    id: "source-worktree",
    location: "workspace://synthetic-lararium",
    revision: "sha256:" + "b".repeat(64),
  },
  image: {
    id: "image-pronaos",
    ref: "oci://synthetic/pronaos",
    digest: "sha256:" + "c".repeat(64),
    sourceRef: "source-worktree",
  },
  run: {
    id: "run-pronaos",
    face: "Pronaos",
    ownerRef: "operator-house",
    sourceRef: "source-worktree",
    imageRef: "image-pronaos",
    artifactRef: ".pronaos-build/pronaos-artifact.json",
  },
};

test("keeps finite artifact inventory separate from owner/source/image/run attribution", () => {
  const result = validatePronaosDeploymentReceipt(receipt);
  assert.deepEqual(result, {
    schema: "lararium-pronaos-deployment/v1",
    artifactRecord: ".pronaos-build/pronaos-artifact.json",
    owner: "operator-house",
    source: "source-worktree",
    image: "image-pronaos",
    run: "run-pronaos",
  });
  assert.equal(artifactRecord.routes[0].file, "index.html");
  assert.equal(receipt.artifact.routes, undefined);
});

test("refuses a deployment whose run points at a different image", () => {
  const weakened = structuredClone(receipt);
  weakened.run.imageRef = "image-other";
  assert.throws(() => validatePronaosDeploymentReceipt(weakened), /run\.imageRef/);
});

test("refuses a deployment that smuggles route bytes into the process receipt", () => {
  const weakened = structuredClone(receipt);
  weakened.artifact.routes = artifactRecord.routes;
  assert.throws(() => validatePronaosDeploymentReceipt(weakened), /route\/byte facts/);
});

test("refuses an owner/source/image/run identifier collision", () => {
  const weakened = structuredClone(receipt);
  weakened.run.id = weakened.owner.id;
  assert.throws(() => validatePronaosDeploymentReceipt(weakened), /identifiers must remain independent/);
});
