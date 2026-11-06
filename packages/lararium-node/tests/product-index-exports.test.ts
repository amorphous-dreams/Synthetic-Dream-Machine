/**
 * product-index-exports — the product entries export no fixture seam (row 7, S3b; seat-harness#/the-swarm-slices).
 *
 * The node index hands no `seatFaceAutoFounder` (a test seam that seats a face's custody policy) and the mesh index no
 * `WARD_GATE_DECIDED` (a witness that accepts every ward act): a reader takes its witness only from the vessel's port. The census
 * reads the modules' own export keys, never their text. CONTROL: each index exports a product door beside them.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness#/the-swarm-slices
 */
import { expect, test } from "vitest";

test("WITNESS: the node index exports no `seatFaceAutoFounder` and the mesh index no `WARD_GATE_DECIDED`; CONTROL: each exports its product doors", async () => {
  const node = Object.keys(await import("../src/index.js"));
  const mesh = Object.keys(await import("../../lararium-mesh/src/index.js"));
  expect(node).not.toContain("seatFaceAutoFounder");
  expect(mesh).not.toContain("WARD_GATE_DECIDED");
  // the nonsense control: the census reads keys the indexes do export
  expect(node.length).toBeGreaterThan(10);
  expect(mesh).toContain("cosignPortWitness");
  expect(mesh).toContain("WARD_WITNESS_CLOSED");
});
