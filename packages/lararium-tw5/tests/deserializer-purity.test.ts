/**
 * THE DESERIALIZER IS A PURE MEME→TIDDLERS FUNCTION (the TW5 `tiddlerdeserializer` contract: text in,
 * fields out). It verifies nothing, repairs nothing and stamps no reading onto a record — verification
 * is the frame verdict's and the carrier check's, both composed by the ingest gate.
 */
import { describe, test, expect } from "vitest";
import { frameCarrier } from "@lararium/memetic-frame";
import { memeticWikitextDeserializer } from "../src/deserializer.js";

const URI = "lar:///t/pure";
const recordsOf = (text: string) => memeticWikitextDeserializer(text, { title: URI });

describe("★ the deserializer stamps no reading onto a record ★", () => {
  test("a carrier with an advisory mints no `failure-count` anywhere", () => {
    const text = frameCarrier({ head: { uri: URI }, body: "```toml meta\ntext = \"x\"\n```\n\n<<~ ahu #dangling>>\n" });
    for (const r of recordsOf(text)) expect(r["failure-count"]).toBeUndefined();
  });
});
