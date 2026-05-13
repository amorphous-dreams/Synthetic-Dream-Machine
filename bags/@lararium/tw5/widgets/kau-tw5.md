<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/widgets/kau-tw5 >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/widgets/kau-tw5"
file-path = "bags/@lararium/tw5/widgets/kau-tw5.md"
type          = "application/javascript"
module-type   = "widget"
register      = "CS"
confidence    = 0.90
mana          = 0.90
role          = "compiled TW5 widget module: KauWidget — generated from packages/lararium-tw5/src/widgets/kau.ts"
cacheable     = true
retain        = true
source-symbol = "KauWidget"
source-file   = "packages/lararium-tw5/src/widgets/kau.ts"
```

<<~&#x0002;>>

Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/widgets/render-modes.ts
/**
* Dispatch text-output render modes for a child-slot sigil widget.
* Returns the raw text string to emit, or null if HTML mode should proceed.
*/
function dispatchSlotRenderMode(mode, ctx) {
	const { sigil, slot, childUri, wiki } = ctx;
	if (mode === "carrier") return {
		kind: "text",
		raw: `<<~ ${sigil} ${slot} >>\n${wiki.getTiddlerText?.(childUri, "") ?? ""}\n<<~/${sigil} >>`
	};
	if (mode === "projection") return {
		kind: "text",
		raw: `<<~ aka ${sigil} ${slot} >>`
	};
	return null;
}
//#endregion
//#region src/widgets/kau.ts
var _kauCapabilityHook = null;
function registerKauCapabilityHook(hook) {
	_kauCapabilityHook = hook;
}
var _kauWriteBackHook = null;
function registerKauWriteBackHook(hook) {
	_kauWriteBackHook = hook;
}
function KauWidget(parseTreeNode, options) {
	this.initialise(parseTreeNode, options);
}
KauWidget.prototype.render = function(parent, _nextSibling) {
	this.parentDomNode = parent;
	this.computeAttributes();
	this.execute();
	const fragment = this.getAttribute("fragment", "");
	const name = this.getAttribute("name", "");
	const args = this.getAttribute("args", "");
	const propsRaw = this.getAttribute("propsRaw", "");
	const carrierUri = this.getVariable?.("currentTiddler") ?? "";
	const renderMode = this.getVariable?.("lar-render-mode") ?? "";
	const childUri = fragment ? carrierUri ? `${carrierUri}#${fragment}` : `#${fragment}` : "";
	if (fragment && renderMode) {
		const modeResult = dispatchSlotRenderMode(renderMode, {
			sigil: "kau",
			slot: `#${fragment}`,
			childUri,
			wiki: this.wiki,
			document: this.document
		});
		if (modeResult !== null) {
			if (renderMode === "carrier") {
				const parts = [
					`<<~ kau #${fragment}`,
					name,
					propsRaw
				].filter(Boolean).join(" ");
				const text = this.document.createTextNode(`${parts} >>`);
				_nextSibling ? parent.insertBefore(text, _nextSibling) : parent.appendChild(text);
				this.domNodes = [text];
			} else {
				const text = this.document.createTextNode(modeResult.raw);
				_nextSibling ? parent.insertBefore(text, _nextSibling) : parent.appendChild(text);
				this.domNodes = [text];
			}
			return;
		}
	}
	if (!fragment) {
		renderInvocation(this, parent, name, args);
		return;
	}
	const instanceFrag = fragment || `inst-${Math.random().toString(36).slice(2, 10)}`;
	const instanceUri = carrierUri ? `${carrierUri}#${instanceFrag}` : `#${instanceFrag}`;
	if (!fragment && _kauWriteBackHook && carrierUri) _kauWriteBackHook(carrierUri, instanceFrag);
	if (_kauCapabilityHook) _kauCapabilityHook(instanceUri);
	renderPlacement(this, parent, name, propsRaw, instanceUri);
};
function renderInvocation(widget, parent, name, args) {
	const defUri = (widget.wiki?.filterTiddlers?.(`[all[tiddlers]tag[$:/tags/LarariumKumu]field:kumu-name[${name}]]`) ?? [])[0] ?? "";
	const el = widget.document.createElement("div");
	el.setAttribute("data-lar-kind", "kau-invoke");
	el.setAttribute("data-lar-name", name);
	parent.appendChild(el);
	widget.domNodes = [el];
	if (defUri) {
		const argRe = /([\w-]+):(\S+)/g;
		let m;
		while ((m = argRe.exec(args)) !== null) widget.setVariable(m[1], m[2]);
		const transclude = widget.wiki?.makeTranscludeWidget(defUri, {
			document: widget.document,
			parentWidget: widget
		});
		if (transclude) {
			transclude.render(el, null);
			widget.children = [transclude];
		}
	} else {
		const hole = widget.document.createElement("span");
		hole.setAttribute("data-lar-kind", "hole");
		hole.textContent = `? kau ${name}`;
		el.appendChild(hole);
	}
}
function renderPlacement(widget, parent, name, propsRaw, instanceUri) {
	const defUri = (widget.wiki?.filterTiddlers?.(`[all[tiddlers]tag[$:/tags/LarariumKumu]field:kumu-name[${name}]]`) ?? [])[0] ?? "";
	const el = widget.document.createElement("div");
	el.setAttribute("data-lar-kind", "kau-place");
	el.setAttribute("data-lar-name", name);
	el.setAttribute("data-lar-instance", instanceUri);
	el.setAttribute("data-lar-resolved", defUri ? "true" : "false");
	parent.appendChild(el);
	widget.domNodes = [el];
	if (defUri) {
		const propRe = /([\w-]+):(\S+)/g;
		let m;
		while ((m = propRe.exec(propsRaw)) !== null) widget.setVariable(m[1], m[2]);
		widget.setVariable("currentTiddler", instanceUri);
		const transclude = widget.wiki?.makeTranscludeWidget(defUri, {
			document: widget.document,
			parentWidget: widget
		});
		if (transclude) {
			transclude.render(el, null);
			widget.children = [transclude];
		}
	} else {
		const hole = widget.document.createElement("span");
		hole.setAttribute("data-lar-kind", "hole");
		hole.textContent = `? kau ${name}`;
		el.appendChild(hole);
	}
}
KauWidget.prototype.execute = function() {};
KauWidget.prototype.refresh = function(changedTiddlers) {
	let changed = false;
	for (const child of this.children ?? []) if (child.refresh(changedTiddlers)) changed = true;
	return changed;
};
//#endregion
exports.KauWidget = KauWidget;
exports.registerKauCapabilityHook = registerKauCapabilityHook;
exports.registerKauWriteBackHook = registerKauWriteBackHook;

<<~&#x0003;>>

<<~ ahu #source >>

## Source

Compiled CJS artifact. Canonical TS source: `packages/lararium-tw5/src/widgets/kau.ts` (`source-symbol = "KauWidget"`).
Anchor meme: `lar:///ha.ka.ba/@lararium/tw5/widgets/kau`.

Run `pnpm --filter @lararium/tw5 build:tiddlers` to regenerate.

<<~/ahu >>

<<~&#x0004; -> ? >>
