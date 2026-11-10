import { LARES_SURFACE_STATE, LARES_SURFACE_TAG, seedShadows } from "./daemon-ui-tiddlers.js";
import type { TW5Engine } from "./tw5-vm.js";
import type { VerbReactor } from "./verb-dispatcher.js";

export const PROMOTE_PANEL_TITLE = "$:/lares/ui/promote";
export const PROMOTE_STATE_TITLE = "$:/temp/lares/promote/snapshot";

const PANEL = `\u005cwhitespace trim
<$list filter="[[$:/temp/lares/promote/snapshot]!is[tiddler]]" variable="_">no promote state yet</$list>
<$button><$action-setfield $tiddler="lar:///lararium.local.vm/verb/promote-refresh" verb="promote-refresh" lares-dispatch="1"/>refresh</$button>
<$list filter="[[$:/temp/lares/promote/snapshot]is[tiddler]]" variable="_">
<h2>Rites waiting here</h2>
<$list filter="[{${PROMOTE_STATE_TITLE}!!data}jsonindexes[wikis]]" variable="wi">
<$let wiki={{{ [{${PROMOTE_STATE_TITLE}!!data}jsonget[wikis],<wi>,[wiki]] }}} error={{{ [{${PROMOTE_STATE_TITLE}!!data}jsonget[wikis],<wi>,[error]] }}}>
<section data-wiki=<<wiki>>><h3><$text text=<<wiki>>/></h3>
<$list filter="[<error>!is[blank]]" variable="_"><p><$text text=<<error>>/></p></$list>
<$list filter="[{${PROMOTE_STATE_TITLE}!!data}jsonindexes[wikis],<wi>,[waiting]]" variable="ri">
<$let title={{{ [{${PROMOTE_STATE_TITLE}!!data}jsonget[wikis],<wi>,[waiting],<ri>,[title]] }}} digest={{{ [{${PROMOTE_STATE_TITLE}!!data}jsonget[wikis],<wi>,[waiting],<ri>,[digest]] }}} session={{{ [{${PROMOTE_STATE_TITLE}!!data}jsonget[wikis],<wi>,[waiting],<ri>,[origin],[session]] }}}>
<div><$text text=<<title>>/> <$text text={{{ [<digest>substring[0],[12]] }}}/> <$text text=<<session>>/>
<$list filter="[{${PROMOTE_STATE_TITLE}!!data}jsonindexes[wikis],<wi>,[waiting],<ri>,[classes]]" variable="ci"><$text text={{{ [{${PROMOTE_STATE_TITLE}!!data}jsonget[wikis],<wi>,[waiting],<ri>,[classes],<ci>] }}}/> </$list>
<$button data-act="commit" data-digest=<<digest>>><$action-setfield $tiddler="lar:///lararium.local.vm/verb/promote-commit" verb="promote-commit" lares-dispatch="1" arg-wiki=<<wiki>> arg-digest=<<digest>>/>commit</$button></div>
</$let></$list>
<$list filter="[{${PROMOTE_STATE_TITLE}!!data}jsonindexes[wikis],<wi>,[rows]]" variable="ri">
<$let title={{{ [{${PROMOTE_STATE_TITLE}!!data}jsonget[wikis],<wi>,[rows],<ri>,[title]] }}} digest={{{ [{${PROMOTE_STATE_TITLE}!!data}jsonget[wikis],<wi>,[rows],<ri>,[digest]] }}} state={{{ [{${PROMOTE_STATE_TITLE}!!data}jsonget[wikis],<wi>,[rows],<ri>,[state]] }}} shadowed={{{ [{${PROMOTE_STATE_TITLE}!!data}jsonget[wikis],<wi>,[rows],<ri>,[shadowed]] }}}>
<div><$text text=<<title>>/> <$text text={{{ [<digest>substring[0],[12]] }}}/>
<$list filter="[<state>match[standing]]" variable="_">standing</$list>
<$list filter="[<state>match[update-waits]]" variable="_">an update waits; promote again?</$list>
<$list filter="[<state>match[orphaned]]" variable="_">orphaned: its source left the wiki; it keeps running until you decide
<$button data-act="orphan-keep" data-digest=<<digest>>><$action-setfield $tiddler="lar:///lararium.local.vm/verb/promote-keep" verb="promote-keep" lares-dispatch="1" arg-wiki=<<wiki>> arg-digest=<<digest>>/>keep</$button>
<$button data-act="orphan-drop" data-digest=<<digest>>><$action-setfield $tiddler="lar:///lararium.local.vm/verb/promote-orphan-drop" verb="promote-orphan-drop" lares-dispatch="1" arg-wiki=<<wiki>> arg-digest=<<digest>>/>drop orphan</$button></$list>
<$list filter="[<state>match[kept]]" variable="_">kept</$list>
<$button data-act="drop" data-digest=<<digest>>><$action-setfield $tiddler="lar:///lararium.local.vm/verb/promote-drop" verb="promote-drop" lares-dispatch="1" arg-wiki=<<wiki>> arg-digest=<<digest>>/>drop</$button>
<$list filter="[<shadowed>match[true]]" variable="_">set aside across the fleet <$button data-act="lower" data-digest=<<digest>>><$action-setfield $tiddler="lar:///lararium.local.vm/verb/kapae-lower" verb="kapae-lower" lares-dispatch="1" arg-wiki=<<wiki>> arg-digest=<<digest>>/>lower</$button></$list>
<$list filter="[<shadowed>!match[true]]" variable="_"><$button data-act="raise" data-digest=<<digest>>><$action-setfield $tiddler="lar:///lararium.local.vm/verb/kapae-raise" verb="kapae-raise" lares-dispatch="1" arg-wiki=<<wiki>> arg-digest=<<digest>>/>raise</$button></$list>
</div></$let></$list>
<$list filter="[<error>is[blank]]" variable="_"><$list filter="[{${PROMOTE_STATE_TITLE}!!data}jsonindexes[wikis],<wi>,[waiting]] [{${PROMOTE_STATE_TITLE}!!data}jsonindexes[wikis],<wi>,[rows]]" variable="_" emptyMessage="no rites waiting"/></$list>
</section></$let></$list></$list>`;

export function seedPromoteUiTiddlers(tw5: TW5Engine): void {
  seedShadows(tw5, "promote", [
    { title: PROMOTE_PANEL_TITLE, type: "text/vnd.tiddlywiki", tags: LARES_SURFACE_TAG, caption: "promote", text: PANEL },
    { title: "$:/lares/ui/promote/PageControls", type: "text/vnd.tiddlywiki", tags: "$:/tags/PageControls", text: `<$button class="tc-btn-invisible" tooltip="Open promote"><$action-setfield $tiddler="${LARES_SURFACE_STATE}" text="${PROMOTE_PANEL_TITLE}"/>promote</$button>` },
  ]);
}
export function makePromoteStateReactor(tw5: TW5Engine): VerbReactor {
  return async (args) => {
    tw5.setTiddler({ title: PROMOTE_STATE_TITLE, data: typeof args["data"] === "string" ? args["data"] : "" });
    return { seeded: true, title: PROMOTE_STATE_TITLE };
  };
}
