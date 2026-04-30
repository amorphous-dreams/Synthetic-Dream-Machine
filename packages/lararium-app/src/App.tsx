import { useCallback, useState } from "react";
import { LarariumShell } from "./LarariumShell.js";

export interface MemeEntry {
  uri: string;
  depth: number;
  kind: string;
}

export function App() {
  const [memes, setMemes] = useState<MemeEntry[]>([]);
  const handleMemes = useCallback((m: MemeEntry[]) => setMemes(m), []);

  return <LarariumShell memes={memes} onMemes={handleMemes} />;
}
