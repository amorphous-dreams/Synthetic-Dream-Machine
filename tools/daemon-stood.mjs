// daemon-stood — when a staged daemon is ready for a verb. The daemon says it once on its console, after the UDS verb
// channel attaches (`[lararium]` or `[herm] uds verb-channel on <socket> (perms 0600)`). `phase → live` prints earlier,
// while the composition stands and the channel still has work ahead, so a door driven at "live" can meet a deaf socket.
// Every harness that stands a daemon asks this one reader, so the event stays named in one place.
const CHANNEL_STANDS = /uds verb-channel on /;

/** Whether the daemon console `log` carries the line that names the verb channel serving. */
export function daemonStood(log) {
  return CHANNEL_STANDS.test(log);
}
