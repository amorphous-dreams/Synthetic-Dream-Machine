---
title: Vaults Index
subtitle: Central routing for the archive vaults.
layout: default
body_class: dashboard
header_nav_context: vaults
---

## Vault Locks

Every archive on this node lives in a vault. Choose a gate below to open the stack you need.

{% include nav-dashboard.html
  heading="Vault Sections"
  items=site.data.nav.vault_sections
  return_href=site.data.nav.root.return_href
%}

Each gate opens onto the corresponding dashboard with chapter-level links or campaign drafts. Use the header links to hop between vaults once you commit to a lane.
