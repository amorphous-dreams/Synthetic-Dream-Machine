import { describe, expect, it } from "vitest";
import { RecordingDocument, cameraContainer, cameraDocument } from "../src/recording-document.js";
import { toBlocks, toLabelHtml, toText } from "../src/recording-serialisers.js";
import { mountCamera } from "../src/tw5-camera.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";

describe("recording serialisers", () => {
  it("ask-render-label-html-is-qt-subset", () => {
    const doc = new RecordingDocument(); const root = doc.createElement("div");
    const b = doc.createElement("b"); b.setAttribute("onclick", "bad"); b.appendChild(doc.createTextNode("bold"));
    const script = doc.createElement("script"); script.appendChild(doc.createTextNode("plain"));
    const a = doc.createElement("a"); a.setAttribute("href", "Title"); a.setAttribute("target", "_blank"); a.appendChild(doc.createTextNode("link"));
    root.appendChild(b); root.appendChild(script); root.appendChild(a);
    expect(toLabelHtml(root)).toBe('<b>bold</b>plain<a href="Title">link</a>');
    expect(toLabelHtml(doc.createElement("div"))).toBe("");
  });
  it("ask-render-text-keeps-links-as-handles", () => {
    const doc = new RecordingDocument(); const root = doc.createElement("div");
    const a = doc.createElement("a"); a.setAttribute("href", "Title"); a.appendChild(doc.createTextNode("different label"));
    root.appendChild(doc.createTextNode("See ")); root.appendChild(a);
    expect(toText(root)).toEqual({ text: "See [[Title]]", handles: ["Title"] });
    expect(toBlocks(root)).toMatchObject({ kind: "div", children: [{ kind: "text" }, { kind: "a", affordances: [{ kind: "link", target: "Title" }] }] });
  });
  it("missing-camera degrades-visibly", () => {
    expect(toText(null)).toEqual({ missing: "camera" });
    expect(toLabelHtml(null)).toEqual({ missing: "camera" });
    expect(toBlocks(null)).toEqual({ missing: "camera" });
  });
});

describe.skipIf(wikiSkip)(`mountCamera fake-document link-handle control${skipNote}`, () => {
  it("same tiny fixture agrees on link handles", async () => {
    const engine = await bootTestWiki({ tiddlers: [{ title: "Camera link", type: "text/vnd.tiddlywiki", text: "[[Title]]" }] });
    const doc = new RecordingDocument(); const root = doc.createElement("div");
    const stopRecorded = mountCamera(engine, { rootTiddler: "Camera link", document: cameraDocument(doc), container: cameraContainer(root) });
    const fake = engine.$tw.fakeDocument;
    const fakeRoot = fake.createElement("div");
    const stopFake = mountCamera(engine, { rootTiddler: "Camera link", document: fake, container: fakeRoot });
    const recorded = toText(root);
    expect(recorded).toMatchObject({ handles: ["Title"] });
    const fakeHandles = [...fakeRoot.innerHTML.matchAll(/href="(?:#|%23)?([^"]+)"/g)].map(match => decodeURIComponent(match[1] ?? ""));
    expect(fakeHandles).toEqual((recorded as { handles: readonly string[] }).handles);
    stopRecorded(); stopFake();
  });
});
