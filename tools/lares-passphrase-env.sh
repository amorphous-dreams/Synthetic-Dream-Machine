#!/usr/bin/env sh
# lares-passphrase-env — set LARES_ARCHIVE_PASSPHRASE from an external, SWAPPABLE secret store.
#
# The store stands OUTSIDE the WSL2 vessel: the passphrase lives in the Windows home, never in the repo,
# never in git, never in the vessel's own tree. The store is a CAPABILITY behind LARES_PASSPHRASE_PROVIDER —
# a `file:` provider by default, swappable to a `cmd:` provider (a secret manager, Windows Credential
# Manager via a shim, a hardware token) without changing a single caller.
#
# Fail-closed: a missing or empty store leaves LARES_ARCHIVE_PASSPHRASE UNSET, and the vessel then stands a
# crossroads (unlit) rather than lighting on a silent wrong key. The passphrase never persists in the vessel —
# archive-passphrase.ts derives a KEK the moment it needs one and drops the passphrase; this only puts it in
# the process environment for that derivation.
#
# Idempotent — source it as many times as you like:
#     . tools/lares-passphrase-env.sh
# Swap the store without editing this file:
#     LARES_PASSPHRASE_PROVIDER='cmd:my-secret-tool get lares/archive' . tools/lares-passphrase-env.sh

: "${LARES_PASSPHRASE_PROVIDER:=file:/mnt/c/Users/joshu/.lares/archive-passphrase}"

_lares_pp_read() {
  case "$1" in
    file:*) _f="${1#file:}"; [ -r "$_f" ] && cat "$_f" 2>/dev/null || return 1 ;;
    cmd:*)  sh -c "${1#cmd:}" 2>/dev/null || return 1 ;;   # a swappable secret-manager command
    *)      return 1 ;;
  esac
}

_lares_pp="$(_lares_pp_read "$LARES_PASSPHRASE_PROVIDER" | tr -d '\n')"
if [ -n "$_lares_pp" ]; then
  export LARES_ARCHIVE_PASSPHRASE="$_lares_pp"
  printf '[lares-passphrase] LARES_ARCHIVE_PASSPHRASE set from %s (%s chars)\n' "$LARES_PASSPHRASE_PROVIDER" "${#_lares_pp}"
else
  printf '[lares-passphrase] no secret from %s — LARES_ARCHIVE_PASSPHRASE left UNSET (vessel will stand a crossroads)\n' "$LARES_PASSPHRASE_PROVIDER" >&2
fi
unset _lares_pp _f
