# NOTICE

## Project

**DeepSeek Harness Portable** — a portable bootstrap wrapper for DeepSeek Harness.

Maintainer: Tsungloong.
Copyright 2026 Tsungloong and contributors.

Licensed under the Apache License, Version 2.0. The full license text is in [LICENSE](LICENSE).

## DeepSeek Trademark Notice

DeepSeek Harness is a product of DeepSeek. The name "DeepSeek" and the DeepSeek logo are
trademarks of DeepSeek. This project is an independent community portability
layer and is not affiliated with, sponsored by, or endorsed by DeepSeek. All DeepSeek
names, logos, and marks are the property of DeepSeek.

This project does not modify, repackage, or redistribute the official DeepSeek Harness
source code. It downloads and installs the official `@deepseek-ai/dsh` npm package at
runtime, unmodified, subject to that package's own license terms.

## Third-Party Components

This project downloads and uses the following third-party software at runtime:

| Component | Version | License | Purpose |
|---|---|---|---|
| `@deepseek-ai/dsh` | 0.2.1-rc.2 | See package | DeepSeek Harness — the official CLI this project wraps |
| Node.js | 24.21.0 | MIT | Portable JavaScript runtime (downloaded on first launch) |
| pnpm | 11.28.0 | MIT | Package manager (installed as a dependency for `dsh plugin` support) |
| `node-pty` | 1.2.0-beta.15 | MIT | Pseudo-terminal support (transitive dependency of dsh) |
| `koffi` | 3.1.1 | MIT | Foreign Function Interface (transitive dependency of dsh) |

Each component is subject to its own license. This project's Apache-2.0 license
applies only to the portable bootstrap layer itself, not to the components it
downloads and runs.

## Upstream References

The architecture of this project draws on two open-source portable distributions:

- **techjarves/Deepseek-Harness-Portable** — the lightweight bootstrap pattern
  (thin launchers + single portable.mjs + manifest-driven downloads)
- **WSL043/DSH-Portable** — the engineering quality practices
  (three-state diagnostics, session portability, credential security warnings)

Both are independent community projects, neither affiliated with DeepSeek.
