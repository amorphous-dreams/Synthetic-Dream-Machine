/**
 * THE FOLD GATE WEIGHS A DOCUMENT BY WHAT ITS REPLAY WOULD COST, AND LEARNS THAT COST FROM EACH FOLD THAT LANDS.
 *
 *   G1  the weight: the changes the incremental records carry (no engine) times the clear stored bytes.
 *   G2  a sealed or torn record passes the whole document through, never folded.
 *   G3  cold, the gate folds the canon document's weight and holds a light one.
 *   G4  the servo: costly folds lower the threshold (a lossless gate shrinks under load), cheap ones raise it; the cold
 *       cost governs until enough folds land; a sample inside the deadband holds; the cost stays clamped.
 */
import { describe, expect, test } from "vitest";
import * as A from "@automerge/automerge";
import {
  foldsAt, foldWeightOf, governingCost, PONO_FOLD_GATE, sealedAddressOf, SEALED_VALUE_POINTER, teachFold, type FoldGate, type StoredRecord,
} from "../src/index.js";

function history(changes: number): StoredRecord[] {
  let doc = A.from<{ t: Record<string, string> }>({ t: {} });
  const snapshot = A.save(doc);
  const heads = A.getHeads(doc);
  for (let i = 0; i < changes; i++) doc = A.change(doc, (d) => { d.t[`k${i % 3}`] = `value ${i}`; });
  return [{ kind: "snapshot", data: snapshot }, { kind: "incremental", data: A.saveSince(doc, heads) }];
}

describe("the weight", () => {
  test("G1 counts the changes past the snapshot and every clear byte", () => {
    const records = history(7);
    const weighing = foldWeightOf(records);
    expect(weighing).toEqual({ weight: { changes: 7, bytes: records[0]!.data.length + records[1]!.data.length } });
  });

  test("G2 a sealed record or a torn one passes the document through", () => {
    const pointer = new TextEncoder().encode(SEALED_VALUE_POINTER + sealedAddressOf(new Uint8Array(64).fill(7)));
    expect(foldWeightOf([...history(3), { kind: "incremental", data: pointer }])).toEqual({ passes: "sealed" });
    const [snapshot, tail] = history(3);
    expect(foldWeightOf([snapshot!, { kind: "incremental", data: tail!.data.slice(0, tail!.data.length - 5) }])).toEqual({ passes: "torn" });
    expect(foldWeightOf([])).toEqual({ passes: "empty" });
  });
});

describe("the gate", () => {
  const canon = { changes: 430, bytes: 4_500_576 };
  const light = { changes: 10, bytes: 100_000 };

  test("G3 cold, the canon document folds and a light one loads as it rests", () => {
    expect(foldsAt(PONO_FOLD_GATE, canon)).toBe(true);
    expect(foldsAt(PONO_FOLD_GATE, light)).toBe(false);
    expect(foldsAt(PONO_FOLD_GATE, { changes: 0, bytes: 4_500_576_000 })).toBe(false);
  });

  test("G4 costly folds shrink the threshold, cheap ones grow it, the cold cost governs until enough land", () => {
    const middling = { changes: 200, bytes: 100_000 };
    expect(foldsAt(PONO_FOLD_GATE, middling)).toBe(false);
    const teach = (gate: FoldGate, perByteChange: number, times: number): FoldGate => {
      let g = gate;
      for (let i = 0; i < times; i++) g = teachFold(g, canon, perByteChange * canon.changes * canon.bytes);
      return g;
    };
    const twice = teach(PONO_FOLD_GATE, 40, 2);
    expect(governingCost(twice)).toBe(PONO_FOLD_GATE.coldCost);
    expect(foldsAt(twice, middling)).toBe(false);
    const costly = teach(PONO_FOLD_GATE, 40, 3);
    expect(governingCost(costly)).toBeGreaterThan(PONO_FOLD_GATE.coldCost);
    expect(foldsAt(costly, middling)).toBe(true);
    const cheap = teach(PONO_FOLD_GATE, 0.3, 3);
    expect(foldsAt(cheap, { changes: 430, bytes: 300_000 })).toBe(false);
    expect(foldsAt(PONO_FOLD_GATE, { changes: 430, bytes: 300_000 })).toBe(true);
  });

  test("G4 a sample inside the deadband holds the cost; every cost stays clamped", () => {
    const one = teachFold(PONO_FOLD_GATE, canon, 2 * canon.changes * canon.bytes);
    const near = teachFold(one, canon, 2.2 * canon.changes * canon.bytes);
    expect(near.cost).toBe(one.cost);
    expect(near.samples).toBe(2);
    const wild = teachFold(PONO_FOLD_GATE, canon, 1e30);
    expect(wild.cost).toBe(PONO_FOLD_GATE.ceil);
    const none = teachFold(PONO_FOLD_GATE, { changes: 0, bytes: 10 }, 1e9);
    expect(none).toEqual(PONO_FOLD_GATE);
  });
});
