# Contributing to Godbound Toolkit

Thank you for your interest in contributing! Please read this guide before opening a pull request.

## Branch Protection Rules

The `main` branch is protected. You **cannot** push to it directly. All changes must go through a pull request that:

1. Passes the **CI checks** (Node.js dependency install + basic validation)
2. Is **approved by the repository owner** (@UKFatGuy) — enforced by `CODEOWNERS`

To contribute:

```
git checkout -b my-feature-branch
# make your changes
git push origin my-feature-branch
# open a Pull Request on GitHub
```

## Development Setup

```bash
# Install dependencies
npm install

# Start the local server
npm start
# → http://localhost:3000

# Or run with Docker
docker compose up
```

## Code Style

- Plain JavaScript — no build step, no bundler
- Follow the patterns used in the existing `js/` modules (IIFE modules, `'use strict'`)
- The current modules are: `utils`, `storage`, `theme`, `dice`, `combat`, `character`, `dataeditor`, `importexport`, `print`, `app`
- Keep CSS changes inside the existing variable / theming system in `css/styles.css`
- Do **not** commit files from the `data/` directory (user data, already in `.gitignore`)
- Do **not** commit files from the `Reference/` directory

## Pull Requests

Use the pull request template that appears automatically when you open a PR. Fill in every section honestly — incomplete PRs will be asked for clarification before review.

## Reporting Bugs

Use the **Bug Report** issue template. Include steps to reproduce, expected behaviour, and actual behaviour.

## Requesting Features

Use the **Feature Request** issue template.

## Security Issues

See [SECURITY.md](SECURITY.md) — **do not** open a public issue for security vulnerabilities.
