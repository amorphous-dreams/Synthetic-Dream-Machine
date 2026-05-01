<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/widgets/ahu-tw5 >>
```toml iam
uri-path      = "ha.ka.ba/api/v0.1/lararium/widgets/ahu-tw5"
file-path     = "lares/ha-ka-ba/api/v0.1/lararium/widgets/ahu-tw5.md"
type          = "application/javascript"
module-type   = "widget"
register      = "CS"
confidence    = 0.90
mana          = 0.90
role          = "compiled TW5 widget module: AhuWidget — generated from packages/lararium-tw5/src/tw5-widgets.ts"
cacheable     = true
retain        = true
source-symbol = "AhuWidget"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
```

<<~&#x0002;>>
(function(){
"use strict";
exports.ahu = function AhuWidget(parseTreeNode, options) { this.initialise(parseTreeNode, options); };
exports.ahu.prototype.render = function(parent, nextSibling) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  var slot        = this.getAttribute("slot", "");
  var renderMode  = this.getVariable?.("lar-render-mode") ?? "";
  if (renderMode === "carrier") {
    var parentUri   = this.getVariable?.("currentTiddler") ?? "";
    var fragmentUri = parentUri + slot;
    var fragFields  = this.wiki?.getTiddler?.(fragmentUri)?.fields;
    var body        = typeof fragFields?.["text"] === "string" ? fragFields["text"] : "";
    var open        = "<<~ ahu " + slot + " >>";
    var close       = "<<~/ahu >>";
    var text        = this.document.createTextNode(open + body + close);
    parent.insertBefore(text, nextSibling);
    this.domNodes = [text];
  } else {
    var el = this.document.createElement("section");
    el.setAttribute("data-lar-kind", "ahu");
    el.setAttribute("data-lar-slot", slot);
    parent.appendChild(el);
    this.domNodes = [el];
    this.renderChildren(el, null);
  }
};
exports.ahu.prototype.execute = function() { this.makeChildWidgets(); };
exports.ahu.prototype.refresh = function(changedTiddlers) {
  var slot      = this.getAttribute("slot", "");
  var parentUri = this.getVariable?.("currentTiddler") ?? "";
  var fragUri   = parentUri + slot;
  if (changedTiddlers[fragUri]) {
    this.refreshSelf();
    return true;
  }
  var changed = false;
  for (var i = 0; i < (this.children ?? []).length; i++) {
    if (this.children[i].refresh(changedTiddlers)) changed = true;
  }
  return changed;
};
})();
<<~&#x0003;>>
<<~&#x0004; -> ? >>
