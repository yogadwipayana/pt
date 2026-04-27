# Dwipa Repo Context

This repository is the full codebase for Dwipa, an AI tool for developers.

Dwipa is heavily inspired by `https://ollama.com/`, both in product design direction and in business positioning/model.

Treat this repo as a multi-surface product repo, not a single app. Current and planned product areas include:

- `ai/`: the Dwipa backend and AI Router product served at `ai.dwipa.my.id`
- `main/`: the main website frontend served at `dwipa.my.id`

Architecture boundary:

- `main/` is frontend-only
- `ai/` is the backend for Dwipa product features
- `ai/` also exposes the AI service layer and OpenAI-compatible API surface

The `main` website covers:

- Public pages: `landing`, `models`, `docs`, `pricing`, and `sign in`
- Settings pages: `usage`, `keys`, `billing`, and `profile`

Dwipa pricing currently has three primary tiers:

- `Free`: `$2 credit/24 hours`; credits are added through manual top-ups
- `Pro`: `$10 credit/12 hours`, priced at `Rp 50.000/month`
- `Pay as you go`: includes `50%` discount for every model

When making changes, place them in the correct product area instead of assuming all routes, pages, or features live in one app. Do not add backend logic to `main/` when it belongs in `ai/`.

For product, UX, and branding decisions, preserve that Ollama-inspired direction unless the user explicitly asks to diverge.

If a nested `AGENTS.md` exists inside a subproject, follow the repo-level context here together with the more specific local instructions in that subproject.
