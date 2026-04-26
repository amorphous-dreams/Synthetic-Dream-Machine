import { useEffect, useState } from "react";
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

function getApiBase(): string {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="lararium-ws"]');
  if (meta?.content) {
    const u = new URL(meta.content);
    return `${u.protocol === "wss:" ? "https:" : "http:"}//${u.host}`;
  }
  return "";
}

export function App() {
  const [memes, setMemes] = useState<MemeEntry[]>([]);
  const wsUrl = getWsUrl();

  useEffect(() => {
    fetch(`${getApiBase()}/api/memes`)
      .then((r) => r.json())
      .then((data: MemeEntry[]) => setMemes(data))
      .catch((e) => console.warn("[lararium] /api/memes fetch failed:", e));
  }, []);

  return <LarariumShell wsUrl={wsUrl} memes={memes} />;
}
