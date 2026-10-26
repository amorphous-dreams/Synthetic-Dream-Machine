/** Read-only daemon face intent surface and its volatile, capability-gated state. */
import { LARES_DISPATCH_FIELD } from "@lararium/mesh/lar-uris";
import type { IntentPaneModel } from "@lararium/mesh";
import type { TW5Engine } from "./tw5-vm.js";
import type { VerbReactor } from "./verb-dispatcher.js";
import { LARES_SURFACE_STATE, LARES_SURFACE_TAG, SEED_OFF_DISK } from "./daemon-ui-tiddlers.js";

export const INTENT_VIEW_CAP = "$:/lares/caps/intent-view";
export const INTENT_STATE_TITLE = "$:/temp/lares/face-intents";
export const INTENT_PANE_TITLE = "$:/lares/ui/face-intents";
const PAGECTRL_TITLE = "$:/lares/ui/PageControls/face-intents";
const VERB_TITLE = "lar:///lararium.local.vm/verb/intent-view";

const PANE_BODY = `\\whitespace trim
! daemon · Face intents
<div class="lares-daemon-surface" data-lares-surface="face-intents">
<$list filter="[[${INTENT_VIEW_CAP}]get[text]match[1]]" variable="cap" emptyMessage="<p data-lares-intent-gated='1'>hold the intent-view capability</p>">
<$button data-lares-intent-refresh="1"><$action-setfield $tiddler="${VERB_TITLE}" verb="intent-view" ${LARES_DISPATCH_FIELD}="1"/>refresh</$button>
<$list filter="[list[${INTENT_STATE_TITLE}]]" variable="n" emptyMessage="<p data-lares-intent-empty='1'>No face intents yet — press refresh.</p>">
<$let idField={{{ [[id-]addsuffix<n>] }}} verbField={{{ [[verb-]addsuffix<n>] }}} statusField={{{ [[status-]addsuffix<n>] }}} countField={{{ [[count-]addsuffix<n>] }}} reasonField={{{ [[reason-]addsuffix<n>] }}} winnersField={{{ [[winners-]addsuffix<n>] }}} duplicatesField={{{ [[duplicates-]addsuffix<n>] }}} unknownField={{{ [[unknown-]addsuffix<n>] }}} voidField={{{ [[void-]addsuffix<n>] }}}>
<$let winners={{{ [[${INTENT_STATE_TITLE}]get<winnersField>] }}} duplicates={{{ [[${INTENT_STATE_TITLE}]get<duplicatesField>] }}} unknowns={{{ [[${INTENT_STATE_TITLE}]get<unknownField>] }}} voids={{{ [[${INTENT_STATE_TITLE}]get<voidField>] }}}>
<div class="lares-intent-row" data-lares-intent-row=<<n>>>
<span class="lares-intent-id"><$text text={{{ [[${INTENT_STATE_TITLE}]get<idField>] }}}/></span>
<span class="lares-intent-verb"><$text text={{{ [[${INTENT_STATE_TITLE}]get<verbField>] }}}/></span>
<span class="lares-intent-status"><$text text={{{ [[${INTENT_STATE_TITLE}]get<statusField>] }}}/></span>
<span class="lares-intent-count">outcomes: <$text text={{{ [[${INTENT_STATE_TITLE}]get<countField>] }}}/></span>
<$list filter="[[${INTENT_STATE_TITLE}]get<reasonField>!is[blank]]" variable="reason"><span class="lares-intent-unknown">unknown — <$text text=<<reason>>/></span></$list>
<$list filter="[enlist<winners>]" variable="cid"><div class="lares-intent-winner">winner <$text text=<<cid>>/></div></$list>
<$list filter="[enlist<duplicates>]" variable="cid"><div class="lares-intent-duplicate">duplicate <$text text=<<cid>>/></div></$list>
<$list filter="[enlist<unknowns>]" variable="cid"><div class="lares-intent-unknown-outcome">unknown outcome <$text text=<<cid>>/></div></$list>
<$list filter="[enlist<voids>]" variable="cid"><div class="lares-intent-void-after-act">void-after-act <$text text=<<cid>>/></div></$list>
</div>
</$let>
</$let>
</$list>
<$list filter="[list[${INTENT_STATE_TITLE}!!strays]]" variable="cid"><div class="lares-intent-stray">stray answer <$text text=<<cid>>/></div></$list>
<$list filter="[list[${INTENT_STATE_TITLE}!!refused]]" variable="why"><div class="lares-intent-refused">refused <$text text=<<why>>/></div></$list>
</$list>
</div>`;

const PAGECTRL_BODY = `\\whitespace trim
<$button class="tc-btn-invisible lares-pagecontrol" data-lares-summon="face-intents" tooltip="Open face intents">
<$action-setfield $tiddler="${LARES_SURFACE_STATE}" text="${INTENT_PANE_TITLE}"/>
{{$:/core/images/list-bullet}} intents
</$button>`;

interface TiddlerSpec { readonly [field: string]: string }
export const DAEMON_INTENT_TIDDLERS: readonly TiddlerSpec[] = [
  { title: INTENT_PANE_TITLE, type: "text/vnd.tiddlywiki", tags: LARES_SURFACE_TAG, text: PANE_BODY, caption: "intents" },
  { title: PAGECTRL_TITLE, type: "text/vnd.tiddlywiki", tags: "$:/tags/PageControls", text: PAGECTRL_BODY },
];

export function seedDaemonIntentTiddlers(tw5: TW5Engine): void {
  for (const spec of DAEMON_INTENT_TIDDLERS) tw5.setTiddler({ ...spec, ...SEED_OFF_DISK } as Record<string, string>);
}

/** Only a verifier-approved read fills the local state slot; a denial removes stale data. */
export function makeIntentViewReactor(tw5: TW5Engine, intentBag: string, describe: () => Promise<IntentPaneModel>): VerbReactor {
  return async (_args, context) => {
    const proof = await context.cap("read", intentBag);
    if (!proof.ok) {
      tw5.setTiddler({ title: INTENT_VIEW_CAP, text: "0", ...SEED_OFF_DISK });
      tw5.setTiddler({ title: INTENT_STATE_TITLE, text: "", list: "", strays: "", refused: "" });
      throw new Error("intent-view-no-capability");
    }
    const pane = await describe();
    const fields: Record<string, string> = {
      title: INTENT_STATE_TITLE, list: pane.rows.map((_, n) => String(n)).join(" "),
      strays: pane.strayAnswers.join(" "), refused: pane.refused.join(" "),
    };
    pane.rows.forEach((row, n) => {
      fields[`id-${n}`] = row.id.slice(0, 12);
      fields[`verb-${n}`] = row.verb;
      fields[`status-${n}`] = row.status;
      fields[`count-${n}`] = String(row.outcomeCount);
      fields[`reason-${n}`] = row.unknownReason ?? "";
      fields[`winners-${n}`] = row.unknown ? "" : row.winners.join(" ");
      fields[`duplicates-${n}`] = row.duplicates.join(" ");
      fields[`unknown-${n}`] = row.unknownOutcomes.join(" ");
      fields[`void-${n}`] = row.voidAfterAct.join(" ");
    });
    tw5.setTiddler(fields);
    tw5.setTiddler({ title: INTENT_VIEW_CAP, text: "1", ...SEED_OFF_DISK });
    return { title: INTENT_STATE_TITLE, rows: pane.rows.length };
  };
}
