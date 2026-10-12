/* Module SharedWorker: a static import proves module semantics, not merely the option being accepted. */
import { depTag } from "./module-dep.js";
self.onconnect = (e) => { const p = e.ports[0]; p.onmessage = (m) => p.postMessage({ id: m.data.id, ok: true, dep: depTag }); p.start?.(); };
