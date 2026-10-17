/**
 * The projector's carrier door names an export that throws. Nothing retries a carrier the projector skipped, so a
 * throw that answered no file would leave a bag that never lands with no trace; the door warns by uri. An export
 * that answers `null` is the honest "this uri has no file", and stays quiet.
 */
import { describe, test, expect, vi, afterEach } from "vitest";
import { carrierFileOf, vmCarrierFile } from "../src/island-behaviors.js";

afterEach(() => { vi.restoreAllMocks(); });

describe("the projector's carrier door", () => {
  test("RED: an export that throws answers no file and warns by uri", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const door = carrierFileOf(() => { throw new Error("the view is not loaded"); });
    expect(await door("lar:///ha.ka.ba/bags/lares/photo.png")).toBeNull();
    expect(warn).toHaveBeenCalledWith("[disk-projector] carrier for lar:///ha.ka.ba/bags/lares/photo.png not exported: the view is not loaded");
  });

  test("RED: the door a projector mounts over its VM warns when the VM's export throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // A VM whose every read throws stands in for one whose view of the carrier is not loaded.
    const vm = new Proxy({}, { get: () => { throw new Error("the wiki is not booted"); } });
    const door = vmCarrierFile(vm as Parameters<typeof vmCarrierFile>[0]);
    expect(await door("lar:///ha.ka.ba/bags/lares/photo.png")).toBeNull();
    expect(warn).toHaveBeenCalledWith("[disk-projector] carrier for lar:///ha.ka.ba/bags/lares/photo.png not exported: the wiki is not booted");
  });

  test("CONTROL: an export that answers null warns nothing, and an export that answers a carrier hands it on", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await carrierFileOf(() => null)("lar:///ha.ka.ba/bags/lares/absent")).toBeNull();
    const carrier = { ext: ".tid", body: "title: note\n\nbody", defaultRelPath: "note.tid" };
    expect(await carrierFileOf(() => carrier)("lar:///ha.ka.ba/bags/lares/note")).toBe(carrier);
    expect(warn).not.toHaveBeenCalled();
  });
});
