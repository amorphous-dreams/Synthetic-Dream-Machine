Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/widgets/pae.ts
function PaeWidget(parseTreeNode, options) {
	this.initialise(parseTreeNode, options);
}
PaeWidget.prototype.render = function(parent, _nextSibling) {
	this.parentDomNode = parent;
	this.domNodes = [];
};
PaeWidget.prototype.execute = function() {};
//#endregion
exports.PaeWidget = PaeWidget;
