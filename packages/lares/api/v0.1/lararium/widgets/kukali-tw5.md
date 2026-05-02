<<~&#x0001; ? -> lar:///ha.ka.ba/@lares/api/v0.1/lararium/widgets/kukali-tw5 >>
```toml iam
uri-path = "ha.ka.ba/@lares/api/v0.1/lararium/widgets/kukali-tw5"
file-path = "packages/lares/api/v0.1/lararium/widgets/kukali-tw5.md"
type          = "application/javascript"
module-type   = "widget"
register      = "CS"
confidence    = 0.90
mana          = 0.90
role          = "compiled TW5 widget module: KukaliWidget — generated from packages/lararium-tw5/src/tw5-widgets.ts"
cacheable     = true
retain        = true
source-symbol = "KukaliWidget"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
```

<<~&#x0002;>>
(function(){
"use strict";
exports.kukali = function KukaliWidget(parseTreeNode, options) { this.initialise(parseTreeNode, options); };
exports.kukali.prototype.render = function(parent, _nextSibling) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  var trigger = this.getAttribute("trigger", "");
  var el = this.document.createElement("span");
  el.setAttribute("data-lar-kind",    "kukali");
  el.setAttribute("data-lar-trigger", trigger);
  parent.appendChild(el);
  this.domNodes = [el];
  var hook = this.wiki?._larKukaliHook;
  var uri  = this.getVariable?.("currentTiddler") ?? "";
  if (hook && uri && trigger) {
    var cancel = hook(uri, trigger);
    if (typeof cancel === "function") el["_larKukaliCancel"] = cancel;
  }
};
exports.kukali.prototype.execute = function() { this.makeChildWidgets(); };
})();
<<~&#x0003;>>
<<~&#x0004; -> ? >>
