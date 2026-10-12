// test-custody-route — the PUBLISHED test route every harness door shares: the passphrase a staged root's custody
// gets founded under (`seed-test-custody.mjs`) and unlocked under (`unlock-test-custody.mjs`).
//
// It opens nothing a person keeps. Both doors refuse a root without the `.lar-test-scratch` marker, which only
// `test-scratch-marker.mjs` writes at stage time and which refuses a root already holding custody. So the marker
// plus this passphrase open only trees a harness itself bound to it.
export const TEST_PASSPHRASE = "test-founding-passphrase";
