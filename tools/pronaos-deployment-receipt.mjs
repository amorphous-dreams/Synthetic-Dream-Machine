#!/usr/bin/env node
/**
 * Validate the operator-held Pronaos deployment receipt shape.
 *
 * The artifact sidecar answers "which finite bytes may be served?". This
 * receipt answers "which operator-owned source/image/run was asked to carry
 * those bytes?". Keeping the questions in separate records prevents a green
 * digest from becoming an invented process or ownership claim.
 *
 * This is a synthetic, daemon-free contract control. It records no clock,
 * opens no socket, inspects no Docker state, and proves no live process.
 */

const SHA256 = /^sha256:[0-9a-f]{64}$/;

function fail(message) {
  throw new Error(`Pronaos deployment receipt refused: ${message}`);
}

function objectAt(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} is not an object`);
  return value;
}

function textAt(value, label) {
  if (typeof value !== "string" || value.length === 0) fail(`${label} is absent`);
  return value;
}

function idAt(value, label) {
  const id = textAt(value, label);
  if (!/^[a-z][a-z0-9._-]*$/.test(id)) fail(`${label} is not a stable local identifier`);
  return id;
}

/**
 * Check only the relationship facts needed to attribute a prepared shore.
 * `artifact` is intentionally a reference: route bytes and their cache/digest
 * facts remain in `.pronaos-build/pronaos-artifact.json`.
 */
export function validatePronaosDeploymentReceipt(input) {
  const receipt = objectAt(input, "receipt");
  if (receipt.schema !== "lararium-pronaos-deployment/v1") fail("schema is unsupported");

  const artifact = objectAt(receipt.artifact, "artifact reference");
  const artifactPath = textAt(artifact.recordPath, "artifact.recordPath");
  const artifactDigest = textAt(artifact.recordSha256, "artifact.recordSha256");
  if (!SHA256.test(artifactDigest)) fail("artifact.recordSha256 is not a sha256 reference");
  if ("routes" in artifact || "bytes" in artifact) fail("artifact reference carries route/byte facts; keep those in the artifact record");

  const owner = objectAt(receipt.owner, "owner");
  const ownerId = idAt(owner.id, "owner.id");
  if (owner.kind !== "operator") fail("owner.kind must be operator");
  textAt(owner.subject, "owner.subject");

  const source = objectAt(receipt.source, "source");
  const sourceId = idAt(source.id, "source.id");
  textAt(source.location, "source.location");
  const sourceRevision = textAt(source.revision, "source.revision");
  if (!SHA256.test(sourceRevision)) fail("source.revision is not a sha256 reference");

  const image = objectAt(receipt.image, "image");
  const imageId = idAt(image.id, "image.id");
  textAt(image.ref, "image.ref");
  const imageDigest = textAt(image.digest, "image.digest");
  if (!SHA256.test(imageDigest)) fail("image.digest is not a sha256 reference");
  if (image.sourceRef !== sourceId) fail("image.sourceRef does not identify the receipt source");

  const run = objectAt(receipt.run, "run");
  const runId = idAt(run.id, "run.id");
  if (run.ownerRef !== ownerId) fail("run.ownerRef does not identify the receipt owner");
  if (run.sourceRef !== sourceId) fail("run.sourceRef does not identify the receipt source");
  if (run.imageRef !== imageId) fail("run.imageRef does not identify the receipt image");
  if (run.artifactRef !== artifactPath) fail("run.artifactRef does not identify the artifact record");
  textAt(run.face, "run.face");

  const ids = new Set([ownerId, sourceId, imageId, runId]);
  if (ids.size !== 4) fail("owner, source, image, and run identifiers must remain independent");

  return {
    schema: receipt.schema,
    artifactRecord: artifactPath,
    owner: ownerId,
    source: sourceId,
    image: imageId,
    run: runId,
  };
}

if (process.argv[1]?.endsWith("pronaos-deployment-receipt.mjs")) {
  let input = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => { input += chunk; });
  process.stdin.on("end", () => {
    try {
      const result = validatePronaosDeploymentReceipt(JSON.parse(input));
      console.log(JSON.stringify(result));
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  });
}
