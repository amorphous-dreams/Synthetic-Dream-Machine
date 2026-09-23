# Pronaos NGINX reference witness

This directory contains a disposable, additive deployment harness. It exercises
an NGINX carrier in front of a deliberately small WebSocket upstream and a
prepared, read-only public projection. It does not claim to deploy the
Lararium Node runtime: the current Node process does not mount the prepared
public-library read face as one production HTTP listener yet.

The harness proves the carrier boundary:

- exact index, asset, worker, seed, and one CID-addressed byte are public;
- the emitted Web manifest receives its own exact optional PWA-install route;
- the arrival index and seed remain `no-store`, while immutable assets and
  seed-named CAS bytes receive long-lived immutable caching;
- undeclared, missing, traversal-shaped, and private paths refuse without SPA
  fallback;
- `/ws` forwards an HTTP upgrade to an internal-only upstream;
- NGINX receives no private data mount and the upstream has no host-published
  port.

Run from the repository root:

```sh
deploy/pronaos-nginx-reference-witness/test.sh
```

The test uses a unique Compose project and removes its containers and network
on exit. It uses only the official `nginx:1.29-alpine` and `node:24-alpine`
images.

The cache split remains deliberate. The index and seed act as inspectable
arrival/bootstrap selectors and therefore carry `no-store`; content-addressed
assets and CAS members carry immutable public cache policy. A cache copy remains
delivery material and never becomes proof of identity, authority, membership,
or causal order.

`manifest.webmanifest` belongs to the finite arrival surface as an optional
phone-install projection. The page boots without it; the phone-seat behavior
offers installation rather than demanding it. This witness still routes and
refuses it explicitly because the Web build emits and links the file.
