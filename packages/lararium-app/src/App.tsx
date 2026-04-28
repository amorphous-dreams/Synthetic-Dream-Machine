import { useCallback, useState } from "react";
import { LarariumShell } from "./LarariumShell.js";

export interface MemeEntry {
  uri: string;
  depth: number;
  kind: string;
}

function getWsUrl(): string {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="lararium-ws"]');
  if (meta?.content) return meta.content;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/rooms/boot`;
}

export function App() {
  const [memes, setMemes] = useState<MemeEntry[]>([]);
  const wsUrl = getWsUrl();
  const handleMemes = useCallback((m: MemeEntry[]) => setMemes(m), []);

  return <LarariumShell wsUrl={wsUrl} memes={memes} onMemes={handleMemes} />;
}
