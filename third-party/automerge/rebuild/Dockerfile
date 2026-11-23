# Clean-runner rebuild of the vendored automerge engine (third-party/automerge/README.md, "Rebuild").
FROM debian:bookworm
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl git build-essential xz-utils python3 pkg-config \
    && rm -rf /var/lib/apt/lists/*
# The wasm embeds absolute toolchain and registry paths (panic locations), so the build home must read as the pinned
# build's: /home/joshu/.cargo, /home/joshu/.rustup, and a toolchain directory named `nightly-<host>`.
ENV RUSTUP_HOME=/home/joshu/.rustup CARGO_HOME=/home/joshu/.cargo PATH=/home/joshu/.cargo/bin:/opt/node/bin:$PATH
RUN curl -fsSL https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain nightly-2026-11-23 \
      -c rust-src -t wasm32-unknown-unknown \
    && cd $RUSTUP_HOME/toolchains \
    && mv nightly-2026-11-23-x86_64-unknown-linux-gnu nightly-x86_64-unknown-linux-gnu \
    && ln -s nightly-x86_64-unknown-linux-gnu nightly-2026-11-23-x86_64-unknown-linux-gnu \
    && cd / \
    && cargo install wasm-bindgen-cli --version 0.2.127 --locked
RUN mkdir /opt/node && curl -fsSL https://nodejs.org/dist/v24.15.0/node-v24.15.0-linux-x64.tar.xz \
      | tar -xJ -C /opt/node --strip-components=1
COPY rebuild.sh /usr/local/bin/rebuild.sh
ENTRYPOINT ["/usr/local/bin/rebuild.sh"]
