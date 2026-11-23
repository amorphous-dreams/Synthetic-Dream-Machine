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

  test("RED R3 — the missed shapes: a fine-grained GitHub token, a PGP private block, an AWS secret key by its name; the strict reading takes fixtures, bare minted hex and a 32-wide key block, and leaves a digest its scheme names", () => {
    const pat = "github_pat_" + "A1b2".repeat(8);
    const pgp = "-----BEGIN PGP PRIVATE KEY BLOCK-----\n\nlQOYBF...\n-----END PGP PRIVATE KEY BLOCK-----";
    const aws = "aws_secret_access_key = " + "wJalrXUtnFEMI/K7MDENG/bPxRfiCY" + "EXAMPLEKEY";
    for (const shape of [pat, pgp, aws]) {
      expect(secretShapes(shape), shape.slice(0, 20)).not.toEqual([]);
      expect(redactSecretShapes(`x ${shape} y`).text, shape.slice(0, 20)).toBe(`x ${SECRET_REDACTED} y`);
    }
    const hex = "cd".repeat(32);
    const strict = { allow: [], mintedHex: true, everyKeyBlock: true } as const;
    expect(redactSecretShapes(`ref ${hex} and sha256:${hex} and AKIAIOSFODNN7EXAMPLE`, strict).text).toBe(`ref ${SECRET_REDACTED} and sha256:${hex} and ${SECRET_REDACTED}`);
    const narrow = `-----BEGIN PRIVATE KEY-----\n${"MIIBVgIBADANBgkqhkiG9w0BAQEFAASCAUAwggE8".slice(0, 32)}\n-----END PRIVATE KEY-----`;
    expect(redactSecretShapes(narrow).redacted, "the keep's body test passes a 32-wide wrap").toBe(0);
    expect(redactSecretShapes(narrow, strict).text).toBe(SECRET_REDACTED);
  });

  test("R4 — a header far from its body reads within the 16 KB window alone", () => {
    const begin = "-----BEGIN OPENSSH PRIVATE KEY-----";
    const line = "b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAAB0Q";
    expect(secretShapes(`${begin}${" ".repeat(20_000)}\n${line}\n${line}`)).toEqual([]);
  });
});
