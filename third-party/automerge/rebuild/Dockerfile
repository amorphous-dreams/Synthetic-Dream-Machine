# Clean-runner rebuild of the vendored automerge engine (third-party/automerge/README.md, "Rebuild").
FROM debian:bookworm
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git build-essential xz-utils python3 pkg-config \
    && rm -rf /var/lib/apt/lists/*
# The toolchain and registry live under neutral homes; rebuild.sh remaps them (and the build dir) in the wasm's
# panic-location strings, so the bytes carry no person's home path.
ENV RUSTUP_HOME=/opt/rustup CARGO_HOME=/opt/cargo PATH=/opt/cargo/bin:/opt/node/bin:$PATH
RUN curl -fsSL https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain nightly-2026-11-23 \
      -c rust-src -t wasm32-unknown-unknown \
    && cargo install wasm-bindgen-cli --version 0.2.127 --locked
RUN mkdir /opt/node && curl -fsSL https://nodejs.org/dist/v24.15.0/node-v24.15.0-linux-x64.tar.xz \
      | tar -xJ -C /opt/node --strip-components=1
COPY rebuild.sh /usr/local/bin/rebuild.sh
ENTRYPOINT ["/usr/local/bin/rebuild.sh"]
