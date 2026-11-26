/**
 * vault-status-names-the-keeper — under a pūlama the not-held line names the keeper's state and never counts tries.
 *
 * A vessel whose custody a pūlama holds presents no route at its own unlock, so no try spends there: the budget rides the keeper
 * and counts only routes presented at its hand door. A keeper gone dark with the host, one that answers no socket, and one that
 * never admitted the vessel's image each read by name, with the one rite that walks all three layers. A vessel holding its own
 * custody still reads its own count, and the line names what spends a try.
 */
import { describe, expect, test } from "vitest";
import { notHeldLine } from "../src/commands/vault.js";

describe("RED the not-held line", () => {
  test("a dark keeper after a host restart: no try count, no spend claimed, the waking named", () => {
    const line = notHeldLine({ op: "custody", unlocked: false, standing: "herm", attemptsLeft: 0, pulama: { session: false, waits: "pulama-locked" } });
    expect(line).not.toMatch(/of 5 unlock tries left/);
    expect(line).not.toMatch(/`lares vault unlock` opens it/);
    expect(line).toMatch(/the pūlama serves it no session \(pulama-locked\)/);
    expect(line).toMatch(/No unlock try was spent here: the try budget rides the pūlama and counts only routes presented at its hand door/);
    expect(line).toMatch(/`lares rite hoala`/);
  });
  test("a keeper that answers no socket, and one that never admitted the image, each read by their own name and next act", () => {
    expect(notHeldLine({ standing: "herm", attemptsLeft: 5, pulama: { session: false, waits: "pulama-unreachable" } })).toMatch(/no pūlama answers its socket, and no unlock try was spent on the silence/);
    const unadmitted = notHeldLine({ standing: "herm", attemptsLeft: 5, pulama: { session: false, waits: "pulama-image-unadmitted" } });
    expect(unadmitted).toMatch(/this vessel's image stands unadmitted/);
    expect(unadmitted).toMatch(/`lares rite hoala` steps the tag back to an admitted image kept here/);
    expect(unadmitted).toMatch(/pulama admit/);
    expect(unadmitted).toMatch(/lares rite kukulu/);
    expect(unadmitted).not.toMatch(/unlock tries left/);
  });
  test("CONTROL a vessel holding its own custody reads its own count, and the line names what spends a try", () => {
    const line = notHeldLine({ standing: "herm", attemptsLeft: 3 });
    expect(line).toMatch(/with 3 of 5 unlock tries left this boot \(each try spent was a route presented at this vessel's own unlock that opened no slot\)/);
    expect(line).toMatch(/`lares vault unlock` opens it/);
  });
});
