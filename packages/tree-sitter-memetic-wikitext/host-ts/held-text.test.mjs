/** held-text — the TS host gives back what a carrier holds, and nothing from a text that holds none. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { held, heldType, heldBytes } from "./held-text.mjs";

const SPECIMEN_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "specimens");

const TEXT = "<<^ &#x0001; ? -> lar:///x/y>>\n<<~ ahu #a>>\nbody with ```three``` and ॐ\n<<~/ahu>>\n";
const holder = (fence) =>
  `<<~ ahu #/held>>\n\`\`\`toml meta\ntype = "text/x-memetic-wikitext"\n\`\`\`\n\n${fence}\n${TEXT}${fence}\n\n<<~/ahu>>\n`;

test("a held text comes back byte for byte, and names its type", () => {
  assert.equal(held(holder("````")), TEXT);
  assert.equal(heldType(holder("````")), "text/x-memetic-wikitext");
});

test("a shorter run inside the text never closes the fence", () => {
  assert.equal(held(holder("`````")), TEXT);
});

test("CONTROL: a text holding nothing reads as itself", () => {
  assert.equal(held(TEXT), TEXT);
  assert.equal(heldType(TEXT), null);
  const bytes = new TextEncoder().encode(TEXT);
  assert.equal(heldBytes(bytes), bytes);
});

test("every wild specimen holds a pre-ruling meme opening on its own SOH", async () => {
  const wild = (await readdir(SPECIMEN_DIR)).filter((f) => f.startsWith("wild-"));
  assert.ok(wild.length > 0);
  for (const name of wild) {
    const carrier = await readFile(path.join(SPECIMEN_DIR, name), "utf8");
    assert.equal(heldType(carrier), "text/x-memetic-wikitext", name);
    assert.ok(held(carrier).startsWith("<<^ &#x0001; ? -> lar:///"), name);
  }
});
