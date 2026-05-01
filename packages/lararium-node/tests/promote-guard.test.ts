/**
 * Promotion route tombstone tests.
 *
 * No localhost-only mutation guard remains here. Future HTTP handling should aim
 * at POST /keyhive/promotions and return a receipt only after Keyhive authority
 * checks pass. Until then this file only documents the removed path.
 */

import { authProviderEntry } from "@lararium/core";

describe("promotion ceremony removal", () => {
  it("keeps auth provider routes separate from promotion", () => {
    expect(authProviderEntry("bluesky-oauth")).toBe("/auth/bluesky/start");
    expect(authProviderEntry("github-vscode")).toBe("/auth/github-vscode/claim");
  });
});
