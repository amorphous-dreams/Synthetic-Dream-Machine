# capability probe

A page a real Android Chrome device opens. It measures, by doing, whether the browser grants what the browser-vessel
design leans on. It never reads the user-agent to decide an answer (the UA string is reported as data).

Groups: **session** (SharedWorker, module SharedWorker, dedicated worker, port chain, BroadcastChannel, Web Locks,
owner epoch), **engine** (WASM in each worker kind, `instantiateStreaming`, real Automerge change/save/load, memory
ladder alone and under load), **persistence** (OPFS and sync-handle contention per context, IndexedDB per context,
`estimate`/`persist`, visit markers, checksummed sentinels, IndexedDB upgrade contention), **custody** (Ed25519,
X25519, AES-GCM, HKDF, non-extractable key in IndexedDB, WebAuthn, passkey PRF), **wire** (WebSocket echo,
`Sec-WebSocket-Protocol` size ladder and grammar, 1 MiB / 16 MiB frames), **page** (custom elements, popover, dialog,
file picker, CompressionStream, transferred `structuredClone`), **lifecycle** (event log and tick counter in the
SharedWorker, nonce check).

## Run

    mkdir -p "${CAPABILITY_PROBE_REPORTS:-/tmp/capability-probe-reports}"
    docker compose -f docker-compose.capability-probe.yml up -d
    docker compose -f docker-compose.capability-probe.yml down

Port: `CAPABILITY_PROBE_PORT` (default **5484**), bound to host loopback. Reports: `CAPABILITY_PROBE_REPORTS` (host
path, default `/tmp/capability-probe-reports`). The Automerge bundle mounts from the workspace install
(`CAPABILITY_PROBE_AUTOMERGE` overrides the directory); with it absent the compose refuses to start.

Control (dockerized Chromium; proves the instrument with known positives):

    docker compose -f docker-compose.capability-probe.yml --profile qa run --rm qa

Use a distinct `CAPABILITY_PROBE_PROJECT`, `CAPABILITY_PROBE_PORT` and `CAPABILITY_PROBE_REPORTS` for it so it shares
nothing with a tester's surface.

## Reach the page from the tablet

1. Connect the tablet by USB; enable developer options and USB debugging.
2. On the host open `chrome://inspect/#devices`, tick "Discover USB devices", then "Port forwarding...".
3. Add the rule `5484` -> `localhost:5484` (same number both sides), tick "Enable port forwarding".
4. On the tablet open Chrome and go to exactly `http://localhost:5484`. `localhost` counts as a secure context.

## Field protocol (exposure labels, never verdicts: ids, event order, counters and checksums decide)

1. Record the device and shell: model, RAM, Android/One UI build, Chrome full version, power-saving state, free space,
   tab or installed app. The report carries origin, `isSecureContext`, display mode, memory, cores, UA data.
2. Open the page in two ordinary Chrome tabs; tap **Run probe** in each. The second report must show
   `connectedPorts: 2` and the same worker instance id.
3. Tap **Lifecycle check**. Switch to the other tab, then Home; leave Chrome alone for five minutes. Return and tap
   **Lifecycle check**. Repeat with the screen locked, then with another app in front. Each tap sends a fresh nonce;
   the previous nonce is classed on the next tap as `replied`, `replied-changed-instance` or `no-reply-before-next-check`.
   `document.wasDiscarded` is reported.
4. Repeat once with a few ordinary apps open. Use synthetic data only; do not fill the device.
5. Tap **Kill owner** in one tab: the SharedWorker closes itself, every tab reconnects, the owner epoch must rise.
   Close tab A while B stays, then close both and reopen: the epoch rises and the sentinels still verify.
6. Open `/?owner=tab` in two tabs for the one-tab fallback: tab A **take lock**; tab B **try lock** (refused by name);
   tab B **wait for lock**, then close tab A: B reports `wait-acquired`.
7. Persistence: Run again after each step; `visit` counters and `persistence.sentinels` show whether either store
   lost data. A granted `persist()` is not a test of user-cleared data.
8. **Passkey PRF probe** creates one throwaway passkey for `localhost`; repeat after a Chrome restart. PRF output is
   never printed; only equality of digests is reported.
9. The WebSocket here is the forwarded local echo. A real proxy's header budget is a separate measurement.
10. Reconcile: reopen and read every sentinel; classify each outcome from event order, ids, epochs and counters.

## Reading a report

Each row is `{id, verdict, detail, evidence}`; verdict is `granted`, `refused` (exception name and message kept),
`error` (the harness saw a mismatch) or `skipped`. Each group ends with `<group>.control-negative`, a call that must
fail on every browser: `held` is healthy, `broken` means the page itself is suspect. A held control row carries
verdict `refused`. The run POSTs an interim report before the memory ladder and a final one after (a tab killed by the
ladder still leaves the first). `kind` is `probe`, `lifecycle`, `owner-death`, `passkey` or `tab-lock`.

Reports land in the report directory as `<n>-<12 hex of sha256(body)>.json`, n = files already present.
No wall-clock time enters a name or a decision; durations are `performance.now()` measurements only.
