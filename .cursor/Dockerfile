# Cloud agent image. Node 24 matches the web image and package.json engines.
# Postgres 18 is local so the database suite does not need Docker.
# Do not COPY the repository. Cursor checks out the revision after this image.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      gnupg \
      git \
      xz-utils \
      build-essential \
      python3 \
      sudo \
    && rm -rf /var/lib/apt/lists/* \
    && echo 'ubuntu ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/ubuntu \
    && chmod 0440 /etc/sudoers.d/ubuntu

ARG NODE_VERSION=24.21.0
RUN curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
      | tar -xJ -C /usr/local --strip-components=1 --no-same-owner \
    && corepack enable \
    && corepack prepare pnpm@12.15.0 --activate

# /exec-daemon/node is the platform Node 22 and precedes /usr/local/bin.
# Login shells source this file. Agent shells do not, so scripts/env/node-path.sh
# also links Node 24 into the PATH directory ahead of /exec-daemon on boot.
RUN printf '%s\n' \
      'export PATH="/usr/local/bin:${PATH}"' \
      'export NUXT_TELEMETRY_DISABLED=1' \
      'export DATABASE_URL="${DATABASE_URL:-postgres://k39:k39@127.0.0.1:5432/k39}"' \
      'export DATABASE_URL_TEST="${DATABASE_URL_TEST:-postgres://k39:k39@127.0.0.1:5432/k39_test}"' \
      > /etc/profile.d/k39.sh

RUN install -d /usr/share/postgresql-common/pgdg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      | gpg --dearmor -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg] https://apt.postgresql.org/pub/repos/apt noble-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-18 \
    && rm -rf /var/lib/apt/lists/*

USER ubuntu
