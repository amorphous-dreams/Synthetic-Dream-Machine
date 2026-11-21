import { expect, test } from "vitest";
import { restoreFaceBody } from "../src/face-bundle-restore.js";

const body = { addressSecret: null };
const withRepo = async () => { throw new Error("reached repo"); };
const reason = async (args: unknown) => restoreFaceBody(args as never).then(() => "proceeded", (e: { reason?: string }) => e.reason ?? "next-check");

test("only the paper door may carry a null address secret", async () => {
  expect(await reason({ body, withRepo })).toBe("no-address-secret");
  expect(await reason({ body, withRepo, fromPaper: true })).toBe("next-check");
  expect(await reason({ body: { addressSecret: "ab".repeat(32) }, withRepo })).toBe("next-check");
});
