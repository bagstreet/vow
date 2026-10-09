# Contributing to Vow

## Quick start

```bash
git clone https://github.com/bagstreet/vow
cd vow && npm install
make setup    # check Node >= 20, run the tests
make demo     # tamper-evident chain in action
```

## Structure

```
apps/web/          landing, dashboard and serverless API (Vite + React, Vercel)
apps/cli/          `vow` command-line client
apps/mcp/          MCP bridge to the Agent API
apps/discord-gateway/  Discord DM relay
packages/core/     channels, memory, scheduler, trusted contact, admin, agent API
packages/db/       Neon migrations
packages/presets/  role presets
packages/sdk/      JavaScript client for the Agent API
tests/             test suite
examples/          demo scripts
docs/              mechanics, diagrams, services, API, roadmap
```

## Tests

```bash
npm test           # full suite, offline, no keys needed
make jury          # quick PASS/FAIL over the headline use cases
cd apps/web && npx tsc --noEmit
```

## Conventions

- Pure ESM (`.mjs`) in the backend, no build step.
- Everything user-facing, in code and docs, is English.
- Commit messages: an emoji, then a short English sentence, for example `🐛 Fix quiet-hours edge case`.
- Never commit secrets; `make secret-scan` runs in CI.
