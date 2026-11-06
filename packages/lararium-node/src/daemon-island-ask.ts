import type { DaemonVmCore, DaemonVmHolder } from "@lararium/tw5";

export function islandAsk(holder: DaemonVmHolder) {
  return <A extends { answer: Promise<any>; abandon: () => void }>(make: (ports: {
    composite: DaemonVmCore["composite"];
    placeVerb: (o: Parameters<DaemonVmCore["placeVerb"]>[0] extends infer P ? Omit<P, "origin"> : never) => void;
  }) => A): A => {
    const ask = make({
      composite: holder.vm.composite,
      placeVerb: (o) => holder.vm.placeVerb({ ...o, origin: "channel" }),
    });
    return { ...ask, ...holder.guardAsk(ask) };
  };
}
