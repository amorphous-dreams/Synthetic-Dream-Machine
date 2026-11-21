/**
 * formpalace — the FORM store held as a placeholder (operator ruling 2026-10-31, Train Q, row Q6).
 *
 * The harvester burn retired the move-skeleton emitter and the Python form encoder that filled this
 * store. The surface keeps its export shape for the recall fuse and the worldline pre-fetch, and stores
 * nothing: this pin holds the placeholder until the sensorium arc returns the real store.
 */
import { describe, expect, test } from "vitest";

import { makeFormPalace, type FormHolderSpawn } from "../src/sensorium.js";

const SHA_A = "a".repeat(64);

describe("makeFormPalace — a placeholder that stores nothing and answers empty", () => {
  test("encodeStore records nothing, reads answer empty, and no holder process spawns", async () => {
    let spawned = 0;
    const spawn: FormHolderSpawn = () => { spawned += 1; throw new Error("the placeholder must spawn no holder"); };
    const pal = makeFormPalace("/nonexistent/form-palace", { spawn });
    const res = await pal.encodeStore({
      skeleton: { stream: [] }, basis: { axes: [], dimension: 0 }, key: SHA_A, metadata: { verbatim_sha: SHA_A },
    });
    expect(res).toMatchObject({ key: SHA_A, dimension: 0, count: 0, form_vector: { indices: [], values: [] } });
    expect(res.slor.live).toBe(false);
    expect(await pal.query({ skeleton: {}, basis: { axes: [], dimension: 0 }, nResults: 5 })).toEqual([]);
    expect(await pal.filter({ where: { register: "synthesis" }, nResults: 5 })).toEqual([]);
    expect(await pal.get(SHA_A)).toBeNull();
    await pal.close();
    expect(spawned).toBe(0);
  });
});
