/** held-text — the TS host gives back what a carrier holds, and nothing from a text that holds none. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { held, heldType, heldBytes } from "./held-text.mjs";


const TEXT = "<<^ &#x0001; ? -> lar:///x/y>>\n<<~ ahu #a>>\nbody with ```three``` and ॐ\n<<~/ahu>>\n";
const holder = (fence) =>
  `<<~ ahu #/held>>\n\`\`\`toml meta\ntype = "text/x-memetic-wikitext"\n\`\`\`\n\n${fence}\n${TEXT}${fence}\n\n<<~/ahu>>\n`;

test("a held text comes back byte for byte, and names its type", () => {
  assert.equal(held(holder("````")), TEXT);
  assert.equal(heldType(holder("````")), "text/x-memetic-wikitext");
});

test("a kupono holder (the ahu names its slot=) reads back, as the py writer now writes it", () => {
  const kupono = holder("````").replace("<<~ ahu #/held>>", "<<~ ahu slot=`#/held`>>");
  assert.equal(held(kupono), TEXT);
  assert.equal(heldType(kupono), "text/x-memetic-wikitext");
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
