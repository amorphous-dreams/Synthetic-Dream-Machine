/**
 * secret-shapes — the one scan the keep's guard and the alert read redaction share.
 *   R1  a token reads redacted whole; an allowed fixture stands; text with no shape returns unchanged.
 *   R2  a private key with a body reads redacted from its header through its END line; a bare header in prose stands.
 */
import { describe, expect, test } from "vitest";
import { redactSecretShapes, secretShapes, SECRET_REDACTED } from "../src/secret-shapes.js";

describe("the secret-shape scan", () => {
  test("RED R1 — a token redacts whole, a fixture stands, plain text passes unchanged", () => {
    const token = "sk-ant-" + "a1B2".repeat(6);
    expect(redactSecretShapes(`key ${token} then AKIAIOSFODNN7EXAMPLE`)).toEqual({ text: `key ${SECRET_REDACTED} then AKIAIOSFODNN7EXAMPLE`, redacted: 1 });
    expect(redactSecretShapes("nothing here")).toEqual({ text: "nothing here", redacted: 0 });
    expect(secretShapes(`key ${token}`)).toEqual([token]);
  });

  test("RED R2 — a key with a body redacts through its END line; a header in prose stands", () => {
    const begin = "-----BEGIN OPENSSH PRIVATE KEY-----", end = "-----END OPENSSH PRIVATE KEY-----";
    const body = Array.from({ length: 4 }, (_, i) => `b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAAB${i}Q`).join("\n");
    expect(redactSecretShapes(`before\n${begin}\n${body}\n${end}\nafter`)).toEqual({ text: `before\n${SECRET_REDACTED}\nafter`, redacted: 1 });
    const prose = `the header ${begin} then prose`;
    expect(redactSecretShapes(prose)).toEqual({ text: prose, redacted: 0 });
  });
});
