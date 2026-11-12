/**
 * carriage-panel — the page's two hands for a carried file: SHOW one (its text to copy, a file to save, QR codes to
 * hold up to a lens) and TAKE one (a paste, a picked file, a camera read where the device can).
 *
 * Every road here runs out-of-band, from one person's device to the same person's other device: the clipboard, a file,
 * a screen and a lens. No request leaves the page. The fleet-join door's two halves both stand on these hands: the root
 * holder shows an offer and an answer and takes a request; the joining vessel takes an offer and an answer and shows a
 * request.
 *
 * The panels carry FILES ONLY: signed and sealed public records. No passphrase, key or route passes through them.
 */
import { CarriageAssembly, carriageFrames, isCarriageFrame } from "./carriage-frames.js";
import { CAMERA_REFUSAL_WORDS, CameraReadRefused, cameraReadRefusal, qrSvg, readCarriageByCamera, type CameraHost } from "./carriage-qr.js";

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
};

/** Show one carried file in `host`: the text, a copy button, a file to save, and its QR frames one at a time. */
export function showCarriage(host: HTMLElement, file: { readonly text: string; readonly fileName: string; readonly label: string }): void {
  host.replaceChildren();
  host.dataset["larCarriage"] = "shown";
  const text = el("textarea", { readonly: "", rows: "4", spellcheck: "false", "aria-label": file.label, "data-lar-carriage-text": "" });
  text.value = file.text;
  const copy = el("button", { type: "button", "data-lar-carriage-copy": "" }, "copy");
  const said = el("span", { "data-lar-carriage-said": "", role: "status" });
  copy.addEventListener("click", () => {
    text.select();
    const wrote = navigator.clipboard?.writeText ? navigator.clipboard.writeText(file.text) : Promise.reject(new Error("no clipboard"));
    wrote.then(() => { said.textContent = "copied"; }, () => { said.textContent = "selected: copy it by hand"; });
  });
  const save = el("a", { download: file.fileName, "data-lar-carriage-save": "" }, `save ${file.fileName}`);
  save.href = URL.createObjectURL(new Blob([file.text], { type: "application/json" }));

  // THE QR FRAMES, one on screen at a time. A file past the frame bound shows none and says so; its text and file still carry.
  const qr = el("div", { "data-lar-carriage-qr": "" });
  let frames: string[] = [];
  try { frames = carriageFrames(file.text); } catch { qr.textContent = "this file runs too long for QR codes; copy it or save it."; }
  if (frames.length > 0) {
    let at = 0;
    const picture = el("div", { "data-lar-carriage-frame": "" });
    const place = el("span", { "data-lar-carriage-place": "" });
    const paint = (): void => {
      picture.replaceChildren(qrSvg(frames[at]!));
      place.textContent = frames.length === 1 ? "one code carries it" : `code ${at + 1} of ${frames.length}`;
      qr.dataset["larFrame"] = String(at + 1);
    };
    const step = (by: number) => (): void => { at = (at + by + frames.length) % frames.length; paint(); };
    qr.dataset["larFrames"] = String(frames.length);
    qr.append(picture, place);
    if (frames.length > 1) {
      const back = el("button", { type: "button", "data-lar-carriage-back": "" }, "‹");
      const next = el("button", { type: "button", "data-lar-carriage-next": "" }, "›");
      back.addEventListener("click", step(-1));
      next.addEventListener("click", step(1));
      // A tap on the code steps on too, so a person holding two devices needs one thumb.
      picture.addEventListener("click", step(1));
      qr.append(back, next);
    }
    paint();
  }
  host.append(text, copy, save, said, qr);
}

/**
 * Take one carried file into `host`: a paste box, a file picker, and a camera read. `onText` receives the file's whole
 * text from whichever road carried it. A pasted run of frames (one per line) assembles as a camera read does.
 */
export function takeCarriage(host: HTMLElement, opts: {
  readonly label: string;
  readonly onText: (text: string) => void;
  readonly cameraHost?: CameraHost;
}): { stop(): void } {
  host.replaceChildren();
  host.dataset["larCarriage"] = "taking";
  const paste = el("textarea", { rows: "4", spellcheck: "false", autocapitalize: "off", autocorrect: "off", "aria-label": opts.label, "data-lar-carriage-paste": "" });
  const take = el("button", { type: "button", "data-lar-carriage-take": "" }, "read the pasted text");
  const pick = el("input", { type: "file", accept: "application/json,.json,text/plain", "aria-label": `${opts.label} (a file)`, "data-lar-carriage-file": "" });
  const camera = el("button", { type: "button", "data-lar-carriage-camera": "" }, "read by camera");
  const video = el("video", { muted: "", hidden: "", "data-lar-carriage-video": "" });
  const said = el("span", { "data-lar-carriage-said": "", role: "status" });
  let reading: AbortController | null = null;

  const pasted = (raw: string): void => {
    const lines = raw.split(/\s+/).filter((line) => line.length > 0);
    if (lines.length > 0 && lines.every(isCarriageFrame)) {
      const assembly = new CarriageAssembly();
      for (const line of lines) {
        const taking = assembly.take(line);
        if ("done" in taking) { opts.onText(taking.done); return; }
        if ("refusal" in taking) { said.textContent = `✗ ${taking.refusal}: these codes do not join into one file.`; return; }
      }
      const { held, of } = assembly.progress;
      said.textContent = `✗ carriage-partial: ${held} of ${of} codes read; the file needs every one.`;
      return;
    }
    opts.onText(raw);
  };
  take.addEventListener("click", () => pasted(paste.value));
  pick.addEventListener("change", () => {
    const file = pick.files?.[0];
    if (!file) return;
    file.text().then(pasted, () => { said.textContent = "✗ file-unread: that file does not read as text."; });
  });
  camera.addEventListener("click", () => {
    if (reading) { reading.abort(); return; }
    const mine = reading = new AbortController();
    video.hidden = false;
    camera.textContent = "stop the camera";
    readCarriageByCamera({
      video, stop: mine.signal, ...(opts.cameraHost ? { host: opts.cameraHost } : {}),
      onProgress: (held, of) => { said.textContent = `${held} of ${of} codes read`; },
    }).then(
      (text) => { said.textContent = "read"; opts.onText(text); },
      (err: unknown) => { said.textContent = `✗ ${err instanceof CameraReadRefused ? err.message : String((err as Error)?.message ?? err)}`; host.dataset["larCameraRefusal"] = err instanceof CameraReadRefused ? err.refusal : "camera-failed"; },
    ).finally(() => { if (reading === mine) reading = null; video.hidden = true; camera.textContent = "read by camera"; });
  });
  // THE CAPABILITY SAYS ITSELF BEFORE THE TAP: a device that reads no QR code names why beside the button.
  void cameraReadRefusal(opts.cameraHost).then((refusal) => {
    if (!refusal) return;
    camera.dataset["larRefusal"] = refusal;
    camera.title = CAMERA_REFUSAL_WORDS[refusal];
  });
  host.append(paste, take, pick, camera, video, said);
  return { stop: () => reading?.abort() };
}
