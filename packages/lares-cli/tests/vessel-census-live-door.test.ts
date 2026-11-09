/**
 * The live census asks the custody door of THIS process's own vessel: it omits the root (the ambient answer),
 * never passes `null`, which the socket derivation reads as "a root was looked for and not found" and refuses.
 * (Seen live, 2026-11-09: `down` on the operator's container refused with "a substrate root was required".)
 */
import { test, expect, vi } from "vitest";

vi.mock("../src/custody-door.js", () => ({ sendCustodyFrame: vi.fn(async () => ({ op: "census", held: [], standing: "hearth" })) }));
vi.mock("../src/local-connector.js", () => ({ udsSocketPresent: () => true }));
vi.mock("../src/shore-core.js", () => ({ askShoreCensus: async () => ({ carriers: [], unanswered: [] }) }));
vi.mock("../src/env.js", () => ({ vesselDid: async () => "did:test" }));

test("the live census line asks its own vessel's custody door (no root argument, never null)", async () => {
  const { sendCustodyFrame } = await import("../src/custody-door.js");
  const { readCensus } = await import("../src/commands/census.js");
  await readCensus();
  const call = vi.mocked(sendCustodyFrame).mock.calls[0];
  expect(call?.[0]).toEqual({ op: "census" });
  expect(call?.[1]).toBeUndefined();
});
