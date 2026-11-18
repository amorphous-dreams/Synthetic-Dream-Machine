import { expect, test } from "vitest";
import { bootGenesisWiki, genesisSkip } from "./genesis-boot.harness.js";
test.skipIf(genesisSkip)("mirror browser mode CONTROL: worker island platform flags", async () => {
 const engine = await bootGenesisWiki({ path: "browser-worker" });
 try { expect(engine.$tw.browser).toBeNull(); expect(engine.$tw.node).toBeNull(); } finally { engine.dispose(); }
}, 120_000);
