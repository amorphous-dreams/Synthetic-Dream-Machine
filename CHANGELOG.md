# Flying Triremes and Laser Swords — Changelog

No release has shipped. A release names its floor by CID under the steward's `floor-release` seal, and no version number marks it.

## Where the record lives

The change record rides in the lane commits themselves, as git trailers: `Breaking:` names a change that asks something of a person or a script, `Changed:` names what a person can now do or now reads, and `Amends: <sha>` lets a later commit correct a landed line. Merge commits carry none. This file holds no entries.

`tools/changelog-render.mjs` projects the record along `develop`'s first-parent chain, newest merge first, every `Breaking:` line leading:

```sh
node tools/changelog-render.mjs <from>..<to>          # markdown
node tools/changelog-render.mjs <from>..<to> --json   # the same record, structured
```

Pick the range by its two ends on `develop`: two release tags, for what one release carries past the one before it; or `origin/develop~N..origin/develop`, for the last N merges (`~` walks first parents, one merge per step).

Operator acts never ride git history. Each lives in the house as a record of its own, offered by a session or minted by the operator, and reaches the operator at the re-light.

The hand-written record before this cut rests whole at the tag `archive/changelog-green-jello-dinosaur` (`git show archive/changelog-green-jello-dinosaur:CHANGELOG.md`).

## Milestone

- The house stood for the first time on Friday 2026-11-13.
