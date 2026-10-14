// test-custody-route — the PUBLISHED test routes every harness door shares: the passphrase a staged root's custody
// gets founded under (`seed-test-custody.mjs`) and unlocked under (`unlock-test-custody.mjs`), and the second
// passphrase the route door binds a further slot under (`unbind-test-custody.mjs`).
//
// It opens nothing a person keeps. Both doors refuse a root without the `.lar-test-scratch` marker, which only
// `test-scratch-marker.mjs` writes at stage time and which refuses a root already holding custody. So the marker
// plus these passphrases open only trees a harness itself bound to them.
export const TEST_PASSPHRASE = "test-founding-passphrase";
export const TEST_PASSPHRASE_SECOND = "test-second-route-passphrase";
