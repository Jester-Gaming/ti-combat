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
- **shadcn/ui**: Copy-paste component library built on Radix UI primitives with Tailwind styling
- **ESLint 9**: Using flat config format with recommended rules for React/TypeScript
- **Prettier 3**: Code formatting with single quotes, 80 char width, and semicolons

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

- Single quotes, semicolons enabled
- 80 character line width
- 2 space indentation
- LF line endings
- Arrow function parens: avoid
- prettier-plugin-tailwindcss for automatic class sorting

### Tailwind CSS & shadcn/ui

- **Tailwind v4**: Uses CSS-first configuration with `@import 'tailwindcss'` in CSS files
- **Configuration**: Minimal JS config in `tailwind.config.js` (content paths only)
- **PostCSS Plugin**: Uses `@tailwindcss/postcss` instead of the legacy plugin
- **Theme Customization**: CSS variables defined in `src/index.css` using `@layer base`
- **Dark Mode**: Class-based dark mode support (.dark class)
- **Path Aliases**: `@/` points to `src/` for clean imports
- **Component Library**: shadcn/ui components located in `src/components/ui/`
- **Available Components**: button, card, select, input, badge, table
- **Adding Components**: Use `npx shadcn@latest add [component-name]`
- **Styling Utility**: Use `cn()` from `@/lib/utils` to merge Tailwind classes

#### Usage Examples

```tsx
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Basic button usage
<Button>Click me</Button>
<Button variant="outline">Outlined</Button>

// Custom styling with cn()
<div className={cn('base-class', 'conditional-class', customClass)} />
```

## Code Conventions

- **Utilities**: One utility function per file in `src/utils/` (e.g., `getFactionUnitConfig.ts`)
- Console methods like info, time and timeEnd are find in production code, everything else — not
- All abilities test located in src/tests. If test is for a combination of abilities all abilities should be in filename with + between abilites, names sorted alphabetically. I.e. «cavalry+gravleash-maneuvers.test.ts»
- Don't add explicit type annotations for callback parameters when TypeScript can infer them (e.g. ability `isCallable`/`call` callbacks get types from the `Ability<Params>` generic)

## Architecture Notes

The project is currently in scaffolding phase with standard Vite + React template structure. As the battle simulator grows, expect:

- Game state management for battle simulation
- Unit types, abilities, and combat mechanics
- Dice rolling and probability calculations
- UI components for unit selection and battle visualization

## Abilities

For abilities info — read `docs/abilities-list.md`.
When implementing a new ability, read `docs/abilities.md` first — it contains the full development guide with API reference, patterns, and code examples.
After implementation mark ability as done in `docs/abilities-list.md`.

## Combat System

For phase system, ability timings, unit stats, factions, and ability keys — read `docs/overview.md`.

## Ability Testing

When writing or modifying ability tests, read `docs/testing.md` first — it contains the full testing guide with API reference, test patterns, and code examples.
