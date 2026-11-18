/**
 * place-verb-origin — K19 slice 4, R1: every ask into the daemon carries the origin its SENDER is, and only the
 * vessel's own channel and a person's surface act read as local (house ruling 2026-10-29).
 *
 * RED today: `daemon:place-verb` carries no origin, and `daemon-behavior` adds every placed ask to `localAsks`, so a
 * content-born summon runs as a local ask whose `requestedBy` the content chose.
 */
import { describe, expect, test } from "vitest";
import { mkDaemonPlaceVerb } from "@lararium/mesh";
import { placedAskIsLocal } from "../src/daemon-behavior.js";

describe("R1: the origin of a placed ask decides whether it reads local", () => {
  test("RED: a channel ask and a surface act read local; a content ask and an ask that names no origin read synced", () => {
    expect(typeof placedAskIsLocal, "the daemon decides locality in one named place").toBe("function");
    expect(placedAskIsLocal({ origin: "channel" } as never)).toBe(true);
    expect(placedAskIsLocal({ origin: "surface" } as never)).toBe(true);
    expect(placedAskIsLocal({ origin: "content" } as never)).toBe(false);
    // Fail closed: a message that names no origin, or one no sender is, never borrows the channel.
    expect(placedAskIsLocal({} as never)).toBe(false);
    expect(placedAskIsLocal({ origin: "admin" } as never)).toBe(false);
  });

  test("RED: the place-verb message carries the origin its sender names", () => {
    for (const origin of ["channel", "surface", "content"] as const) {
      expect(mkDaemonPlaceVerb({ verb: "pin", args: {}, requestedBy: "persona", origin } as never)).toMatchObject({ type: "daemon:place-verb", origin });
    }
  });
});
