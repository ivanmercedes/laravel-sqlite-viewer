---
trigger: always_on
---

# Code Style Guide

## Core Rules

* Write **clear, minimal, maintainable** code.
* Optimize for **MVP first**, not features.
* **Read-only access is the default.**
* Data mutation is allowed **only** through an explicit and controlled **Edit Mode**.
* Never introduce implicit or unsafe write behavior.


## Language & Tools

* **TypeScript (strict mode)**
* Node.js APIs compatible with VS Code extensions

## Structure

* One responsibility per file.
* No “god” files.
* Core logic lives in services (DB, schema, queries).

## Naming

* Classes: `PascalCase`
* Functions / variables: `camelCase`
* Constants: `UPPER_SNAKE_CASE`
* Files: `camelCase.ts`

## Type Safety

* No `any`.
* Always use explicit parameter and return types.
* Use interfaces for data shapes.

## Database Rules (Critical)

* SQLite opens in **read-only by default**.
* A separate **Edit Mode** must be explicitly enabled by the user.
* All SQL must go through `QueryGuard`.
* Queries are classified as:

  * READ (`SELECT`, `WITH`)
  * WRITE (`INSERT`, `UPDATE`, `DELETE`)
  * SCHEMA (`CREATE`, `ALTER`, `DROP`)
* Only one statement per execution.
* Destructive operations require explicit confirmation.
* SCHEMA queries are **disabled by default** and gated behind feature flags.

## Queries & Performance

* Always use pagination (`LIMIT / OFFSET`).
* Never load full tables into memory.
* Cache schema per DB session.

## Errors & Logging

* Never fail silently.
* Clear, actionable error messages.
* Centralized logging only.

## Webview Rules

* Webview is UI-only.
* Communicate via `postMessage`.
* No filesystem or DB access from Webview.

## External Knowledge Rule (Context7)

* Always use **Context7** when accurate, up-to-date, or framework-specific information is required.
* Context7 is **mandatory** for:

  * Library or framework APIs
  * VS Code Extension APIs
  * SQLite internals and pragmas
  * Security-sensitive behavior
  * Best practices that may change over time
* Do **not** rely on assumptions or outdated knowledge when Context7 is applicable.
* If Context7 is unavailable or insufficient, explicitly state the limitation before proceeding.

## Forbidden / Restricted Practices (Updated)

* Write queries without Edit Mode enabled
* Schema-altering queries (`DROP`, `ALTER`, `TRUNCATE`) outside explicit confirmation or feature flags
* Direct database access outside dedicated services
* Use of `any` types
* Blocking operations on the extension thread
* Implicit or silent data mutations
* Overengineering beyond MVP scope

## Definition of Done

* Clear and understandable
* MVP-appropriate
* No performance regression
* Edit Mode safety guarantees preserved
* No implicit writes introduced

