import type { DaemonVmCore, DaemonVmHolder } from "@lararium/tw5";

export function islandAsk(holder: DaemonVmHolder) {
  return <A extends { answer: Promise<any>; abandon: () => void }>(make: (ports: {
    daemonHandle: DaemonVmCore["daemonHandle"];
    placeVerb: (o: Parameters<DaemonVmCore["placeVerb"]>[0] extends infer P ? Omit<P, "origin"> : never) => void;
  }) => A): A => {
    const ask = make({
      daemonHandle: holder.vm.daemonHandle,
      placeVerb: (o) => holder.vm.placeVerb({ ...o, origin: "channel" }),
    });
    return { ...ask, ...holder.guardAsk(ask) };
  };
}
