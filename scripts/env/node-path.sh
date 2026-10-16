#!/usr/bin/env bash
# Put the Node version in .nvmrc ahead of the platform Node.
#
# /etc/profile.d runs for login shells only. Agent commands are not login
# shells, and /exec-daemon/node (Node 22) is earlier on PATH than
# /usr/local/bin. This links node, corepack, and pnpm into every PATH
# directory before /exec-daemon. If /exec-daemon is already first, a
# dispatcher keeps Node 22 for the exec daemon and sends other commands
# to the pinned Node.
set -euo pipefail
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

root=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
version=$(tr -d '[:space:]' < "$root/.nvmrc")
node_root="${HOME}/.local/k39-node"
node_bin="$node_root/bin"

if [ -x /usr/local/bin/node ] && [ "$(/usr/local/bin/node -v 2>/dev/null || true)" = "v${version}" ]; then
  node_bin=/usr/local/bin
fi

plan() {
  node "$root/scripts/env/node-path-plan.mjs" "$@"
}

link_tools_into() {
  local dir="$1"
  local tool
  local target
  if [ ! -d "$dir" ]; then
    return 1
  fi
  if [ ! -w "$dir" ] && ! sudo -n test -w "$dir"; then
    return 1
  fi
  for tool in node npm npx corepack pnpm pnpx; do
    target="$node_bin/$tool"
    if [ ! -e "$target" ]; then
      continue
    fi
    if [ -w "$dir" ]; then
      ln -sfn "$target" "$dir/$tool"
    else
      sudo -n ln -sfn "$target" "$dir/$tool"
    fi
  done
}

install_node() {
  local arch node_arch tmp url
  arch=$(uname -m)
  case "$arch" in
    x86_64) node_arch=x64 ;;
    aarch64 | arm64) node_arch=arm64 ;;
    *)
      echo "node-path: unsupported architecture $arch" >&2
      exit 1
      ;;
  esac
  tmp=$(mktemp -d)
  url="https://nodejs.org/dist/v${version}/node-v${version}-linux-${node_arch}.tar.xz"
  curl -fsSL "$url" | tar -xJ -C "$tmp" --strip-components=1
  rm -rf "$node_root"
  mkdir -p "$(dirname "$node_root")"
  mv "$tmp" "$node_root"
  node_bin="$node_root/bin"
}

ensure_pnpm() {
  local package_manager
  if [ -x "$node_bin/pnpm" ]; then
    if [ "$node_bin" != /usr/local/bin ]; then
      link_tools_into /usr/local/bin || true
    fi
    return
  fi
  package_manager=$(sed -n 's/.*"packageManager": "\(pnpm@[^"]*\)".*/\1/p' "$root/package.json")
  if [ -z "$package_manager" ]; then
    echo 'node-path: package.json has no packageManager pin' >&2
    exit 1
  fi
  if [ -w "$node_bin" ]; then
    "$node_bin/corepack" enable --install-directory "$node_bin"
    "$node_bin/corepack" prepare "$package_manager" --activate
  else
    sudo -n "$node_bin/corepack" enable --install-directory "$node_bin"
    sudo -n "$node_bin/corepack" prepare "$package_manager" --activate
  fi
  if [ "$node_bin" != /usr/local/bin ]; then
    link_tools_into /usr/local/bin || true
  fi
}

install_dispatcher() {
  local marker='k39-node-dispatch'
  if [ ! -e /exec-daemon/node ]; then
    echo 'node-path: /exec-daemon is first on PATH and its node binary is missing' >&2
    exit 1
  fi
  if grep -q "$marker" /exec-daemon/node 2>/dev/null; then
    return
  fi
  if [ ! -e /exec-daemon/node-22 ]; then
    sudo -n mv /exec-daemon/node /exec-daemon/node-22
  fi
  sudo -n tee /exec-daemon/node >/dev/null <<EOF
#!/bin/sh
# ${marker}: user commands run Node ${version}. The exec daemon keeps Node 22.
case "\${1-}" in
  /exec-daemon/*.js)
    exec /exec-daemon/node-22 "\$@"
    ;;
esac
exec ${node_bin}/node "\$@"
EOF
  sudo -n chmod 0755 /exec-daemon/node
}

write_profile() {
  if [ ! -d /etc/profile.d ]; then
    return
  fi
  sudo -n tee /etc/profile.d/k39-node.sh >/dev/null <<EOF
# Login shells. Non-login agent shells are handled by scripts/env/node-path.sh.
export PATH="${node_bin}:\$PATH"
export NUXT_TELEMETRY_DISABLED=1
EOF
}

if [ ! -x "$node_bin/node" ] || [ "$("$node_bin/node" -v 2>/dev/null || true)" != "v${version}" ]; then
  install_node
fi
ensure_pnpm
write_profile || true

placed=0
while IFS= read -r dir; do
  [ -n "$dir" ] || continue
  if link_tools_into "$dir"; then
    placed=1
  fi
done < <(plan)

platform=$(plan --platform)
if [ "$placed" -eq 0 ] && [ "$platform" = yes ]; then
  if [ -d /exec-daemon ]; then
    install_dispatcher
  else
    echo 'node-path: could not put Node ahead of /exec-daemon' >&2
    exit 1
  fi
fi

echo "node-path: $($node_bin/node -v) at $node_bin"
