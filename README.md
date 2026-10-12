# Undead Slayer: Chronicles

A Next.js action RPG with 10 heroes, 5 chapters, database-backed accounts and persistent game saves.

## Run locally

Requires Node.js 22+.

```bash
npm ci
npm run dev
```

Open `http://localhost:3000` and create an account. **No database credentials or separate database server are needed for local development.** The first request initializes a real PostgreSQL-compatible [PGlite](https://github.com/electric-sql/pglite) database at `data/undead-slayer`. Accounts and progress survive browser refreshes, logout/login, and server restarts. This is server-side SQL storage, not an in-memory mock or `localStorage`.

`data/`, environment files, browser traces and caches are Git-ignored. Never commit database files or credentials. Back up the local data directory while the server is stopped.

## Database setup and deployment

Copy `.env.example` to `.env.local` if you need custom configuration.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | A PostgreSQL connection URL. When supplied, it takes priority over `POSTGRES_URL` and embedded storage. Use the TLS/pooling options provided by your database host. |
| `POSTGRES_URL` | Alternative connection variable supplied by Vercel PostgreSQL integrations. Used when `DATABASE_URL` is empty or absent. |
| `PGLITE_DATA_DIR` | Persistent embedded database directory. Optional in development; **explicitly required** to use embedded storage with `next start`. |

### Hosted / serverless production

1. Connect/provision a PostgreSQL database in your hosting project (for Vercel, use its database integration settings).
2. Set `DATABASE_URL` **or** `POSTGRES_URL` for the **Production** environment (and Preview if you use preview deployments). Keep the connection value in your hosting settings, never in chat, source code, or a `NEXT_PUBLIC_` variable.
3. Deploy the updated commit to the branch that the production project builds. Redeploying an older `main` commit will not include changes made only in an Arena workspace or unmerged pull request.
4. Check `/api/health`: it must return `{"ok":true,"database":"postgresql","persistent":true}`.

A hosted database is **not automatically provisioned** by this repository. Vercel/AWS Lambda cannot use embedded storage: their ephemeral filesystems must not be mistaken for durable player saves. Missing or unavailable production configuration returns HTTP 503 and an actionable retry screen instead of pretending the game is ready. The branded loading screen renders before the database request, even if that request fails.

### Troubleshooting sign-in database errors

A raw `Failed query: select ... from users` error is **not** a wrong game passphrase. Older deployments swallowed schema-setup errors and then exposed the next SQL failure. Deploy the updated code; startup applies migrations atomically and fails safely if setup is not possible.

`/api/health` reports `schemaReady: true` only after the required account, session and progress columns are verified. Failures return HTTP 503 with a safe diagnostic `code` (no query, parameters, database URL or password hash):

| Code | Owner action |
| --- | --- |
| `DATABASE_NOT_CONFIGURED` | Set `DATABASE_URL` or `POSTGRES_URL` in the correct Vercel **Production / Preview** environment and redeploy that environment. |
| `DATABASE_SCHEMA_NOT_READY` | Deploy the included `drizzle/` migrations and apply `npm run db:setup` in a trusted environment configured with that database URL. Do not delete accounts or reset the database. |
| `DATABASE_PERMISSION_DENIED` | Use a database role allowed to create/migrate the game's schema and read/write its tables. |
| `DATABASE_CREDENTIALS_REJECTED` | Check the private PostgreSQL connection URL in hosting settings. This is distinct from the player's game passphrase. |
| `DATABASE_TLS_ERROR` | Use the database provider's TLS connection settings; do not disable certificate verification. |
| `DATABASE_CONNECTION_FAILED` | Check database availability, connection limits and the connection URL, then retry. |

Keep credentials in hosting settings, not chat or Git. Server logs contain only diagnostic codes; the client also redacts raw errors from older APIs. Redeploying an old commit will still run the old sign-in handler. The initial eight-second intro and resilient artwork fallbacks from the updated `main` branch are retained alongside the pixel-art presentation.

### Single-server production

For one Node process on a server with persistent disk:

```bash
npm run build
PGLITE_DATA_DIR=data/undead-slayer npm run start
```

For containers, point `PGLITE_DATA_DIR` at a persistent mounted volume. **Do not run multiple processes against the same embedded database directory**, including the setup CLI while the game is running. Use external PostgreSQL for replicas, serverless, or concurrent processes. The build itself never needs a live database.

### Schema and migrations

The same Drizzle schema and versioned SQL migrations work with both database drivers:

- `users`: unique usernames and bcrypt password hashes.
- `sessions`: hashed opaque tokens, account ownership and 30-day expiry; logout revokes the token.
- `game_progress`: coins, XP, potions, hero unlocks/selection, stage progress, upgrades, equipment and settings.

Migrations in `drizzle/` run automatically before the first database request. Initialization is shared across routes; PostgreSQL migration application uses a transaction-scoped advisory lock across server instances, compatible with transaction poolers such as Neon/PgBouncer. The initial migration safely adopts the previous unversioned tables without deleting existing saves. Legacy users missing creation/update timestamps are repaired without replacing credentials or progress. Required tables and columns are verified before any sign-in query. Older, unsigned identity cookies require signing in again.

```bash
npm run db:setup       # Initialize/apply migrations, then close the connection
npm run db:generate    # Generate a migration after editing src/db/schema.ts
```

Stop a local embedded game server before running `db:setup`. Restart the game after adding migrations. Review generated SQL, back up production data, and apply migrations before deploying schema changes.

The save API validates payloads and derives ownership only from the session. Registration creates the account and starter save in one transaction. Gameplay is still client-driven single-player logic; save validation is not an authoritative multiplayer anti-cheat system.

## Loading and saving

- `src/app/loading.tsx` provides the server-rendered route fallback before JavaScript is ready.
- Startup checks the database/session and decodes bundled portraits before showing the login screen or saved game.
- Sign-in/registration have full-screen loading feedback.
- Starting a stage loads the combat code and decodes hero/enemy/boss artwork **before** the simulation mounts. Failed loads can be retried or cancelled.
- The progress bar reflects completed tasks; network waits are indeterminate. The loading screen remains visible for at least 8 seconds on startup and 1 second during authentication/battle entry, so fast cached loads don't hide it. Slow loads don't incur an additional full delay, and cancelling battle entry cancels the completion wait.
- Loading has accessible status/progress announcements, small-screen layouts and reduced-motion support. The screen itself uses only CSS/vector artwork, so it does not wait on external assets.
- Autosaves are serialized. Only successful responses show “Progress saved”; failures retain local edits and display a retry action. Signing out waits for saves and refuses to discard failed ones. Expired sessions can sign in again without replacing pending progress.

## Pixel-art presentation

The entire game uses the same retro pixel-art visual system, including authentication, loading, sanctuary menus, every modal, portraits, combat, enemies, bosses, terrain, pickups and spell effects.

- `pixelChibi.ts` and `pixelCreatures.ts` draw integer-grid, limited-palette sprites. Menu portraits are generated as 40×40 SVG bitmaps using the same brush and definitions as battle sprites; no external artwork is needed.
- `PixelIcons.tsx` supplies hand-drawn bitmap icons instead of smooth vector icons or platform-dependent emoji.
- The battle canvas renders to a 450×280 framebuffer and enlarges with nearest-neighbour rendering. Simulation, collision, targeting and touch coordinates still use the original 900×560 world, so presentation resolution does not change gameplay.
- Pixelify Sans and Press Start 2P are bundled locally via Fontsource: no Google Fonts requests. Their SIL Open Font Licenses are included in `public/licenses/`.
- Square panels, stepped shadows, pixel landscapes, readable form text, visible keyboard focus and reduced-motion support are shared across screens.

## Verification

```bash
npm run test          # Includes a temporary native PostgreSQL cluster; never tests a hosted database
npm run typecheck
npm run lint          # Existing portrait <img> optimization warnings are non-blocking
npm run build

npx playwright install chromium
npm run test:e2e      # Stop your dev server first; uses an isolated local test database
```

Browser tests cover startup/retry, registration/login/logout, saved progress restoration, failed-save recovery, rapid purchases, expired sessions, battle loading/artwork failures, mobile/reduced-motion behavior, safe sign-in errors, API ownership/token checks, pixel portraits/poses, bundled fonts, all menu windows, framebuffer scaling, and mobile pixel layouts.

To test an existing development preview instead of starting a test server:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e
```

This creates randomly named test accounts in that server's database. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` optionally selects an already-installed Chromium binary.
