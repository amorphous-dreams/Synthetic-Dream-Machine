/**
 * github-cli-auth — operator identity from the local `gh` CLI session.
 *
 * Local-first operator path: the developer running the server is already
 * authenticated to GitHub via `gh auth login`. This module reads that session
 * and mints a LarAuthReceipt for the operator identity — no browser OAuth
 * redirect required for the person actually running the node.
 *
 * Scope: localhost only. Never called from browser code.
 * Fails gracefully: if `gh` is not installed or not authenticated, returns null.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { LarAuthReceipt } from "@lararium/mesh";

const exec = promisify(execFile);

interface GitHubUser {
  login:  string;
  id:     number;
  name?:  string;
  email?: string;
}

/** Read the active GitHub OAuth token from the gh CLI. Returns null if unavailable. */
async function readGhToken(): Promise<string | null> {
  try {
    const { stdout } = await exec("gh", ["auth", "token"], { timeout: 3000 });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/** Fetch GitHub user info using a token. Returns null on failure. */
async function fetchGitHubUser(token: string): Promise<GitHubUser | null> {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "lararium-node/0.1" },
    });
    if (!res.ok) return null;
    return await res.json() as GitHubUser;
  } catch {
    return null;
  }
}

/**
 * Try to build an operator receipt from the local gh CLI session.
 *
 * Returns null if gh is not installed, not authenticated, or the GitHub API
 * call fails (e.g. offline). Caller should fall back to local-dev receipt.
 */
export async function getGhCliOperatorReceipt(): Promise<LarAuthReceipt | null> {
  const token = await readGhToken();
  if (!token) return null;

  const user = await fetchGitHubUser(token);
  if (!user) return null;

  const now = new Date();
  const expires = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8h session

  return {
    provider:    "github-vscode",
    subject:     `github:${user.login}`,
    displayName: user.name ?? user.login,
    issuedAt:    now.toISOString(),
    expiresAt:   expires.toISOString(),
    scopes:      [{ with: "lararium:*", can: "*" }],
    principal: {
      provider:        "github-vscode",
      login:           user.login,
      githubId:        String(user.id),
      editor:          "vscode-insiders",
      localInstanceId: `gh-cli:${user.login}`,
    },
  };
}
