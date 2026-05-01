/**
 * AuthGate — shown before boot when no auth receipt is present.
 *
 * Bluesky is the primary login. GitHub OAuth is secondary (env-gated).
 * Local-dev auto-passes if the server injected a receipt meta tag.
 */

import { useState } from "react";
import { startBlueSkyLogin } from "./bluesky-auth.js";

interface AuthGateProps {
  onReceipt: (receipt: import("@lararium/core").LarAuthReceipt) => void;
  githubOAuthEnabled: boolean;
}

export function AuthGate({ githubOAuthEnabled }: AuthGateProps) {
  const [handle, setHandle]   = useState("");
  const [busy,   setBusy]     = useState(false);
  const [error,  setError]    = useState<string | null>(null);

  async function handleBlueSky(e: React.FormEvent) {
    e.preventDefault();
    if (!handle.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await startBlueSkyLogin(handle.trim());
      // Page redirects — nothing after this runs.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  }

  function handleGitHub() {
    window.location.href = "/auth/github/start";
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "100vh", gap: "1.5rem",
      fontFamily: "system-ui, sans-serif", background: "#0f0f0f", color: "#e0e0e0",
    }}>
      <h1 style={{ margin: 0, fontSize: "1.5rem", letterSpacing: "0.05em" }}>Lararium</h1>

      <form onSubmit={handleBlueSky} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "320px" }}>
        <label style={{ fontSize: "0.85rem", color: "#a0a0a0" }}>Sign in with Bluesky</label>
        <input
          type="text"
          placeholder="handle.bsky.social or did:plc:..."
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          disabled={busy}
          style={{
            padding: "0.6rem 0.8rem", borderRadius: "6px", border: "1px solid #333",
            background: "#1a1a1a", color: "#e0e0e0", fontSize: "0.9rem",
          }}
          autoFocus
        />
        <button type="submit" disabled={busy || !handle.trim()} style={{
          padding: "0.6rem", borderRadius: "6px", border: "none",
          background: busy ? "#333" : "#0085ff", color: "#fff",
          fontSize: "0.9rem", cursor: busy ? "default" : "pointer",
        }}>
          {busy ? "Redirecting…" : "Continue with Bluesky →"}
        </button>
        {error && <span style={{ fontSize: "0.8rem", color: "#f87171" }}>{error}</span>}
      </form>

      {githubOAuthEnabled && (
        <>
          <span style={{ color: "#444", fontSize: "0.8rem" }}>or</span>
          <button onClick={handleGitHub} style={{
            padding: "0.6rem 1.2rem", borderRadius: "6px", border: "1px solid #333",
            background: "#1a1a1a", color: "#e0e0e0", fontSize: "0.9rem", cursor: "pointer",
            width: "320px",
          }}>
            Continue with GitHub →
          </button>
        </>
      )}
    </div>
  );
}
