/**
 * local-wait-names-the-read — a local wait that ends with no receipt names the command that reads the request back.
 *
 * "Check request <id>" names an id and no door; the operator has to know `lares vessel request` already. The message
 * carries the verb that was in flight and the whole command, so the next line an operator types sits in the refusal.
 */
import { describe, test, expect } from "vitest";
import { LocalWaitExpired } from "../src/local-connector.js";

describe("LocalWaitExpired names its read-back door", () => {
  test("RED: the message names the verb in flight and `lares vessel request <id>`", () => {
    const e = new LocalWaitExpired("LOAD", 5000, "req-abc");
    expect(e.message).toContain(`"LOAD"`);
    expect(e.message).toContain("`lares vessel request req-abc`");
    expect(e.requestId).toBe("req-abc");
  });
});
