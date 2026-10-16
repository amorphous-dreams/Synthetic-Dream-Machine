/**
 * The browser's oracle read names the Nexus OF THE HEARTH IT READS. The page holds one hearth's Nexus (its relay's, off the
 * admit's pin); a read at that hearth asks that Nexus's floor pin, and a read at any other hearth names no Nexus at all
 * (`nexus-absent`) rather than borrow the relay's.
 */
import { describe, expect, test } from "vitest";
import { oracleNexusFor } from "../src/browser-gate-pins.js";

describe("oracleNexusFor", () => {
  test("RED: the relay's hearth reads under the relay's Nexus", () => {
    expect(oracleNexusFor("http://node:8080", { relayUrl: "ws://node:8080/ws", nexus: "abcd" })).toBe("abcd");
  });
  test("RED: another hearth borrows nothing", () => {
    expect(oracleNexusFor("http://elsewhere:8080", { relayUrl: "ws://node:8080/ws", nexus: "abcd" })).toBeNull();
    expect(oracleNexusFor("http://node:9090", { relayUrl: "ws://node:8080/ws", nexus: "abcd" })).toBeNull();
  });
  test("RED: no relay, or no Nexus, names none", () => {
    expect(oracleNexusFor("http://node:8080", { relayUrl: undefined, nexus: "abcd" })).toBeNull();
    expect(oracleNexusFor("http://node:8080", { relayUrl: "ws://node:8080/ws", nexus: null })).toBeNull();
  });
});
