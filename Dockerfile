# syntax=docker/dockerfile:1

# Reproducible build environment for the OpenPrintCost desktop app.
#
#   docker build -t openprintcost-build .
#   docker run --rm -v "$PWD/src-tauri/target/release/bundle":/out openprintcost-build
#
# The image contains everything the Tauri build needs: Node.js 22, the stable
# Rust toolchain, and the webview system libraries of the host platform.
# On Linux the AppImage bundler additionally needs libfuse2, file, and
# patchelf.

FROM node:22-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH

# System libraries: webview for the UI, plus the tools the bundlers use.
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      ca-certificates \
      curl \
      file \
      libayatana-appindicator3-dev \
      libfuse2 \
      libgtk-3-dev \
      librsvg2-dev \
      libssl-dev \
      libwebkit2gtk-4.1-dev \
      patchelf \
      pkg-config \
 && rm -rf /var/lib/apt/lists/*

# Rust (stable, with rustfmt and clippy for the gates).
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
      | sh -s -- -y --default-toolchain stable --profile minimal --component rustfmt,clippy \
 && chmod -R a+w $RUSTUP_HOME $CARGO_HOME

WORKDIR /app

# Dependencies first, so that source changes do not invalidate the layers.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Frontend bundle + desktop app + installable packages.
RUN npm run build:app

CMD ["sh", "-c", "find src-tauri/target/release/bundle -maxdepth 2 -type f"]
