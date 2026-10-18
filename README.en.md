# DeepSeek Harness Portable

Run the official DeepSeek Harness from one movable folder. No global Node installation or system PATH changes.

[Download](https://github.com/Tsungloong/deepseek-harness-portable/releases/latest) · [中文](README.md)

Source baseline: portable **1.0.1**, official Harness **0.2.1-rc.2**. The official Web UI and configuration stay unmodified; the wrapper handles bootstrap, directory isolation and relocation.

## Start

- **Windows x64:** unzip, then double-click `windows.bat`.
- **Linux x64 / glibc:** run `sh linux.sh`.
- **Apple Silicon macOS:** run `sh mac.sh` (runtime CI is required before release; desktop walkthrough pending).

The first launch downloads verified Node.js and the locked official Harness dependencies.
Open the complete URL printed after **`dsh web:`**. Press **Ctrl+C** to stop.
Configure models and API endpoints in the official workbench. The interface can start offline after setup; cloud inference needs network access and credentials.

## Commands

Replace `windows.bat` with `sh linux.sh` or `sh mac.sh` on Unix.

- `setup`: install the pinned runtime; reuse an existing installation.
- `doctor`: 16 checks, with OK / WARN / FAIL results.
- `repair`: reinstall Node and Harness while preserving `data/`.
- `reset`: confirm and delete data, runtimes and caches; preserve source and `models/`.
- `portable-update`: install a verified source release; its pinned runtime is installed on the next launch.
- `--version`: show portable and Harness versions.
- `-- <args>`: forward unchanged arguments to Harness.
- `web --port 3081`: use another port.

Automatic checks run at most once every 24 hours and only announce updates.
Set `DSH_PORTABLE_NO_AUTO_UPDATE=1` to disable checks. A failed check does not prevent startup.
A custom `portable-update --manifest URL` must reference a complete source archive with SHA-256.

## Data and relocation

The Web launch directory is `data/workspace/`. The official UI restores registered workspaces; its auto-created default may instead be under `data/portable-home/Documents/deepseek-harness/default-workspace/`. Both stay inside the portable folder. Harness data lives in `data/dsh-home/`,
shared agent data in `data/agents-home/`, and child-process home in `data/portable-home/`.
CLI passthrough retains the caller's current directory. `models/` is a preserved user directory, not a local inference service.

Stop before copying the folder. Internal workspace paths, session directories, log headers and projection caches are relocated together, with backups.
External projects are not copied or silently replaced with empty directories; select their actual location on the destination machine.
Different operating systems need their own runtime. Third-party plugins may not be portable.

Targets: Windows 10/11 x64, glibc Linux x64 and Apple Silicon macOS.
Windows/Linux ARM64, Intel macOS and musl/Alpine are not supported.
Prefer NTFS on Windows, ext4 on Linux, and APFS on macOS; allow at least 1 GiB.
Unix requires owner-only credential permissions (0600). Linux exFAT and WSL Windows mounts without metadata do not meet this requirement; use a Linux filesystem inside WSL.
See [validation](docs/validation.md) for observed results and untested platforms. Release notes link the required passing Windows, Linux and macOS CI run for the released commit.

## Upgrading to 0.2.1-rc.2

Stop Harness and back up both `data/` and the old source/runtime before the first new launch. Saved Web credentials now take precedence over environment values; headless uses environment/`.env` credentials by default. The official `--from-default-profile` option now replaces an existing named profile, so do not use it merely to reopen one. Check third-party plugins against the new engine requirements; the old experimental schedule bundle is replaced by the built-in feature. For rollback, restore the matching pre-upgrade source/runtime and data together.

## Credentials

Credentials remain plain files under `data/`. Anyone holding the folder may be able to use them.
Do not publish an initialized personal installation. Sign out and clear personal data before sharing; revoke credentials if the drive is lost.

## License

Maintainer: **Tsungloong**. Apache-2.0 covers this bootstrap layer.
The official Harness is installed unchanged under its own license.
This is an independent community project; DeepSeek names and marks belong to their owners. See [NOTICE](NOTICE.md) for third-party notices.
