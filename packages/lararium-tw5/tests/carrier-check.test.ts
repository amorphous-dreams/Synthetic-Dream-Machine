/**
 * THE CARRIER CHECK — what the deserializer used to verify, read from the bytes by its own module.
 *
 * The deserializer is a pure meme→tiddlers function; every verification it once carried reads here,
 * composed by the ingest gate into `memeticIngestOps.deserialize`, so no caller hears a different
 * decision for the move.
 */
import { describe, test, expect } from "vitest";
import { frameCarrier } from "@lararium/memetic-frame";
import { checkCarrier } from "../src/carrier-check.js";

const URI = "lar:///t/check";
const carrier = frameCarrier({ head: { uri: URI }, body: "```toml meta\nuri-path = \"t/check\"\n```\n\nbody" });
const codes = (text: string): string[] => checkCarrier(URI, text).map((d) => `${d.code}:${d.severity}`);

describe("★ checkCarrier(uri, text) ★", () => {
  test("content between ETX and EOT is an error, read from the bytes", () => {
    const stranded = carrier.replace(/(ni:\/\/\/sha-256;[A-Za-z0-9_-]+)\n/, "$1\n<<~ ahu #/edges>>\n\n* a link\n\n<<~/ahu>>\n");
    expect(codes(stranded)).toEqual(["postamble-content:error"]);
    expect(checkCarrier(URI, stranded)[0]!.message).toMatch(/^6 line\(s\) stand between ETX and EOT/);
  });

  test("CONTROL: a canonical carrier carries nothing to check", () => {
    expect(codes(carrier)).toEqual([]);
  });

  test("CONTROL: a frame-less text strands nothing — there is no slot", () => {
    expect(codes("prose\n\n<<^ code=\"&#x0003;\">>\nstray\n<<^ code=\"&#x0004;\" -> to=\"?\">>\n")).toEqual([]);
  });
});
