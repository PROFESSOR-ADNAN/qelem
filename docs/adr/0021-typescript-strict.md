# ADR 0021: Strict TypeScript Across Entire Codebase and Monorepo

## Status
Accepted

## Context
A mission-critical distributed feed architecture with cursor serialization, batched hydration, queue payloads, and shared validation schemas requires end-to-end type safety to prevent runtime `undefined` errors and cursor tampering.

## Decision
1. Standardize on TypeScript (strict mode enabled: `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`) across all workspaces:
   - `packages/shared`: Shared Zod schemas, domain models, cursor serialization, and constants.
   - `server`: Express API, Mongoose models, and services.
   - `worker`: BullMQ processors and scheduler.
   - `web`: React Vite PWA.
   - `tests`: Integration, unit, and property tests.
2. Share validation schemas between frontend and backend via `packages/shared`, ensuring that frontend form validation and backend route validation use the identical Zod contracts.

## Consequences
- Compile-time prevention of null dereferences, payload mismatches, and data schema regressions.
- Complete contract synchronization across client, API, and background workers.
