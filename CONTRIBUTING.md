# Contributing

Thanks for your interest in WardayaCode!

## How to Contribute

1. **Fork** the repo
2. Create a **feature branch** from `develop`
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/my-feature
   ```
3. **Write code** — follow the conventions in [CLAUDE.md](CLAUDE.md)
4. **Run tests**
   ```bash
   npm run type-check
   npm run lint
   npm run test:run
   ```
5. **Commit** — use conventional commits (`feat:`, `fix:`, `docs:`, `test:`, etc.)
6. **Push** and open a PR into `develop`

## PR Guidelines

- Keep PRs focused on one thing
- Write clear commit messages
- Add tests for new functionality
- Run the full test suite before requesting review
- Reference any related issues

## Code Conventions

- **Imports**: use `.js` extensions (ESM, `"type": "module"`)
- **TypeScript**: strict mode with `noUncheckedIndexedAccess` — guard array/object access
- **Tests**: Vitest with globals enabled, tests live in `tests/`
- **ESLint**: run `npm run lint -- --fix` before committing

## Getting Help

Open an issue or start a discussion on GitHub.
