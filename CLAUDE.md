# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Twilight Imperium battle simulator built with React, TypeScript, and Vite. The project uses modern React 19 with the React Compiler enabled for automatic optimization.

## Development Commands

```bash
# Start development server with HMR
npm run dev

# Type-check and build for production
npm run build

# Lint the codebase
npm run lint

# Format code with Prettier
npm run format

# Check code formatting without modifying
npm run format:check

# Preview production build locally
npm run preview
```

## Tech Stack

- **React 19.2**: Latest React with compiler optimization enabled
- **TypeScript 5.9**: Strict mode enabled with comprehensive linting rules
- **Vite 7**: Build tool with Fast Refresh via @vitejs/plugin-react
- **Tailwind CSS 4**: Latest utility-first CSS framework with CSS-first configuration and automatic class sorting via Prettier plugin
- **ESLint 9**: Using flat config format with recommended rules for React/TypeScript
- **Prettier 3**: Code formatting with single quotes, 80 char width, no semicolons

## Build Configuration

### TypeScript

- Project uses TypeScript project references (tsconfig.app.json and tsconfig.node.json)
- Strict mode enabled with noUnusedLocals and noUnusedParameters
- Bundler module resolution
- Target: ES2022

### Vite

- React plugin configured with babel-plugin-react-compiler
- React Compiler is enabled globally (impacts dev/build performance but optimizes React rendering)

### ESLint

- Flat config format (eslint.config.js)
- Extends @eslint/js recommended, typescript-eslint recommended, react-hooks flat recommended
- Browser globals configured
- Ignores dist directory
- Integrated with eslint-config-prettier to disable conflicting formatting rules

### Prettier

- Single quotes, no semicolons
- 80 character line width
- 2 space indentation
- LF line endings
- Arrow function parens: avoid
- prettier-plugin-tailwindcss for automatic class sorting

### Tailwind CSS

- **Tailwind v4**: Uses CSS-first configuration with `@import 'tailwindcss'` in CSS files
- **PostCSS Plugin**: Uses `@tailwindcss/postcss`
- **Theme Customization**: CSS variables defined in `src/index.css` using `@layer base`
- **Dark Mode**: Class-based dark mode support (.dark class)
- **Path Aliases**: `@/` points to `src/` for clean imports
- **UI Components**: Custom components in `src/components/ui/` (select and sheet use Radix primitives)
- **Styling**: Uses `clsx` directly for conditional class merging

## Code Conventions

- **Utilities**: One utility function per file in `src/utils/` (e.g., `getFactionUnitConfig.ts`)
- Console methods like info, time and timeEnd are find in production code, everything else — not
- All abilities test located in src/tests. If test is for a combination of abilities all abilities should be in filename with + between abilites, names sorted alphabetically. I.e. «cavalry+gravleash-maneuvers.test.ts»
- Don't add explicit type annotations for callback parameters when TypeScript can infer them (e.g. ability `isCallable`/`call` callbacks get types from the `Ability<Params>` generic)

## Abilities

For abilities info — read `docs/abilities-list.md`.
When implementing a new ability, read `docs/abilities.md` first — it contains the full development guide with API reference, patterns, and code examples.
After implementation mark ability as done in `docs/abilities-list.md`.

## Combat System

For phase system, ability timings, unit stats, factions, and ability keys — read `docs/overview.md`.

## Ability Testing

When writing or modifying ability tests, read `docs/testing.md` first — it contains the full testing guide with API reference, test patterns, and code examples.
