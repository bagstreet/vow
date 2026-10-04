# Contributing to Vow

## Quick Start

```bash
git clone https://github.com/aleksgleams-pixel/vow
cd vow && npm install
make setup    # verify Node ≥ 20, run tests, check coverage
make demo     # see the tamper-evident chain in action
```

## Structure

```
vow/
├── ledger/           # Core domain: hash-chain commitment ledger
│   ├── companion.mjs # App API (makeVow, checkin, audit, status)
│   ├── ledger/       # Chain: linkCheckin, audit, summary, screen
│   ├── llm/          # LLM provider chain (Groq → Cerebras → deterministic)
│   ├── http/         # HTTP server with auth
│   ├── memwal*.mjs   # Walrus Memory adapter + offline mock
│   └── keys.mjs      # Namespace and key utilities
├── web/              # React + Vite + Tailwind frontend
├── bin/              # CLI entry points
├── mcp/              # MCP server for IDE integration
├── tests/            # Test suite (mutation + e2e + security)
├── demo/             # Demo scripts and tamper scenarios
├── docs/             # Documentation
├── brand/            # Identity assets
├── article/          # Medium/Inkray article draft
└── evidence/         # Test results and receipts
```

## Running Tests

```bash
make test          # All tests
make jury          # Hackathon jury scenarios (record actual result)
make coverage      # Coverage report with thresholds
```

## Code Style

- Pure ESM (.mjs), no build step for backend
- Functional where possible, classes for stateful services
- Every gate rule must be proven load-bearing by mutation test
