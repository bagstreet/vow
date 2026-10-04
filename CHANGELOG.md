# Changelog

## [Unreleased]

### Added
- 5 presets (superseded 2026-10-04: one Commitment Steward, health outside MVP)
- React + Vite + Tailwind frontend with Framer Motion animations
- Interactive tamper demo (edit → rejected → honest correction)
- Owner Console (receipts, delegate keys, provider chain)
- 6-channel integration support (Telegram, Web, CLI, Discord, MCP, API)
- OG meta tags, Twitter Card, JSON-LD structured data
- GitHub Actions CI (test + lint + security scan)
- Vercel auto-deploy from main

### Security
- Taint scan on recalled memory (injection quarantine)
- Owner key never on server (delegate only)
- Secret scan in CI pipeline
- Rate limiting on HTTP endpoints
