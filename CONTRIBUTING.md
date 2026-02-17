# Contributing to DuoCode

Thanks for your interest in contributing to DuoCode! This guide will help you get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/DreamTeamMobile/duocode.git
cd duocode

# Install dependencies (two separate npm installs)
npm install
cd server && npm install && cd ..

# Start dev servers (frontend + signaling)
npm run dev:all
```

The frontend runs on `http://localhost:3000` and the signaling server on port `3001`.

## Project Structure

- `src/` - React frontend (TypeScript)
- `server/` - Signaling server (plain JS, not part of the TS build)
- `tests/unit/` and `src/__tests__/` - Unit tests (Vitest)
- `tests/e2e/` - E2E tests (Playwright)
- `docs/` - Documentation

## Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Run checks before committing:

```bash
npm run typecheck    # TypeScript strict mode
npm test             # Unit tests (Vitest)
npm run build        # Production build
```

4. Open a pull request against `main`

## Code Style

- TypeScript with strict mode enabled
- React functional components with hooks
- Zustand for state management
- CSS custom properties for theming (no CSS-in-JS)
- Framework-agnostic business logic in `src/services/`

## Running Tests

```bash
npm test                  # All unit tests
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage

# E2E tests (requires running dev server)
npm run dev:all           # In one terminal
npm run test:e2e          # In another terminal
```

## License

By contributing, you agree that your contributions will be licensed under the same license as the project. See [LICENSE](LICENSE) for details.
