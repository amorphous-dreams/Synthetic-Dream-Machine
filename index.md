---
title: Synthetic Dream Machine
subtitle: "A navigational console for the SDM constellation, choose a vault to continue. The archive Lares are listening..."
layout: default
body_class: dashboard
---

{% include nav-dashboard.html
  heading="FTLS Repository Vaults"
  items=site.data.nav.root.ftls_vaults
  show_return=false
%}

{% include nav-dashboard.html
  heading="SDM Repository Vaults"
  items=site.data.nav.root.sdm_vaults
  show_return=false
%}

{% include nav-dashboard.html
  heading="Reference"
  items=site.data.nav.root.reference
  return_href=site.data.nav.root.return_href
%}
