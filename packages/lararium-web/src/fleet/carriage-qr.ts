/**
 * carriage-qr — a carried file shown as QR codes on the page, and read back by a camera where the device can.
 *
 * SHOW: every browser draws a QR code (the `qrcode` encoder, an SVG the page paints itself; no canvas, no network).
 * READ: one capability decides it. A camera read needs a secure context, a camera the person grants, and the browser's
 * own barcode reader (`BarcodeDetector` with `qr_code`). A device that lacks one refuses BY NAME and says which, and the
 * person carries the file by paste or by file instead. No scanner engine ships in the page.
 *
 * No server takes part: the frames pass from one screen to one lens.
 */
import QRCode from "qrcode";
import { CarriageAssembly, isCarriageFrame } from "./carriage-frames.js";

const SVG = "http://www.w3.org/2000/svg";

/** One frame as an SVG QR code. `quiet` names the light margin in modules. */
export function qrSvg(text: string, quiet = 4): SVGSVGElement {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const size = qr.modules.size, data = qr.modules.data;
  let path = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!data[y * size + x]) continue;
      let run = 1;
      while (x + run < size && data[y * size + x + run]) run++;
      path += `M${x + quiet} ${y + quiet}h${run}v1h-${run}z`;
      x += run - 1;
    }
  }
  const whole = size + quiet * 2;
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", `0 0 ${whole} ${whole}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.dataset["larQrModules"] = String(size);
  const ground = document.createElementNS(SVG, "rect");
  ground.setAttribute("width", String(whole)); ground.setAttribute("height", String(whole)); ground.setAttribute("fill", "#fff");
  const dark = document.createElementNS(SVG, "path");
  dark.setAttribute("d", path); dark.setAttribute("fill", "#000");
  svg.append(ground, dark);
  return svg;
}

/** Why this device reads no QR code by camera, by name; null where it can. */
export type CameraReadRefusal = "camera-insecure-context" | "camera-absent" | "qr-reader-absent";

export const CAMERA_REFUSAL_WORDS: Readonly<Record<CameraReadRefusal, string>> = {
  "camera-insecure-context": "this page stands outside a secure context, so the browser grants it no camera; paste the text or pick the file",
  "camera-absent": "this browser offers the page no camera; paste the text or pick the file",
  "qr-reader-absent": "this browser carries no QR reader of its own; paste the text or pick the file",
};

interface Detector { detect(source: CanvasImageSource): Promise<readonly { readonly rawValue: string }[]> }
interface DetectorClass { new (init: { formats: string[] }): Detector; getSupportedFormats?(): Promise<readonly string[]> }
/** The host a camera read asks: the window's own facts, handed in so a test names them. */
export interface CameraHost {
  readonly isSecureContext: boolean;
  readonly mediaDevices?: Pick<MediaDevices, "getUserMedia"> | undefined;
  readonly BarcodeDetector?: DetectorClass | undefined;
}
export const ambientCameraHost = (): CameraHost => ({
  isSecureContext: globalThis.isSecureContext === true,
  mediaDevices: globalThis.navigator?.mediaDevices,
  BarcodeDetector: (globalThis as { BarcodeDetector?: DetectorClass }).BarcodeDetector,
});

/** The capability read, in the order a person can cure it. */
export async function cameraReadRefusal(host: CameraHost = ambientCameraHost()): Promise<CameraReadRefusal | null> {
  if (!host.isSecureContext) return "camera-insecure-context";
  if (!host.mediaDevices || typeof host.mediaDevices.getUserMedia !== "function") return "camera-absent";
  if (!host.BarcodeDetector) return "qr-reader-absent";
  const formats = await host.BarcodeDetector.getSupportedFormats?.().catch(() => [] as readonly string[]);
  return formats && !formats.includes("qr_code") ? "qr-reader-absent" : null;
}

/** A camera read refused by name. */
export class CameraReadRefused extends Error {
  constructor(readonly refusal: CameraReadRefusal | "camera-denied" | "camera-stopped") {
    super(`${refusal}: ${refusal in CAMERA_REFUSAL_WORDS ? CAMERA_REFUSAL_WORDS[refusal as CameraReadRefusal] : refusal === "camera-denied" ? "the camera was not granted; paste the text or pick the file" : "the camera read stopped before the file stood whole"}`);
    this.name = "CameraReadRefused";
  }
}

/**
 * Read one carried file by camera: frames in any order, until the assembly stands whole. A QR code that carries a
 * whole file by itself (one that fits no frame's shape) answers as it reads. Each look rides the video's own frame
 * (`requestVideoFrameCallback`, else the page's paint), so nothing here keeps a clock. `stop` ends the read by name.
 */
export async function readCarriageByCamera(opts: {
  readonly video: HTMLVideoElement;
  readonly stop: AbortSignal;
  readonly onProgress?: (held: number, of: number) => void;
  readonly host?: CameraHost;
}): Promise<string> {
  const host = opts.host ?? ambientCameraHost();
  const refusal = await cameraReadRefusal(host);
  if (refusal) throw new CameraReadRefused(refusal);
  let stream: MediaStream;
  try { stream = await host.mediaDevices!.getUserMedia({ video: { facingMode: "environment" }, audio: false }); }
  catch { throw new CameraReadRefused("camera-denied"); }
  const detector = new host.BarcodeDetector!({ formats: ["qr_code"] });
  const assembly = new CarriageAssembly();
  const video = opts.video;
  video.srcObject = stream;
  video.setAttribute("playsinline", "");
  try {
    await video.play();
    return await new Promise<string>((resolve, reject) => {
      const nextLook = (look: () => void): void => {
        const perFrame = (video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }).requestVideoFrameCallback;
        if (typeof perFrame === "function") perFrame.call(video, look); else requestAnimationFrame(look);
      };
      const look = (): void => {
        if (opts.stop.aborted) { reject(new CameraReadRefused("camera-stopped")); return; }
        detector.detect(video).then((codes) => {
          for (const code of codes) {
            if (!isCarriageFrame(code.rawValue)) { if (code.rawValue.trim().startsWith("{")) { resolve(code.rawValue); return; } continue; }
            const taking = assembly.take(code.rawValue);
            if ("done" in taking) { resolve(taking.done); return; }
            if ("held" in taking) opts.onProgress?.(taking.held, taking.of);
          }
          nextLook(look);
        }, () => nextLook(look));
      };
      nextLook(look);
    });
  } finally {
    for (const track of stream.getTracks()) track.stop();
    video.srcObject = null;
  }
}
