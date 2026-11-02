/**
 * promote-pin — a device mounts the face's promote board from the face's VERIFIED `plane` act alone.
 *
 * The board url derives from the group, and a derived url nobody pinned mounts nothing: only the root-signed pin answers. A catalog row
 * is no input. A pinned face adopts the board doc into the repo; an unpinned face adopts nothing. Every red pairs with a CONTROL.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { describe, expect, test } from "vitest";
import { makeIslandRepo } from "../src/index.js";
import { heldDocOf } from "../src/persona-act-board.js";
import { PROMOTE_PLANE, adoptPromoteBoard, adoptPromotePlane, promoteBoardDocUrl, promotePlaneUrl } from "../src/promote-board.js";

const GROUP = "face-group";
const pinned = { planes: { [PROMOTE_PLANE]: promoteBoardDocUrl(GROUP) } };

describe("the board mounts from the verified pin alone", () => {
  test("RED: the pinned derived url answers; a derived-but-unpinned face, a pin naming another doc and another group's pin answer null; CONTROL: the pin answers for its own group", () => {
    expect(promotePlaneUrl(pinned, GROUP)).toBe(promoteBoardDocUrl(GROUP));
    expect(promotePlaneUrl({ planes: {} }, GROUP)).toBeNull();
    expect(promotePlaneUrl({ planes: { [PROMOTE_PLANE]: "automerge:other" } }, GROUP)).toBeNull();
    expect(promotePlaneUrl(pinned, "other-group")).toBeNull();
  });

  test("RED: adoption mounts the pin and names `promote-unpinned` otherwise; CONTROL: it reads no catalog row", () => {
    expect(adoptPromotePlane(pinned, GROUP)).toEqual({ mount: promoteBoardDocUrl(GROUP) });
    expect(adoptPromotePlane({ planes: {} }, GROUP)).toEqual({ absent: "promote-unpinned" });
    expect(adoptPromotePlane.length).toBe(2);
  });

  test("RED: a pinned face stands the board doc in the repo and answers its url; an unpinned face stands nothing and answers null", async () => {
    const repo = makeIslandRepo({ syncPort: new MessageChannel().port1 });
    expect(await adoptPromoteBoard({ repo, group: GROUP, projection: { planes: {} } })).toBeNull();
    expect(heldDocOf(repo, promoteBoardDocUrl(GROUP))).toBeUndefined();
    expect(await adoptPromoteBoard({ repo, group: GROUP, projection: pinned })).toBe(promoteBoardDocUrl(GROUP));
    expect(heldDocOf(repo, promoteBoardDocUrl(GROUP))).toBeDefined();
  });
});
