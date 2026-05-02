<<~&#x0001; ? -> lar:///ha.ka.ba/@lares/api/v0.1/lararium/widgets/kumu-tw5 >>
```toml iam
uri-path = "ha.ka.ba/@lares/api/v0.1/lararium/widgets/kumu-tw5"
file-path = "packages/lares/api/v0.1/lararium/widgets/kumu-tw5.md"
type          = "application/javascript"
module-type   = "widget"
register      = "CS"
confidence    = 0.90
mana          = 0.90
role          = "compiled TW5 widget module: KumuWidget — generated from packages/lararium-tw5/src/tw5-widgets.ts"
cacheable     = true
retain        = true
source-symbol = "KumuWidget"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
```

<<~&#x0002;>>
(function(){
"use strict";
exports.kumu = function KumuWidget(parseTreeNode, options) { this.initialise(parseTreeNode, options); };
exports.kumu.prototype.render = function(parent, _nextSibling) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  var name    = this.getAttribute("name", "");
  var args    = this.getAttribute("props", "");
  var results = this.wiki?.filterTiddlers?.(
    "[all[tiddlers]tag[$:/tags/LarariumKumu]field:kumu-name[" + name + "]]"
  ) ?? [];
  var defUri = results[0] ?? "";
  var el = this.document.createElement("div");
  el.setAttribute("data-lar-kind",     "kumu");
  el.setAttribute("data-lar-name",     name);
  el.setAttribute("data-lar-resolved", defUri ? "true" : "false");
  parent.appendChild(el);
  this.domNodes = [el];
  if (defUri) {
    var propRe = /([\w-]+):(\S+)/g;
    var m;
    while ((m = propRe.exec(args)) !== null) {
      this.setVariable(m[1], m[2]);
    }
    var transclude = this.wiki?.makeTranscludeWidget(defUri, {
      document:     this.document,
      parentWidget: this,
    });
    if (transclude) {
      transclude.render(el, null);
      this.children = [transclude];
    }
  } else {
    var hole = this.document.createElement("span");
    hole.setAttribute("data-lar-kind", "hole");
    hole.textContent = "? " + name;
    el.appendChild(hole);
  }
};
exports.kumu.prototype.execute = function() { /* children managed in render */ };
exports.kumu.prototype.refresh = function(changedTiddlers) {
  var changed = false;
  for (var i = 0; i < (this.children ?? []).length; i++) {
    if (this.children[i].refresh(changedTiddlers)) changed = true;
  }
  return changed;
};
})();
<<~&#x0003;>>
<<~&#x0004; -> ? >>
