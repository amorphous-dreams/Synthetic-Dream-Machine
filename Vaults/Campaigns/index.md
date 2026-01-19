---
title: Campaign Vaults
subtitle: Portal to the narrative campaigns that tie the nodes together.
layout: default
body_class: dashboard
header_nav_context: campaigns
---

{% if site.data.nav.root.campaigns_vaults.size == 0 %}
This archive is currently cataloguing campaign drafts. Check back once the vault has material.
{% endif %}

Visit the [Campaign Vaults directory](/Campaigns/) for a narrative overview before diving into the individual nodes.

{% include nav-dashboard.html
  heading="Campaign Vaults"
  items=site.data.nav.root.campaigns_vaults
  show_return=false
%}
