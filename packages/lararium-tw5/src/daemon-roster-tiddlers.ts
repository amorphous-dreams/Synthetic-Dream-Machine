/**
 * daemon-roster-tiddlers — the SENSORIUM ROSTER daemon surface (E4, the co-use UX).
 *
 * ONE capability rendered two ways (UI ≡ API): every lifecycle button here fires the RESIDENT verb-summon
 * pattern — `$button` → `$action-setfield` on `…/verb/<verb>` carrying `verb`, the `lares-dispatch` marker,
 * and its `arg-*` fields — the SAME verb-summon a CLI `lares sense <verb>` drives through the daemon. A
 * human clicks; an agent writes the same summons; both land on ONE store. No divergent view.
 *
 * THE HAND VERBS RENDER NO BUTTON (hitl-reads-a-hand): the reconcile button renders for everyone, and
 * promote · retire · un-retire · purge render as a note naming the command, since each runs on a person's
 * hand at a real terminal alone and the vessel refuses it from a tab, a seat or a synced summons. A wiki
 * tiddler any writer can set approves nothing.
 *
 * The live roster LIST rides the LOCAL state slot the roster worker-verb pushes (the IN path — deferred
 * with the daemon routed executor, F-C); the surface + its refresh button stand now, painting empty until
 * that push lands. The four seed sites collapse to ONE (seedDaemonProtocol), and this rides beside them.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/daemon-ui-tiddlers · lar:///ha.ka.ba/lararium/api/living-grammar-palace#/phased-plan
 */

import { LARES_DISPATCH_FIELD, LARES_VERB_ARG_PREFIX } from "@lararium/mesh/lar-uris";
import type { TW5Engine } from "./tw5-vm.js";
import { LARES_SURFACE_TAG, LARES_SURFACE_STATE, seedShadows } from "./daemon-ui-tiddlers.js";

/** LOCAL state: the live sensorium roster list (name · lifecycle), pushed by the roster worker-verb. Never
 *  synced — a volatile temp slot, like the switcher's. Empty until the IN-path push lands (deferred). */
export const ROSTER_STATE_TITLE = "$:/temp/lares/sensorium-roster";

const ROSTER_TITLE   = "$:/lares/ui/sensorium-roster";
const ROSTER_PAGECTRL = "$:/lares/ui/PageControls/sensorium-roster";

// The volatile verb-summon namespace (mirrors daemon-ui-tiddlers' VERB_PREFIX / mesh laresVerbUri): a
// button writes `…/verb/<verb>` carrying `verb`, the dispatch MARKER, and per-invocation `arg-<name>`s.
const VERB_PREFIX = "lar:///lararium.local.vm/verb/";

/**
 * The roster surface: a refresh button (summons the `roster` verb), then a per-sensorium row rendered from
 * the live state list. Each row carries its lifecycle, the reconcile button, and a note naming the terminal
 * command for the hand verbs. The row variable `sensName` names the target.
 */
const ROSTER_BODY = `\\whitespace trim
! daemon · Sensorium Roster

<div class="lares-daemon-surface" data-lares-surface="sensorium-roster">

<$button class="lares-roster-refresh" data-lares-roster-refresh="1">
<$action-setfield $tiddler="${VERB_PREFIX}roster" verb="roster" ${LARES_DISPATCH_FIELD}="1"/>
refresh
</$button>

<div class="lares-roster-list">
<$list filter="[list[${ROSTER_STATE_TITLE}]]" variable="sensName" emptyMessage="<p class='lares-empty' data-lares-empty='roster'>No roster yet — press refresh.</p>">
<$let lifecycle={{{ [<sensName>getindex:lifecycle{${ROSTER_STATE_TITLE}}else[?]] }}}>
<div class="lares-roster-row" data-lares-sensorium=<<sensName>>>
<span class="lares-roster-name"><$text text=<<sensName>>/></span> <span class="lares-roster-state" data-lares-lifecycle=<<lifecycle>>><$text text=<<lifecycle>>/></span>

<$button class="lares-life-btn lares-life-reconcile" data-lares-verb="reconcile" data-lares-sensorium=<<sensName>>>
<$action-setfield $tiddler="${VERB_PREFIX}reconcile" verb="reconcile" ${LARES_DISPATCH_FIELD}="1" ${LARES_VERB_ARG_PREFIX}name=<<sensName>>/>
reconcile
</$button>

<span class="lares-life-hand" data-lares-hand="promote retire un-retire purge">promote · retire · un-retire · purge — your own terminal: <code>lares sense &lt;verb&gt; <$text text=<<sensName>>/></code></span>

</div>
</$let>
</$list>
</div>

</div>`;

/** The sidebar button that names the roster surface as the active panel (state toggle, no story-nav —
 *  the headless-Worker `window` caveat, same as the switcher's summon). */
const ROSTER_PAGECTRL_BODY = `\\whitespace trim
<$button class="tc-btn-invisible lares-pagecontrol" data-lares-summon="sensorium-roster" tooltip="Open the sensorium roster">
<$action-setfield $tiddler="${LARES_SURFACE_STATE}" text="${ROSTER_TITLE}"/>
{{$:/core/images/list-bullet}} sensoria
</$button>`;

interface TiddlerSpec { readonly [field: string]: string }

/** The born-from-source roster CODE tiddlers: the roster surface + its sidebar summon button. */
export const DAEMON_ROSTER_TIDDLERS: readonly TiddlerSpec[] = [
  { title: ROSTER_TITLE, type: "text/vnd.tiddlywiki", tags: LARES_SURFACE_TAG, text: ROSTER_BODY, caption: "sensoria" },
  { title: ROSTER_PAGECTRL, type: "text/vnd.tiddlywiki", tags: "$:/tags/PageControls", text: ROSTER_PAGECTRL_BODY },
];

/** Seed the roster surface tiddlers into the live wiki. Idempotent (each call re-lays the shadow plugin). Rides the ONE
 *  cap-gated protocol seed beside the switcher UI (seedDaemonProtocol). Rests unpainted on a headless node. */
export function seedDaemonRosterTiddlers(tw5: TW5Engine): void {
  seedShadows(tw5, "roster", DAEMON_ROSTER_TIDDLERS);
}
