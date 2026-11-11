#!/usr/bin/env bash
set -euo pipefail

archive_directory=$1

packages=(
  libasound2-dev
  libfontconfig1-dev
  libfreetype6-dev
  libssl-dev
  libvulkan-dev
  libwayland-dev
  libx11-dev
  libx11-xcb-dev
  libxcb-randr0-dev
  libxcb-render0-dev
  libxcb-shape0-dev
  libxcb-xfixes0-dev
  libxcb-xkb-dev
  libxcb1-dev
  libxkbcommon-dev
  libxkbcommon-x11-dev
  pkg-config
)

# apt-get gets no package sources, so it cannot ask a mirror for a package that the archives lack.
# It then fails without changing the system. `--no-download` cannot do this: apt-get rejects it
# together with package files.
#
# The package names are passed too. The archives hold only what the runner image lacked when they
# were saved, so a later image that drops a package would otherwise leave it out.
install_from_archive_directory() {
  local archives=("$archive_directory"/*.deb)

  if [ ! -e "${archives[0]}" ]; then
    return 1
  fi

  sudo apt-get install --no-install-recommends --yes \
    --option Dir::Etc::sourcelist=/dev/null \
    --option Dir::Etc::sourceparts=/dev/null \
    "${archives[@]}" "${packages[@]}"
}

if install_from_archive_directory; then
  exit 0
fi

echo "The cached packages are missing or do not fit this runner image. Installing from the mirror."
sudo apt-get update
sudo apt-get clean
sudo apt-get install --download-only --no-install-recommends --yes "${packages[@]}"

mkdir -p "$archive_directory"
find "$archive_directory" -maxdepth 1 -name '*.deb' -delete
find /var/cache/apt/archives -maxdepth 1 -name '*.deb' -exec cp --target-directory "$archive_directory" {} +

sudo apt-get install --no-download --no-install-recommends --yes "${packages[@]}"
echo "downloaded=true" >> "$GITHUB_OUTPUT"
