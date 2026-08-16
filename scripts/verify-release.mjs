#!/usr/bin/env node
// ARRIYIA PIP — Production Truth reconciliation, P1 process hardening.
//
// Everything this project's own history shows fell out of sync before a
// deploy was ever caught by a single check: git state, TypeScript, lint,
// build, and whether the routes a release depends on actually exist in
// the current tree. This script runs all of them in one pass and prints
// an explicit LOCAL / REMOTE split — it never claims a REMOTE check
// passed just because the LOCAL ones did. Network-dependent state
// (Vercel's deployed commit, Supabase's applied-migration history,
// live entitlement resolution) cannot be verified from a checkout alone
// and is always reported as REMOTE REQUIRED, not silently skipped.
//
// Run before pushing a release, not as part of `npm test` (it shells out
// to tsc/oxlint/vite build, each already its own script — this is the
// one-command wrapper that runs all of them plus the checks none of them
// individually cover).

import { execSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')

function run(cmd, opts = {}) {
  try {
    const output = execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts })
    return { ok: true, output }
  } catch (err) {
    return { ok: false, output: (err.stdout ?? '') + (err.stderr ?? '') }
  }
}

const results = []
function report(section, ok, detail) {
  results.push({ section, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${section}${detail ? ` — ${detail}` : ''}`)
}

console.log('=== LOCAL CHECKS ===\n')

// 1. Clean working tree
const status = run('git status --short')
report('Working tree clean', status.ok && status.output.trim() === '', status.output.trim() ? `${status.output.trim().split('\n').length} uncommitted change(s)` : undefined)

// 2. Branch + HEAD
const branch = run('git branch --show-current').output.trim()
const head = run('git rev-parse HEAD').output.trim()
console.log(`INFO  Branch: ${branch}`)
console.log(`INFO  HEAD: ${head}`)

// 3. origin/main alignment — best-effort fetch, never fatal if network is unavailable
const fetch = run('git fetch origin main', { stdio: ['ignore', 'pipe', 'pipe'] })
if (fetch.ok) {
  const ahead = run('git rev-list --count origin/main..HEAD').output.trim()
  const behind = run('git rev-list --count HEAD..origin/main').output.trim()
  report('origin/main alignment', ahead === '0' && behind === '0', ahead !== '0' || behind !== '0' ? `${ahead} ahead, ${behind} behind` : 'HEAD == origin/main')
} else {
  console.log('SKIP  origin/main alignment — could not fetch (no network access in this environment)')
}

// 4. TypeScript
const tsc = run('npx tsc -b')
report('TypeScript (tsc -b)', tsc.ok, tsc.ok ? undefined : 'see output above')
if (!tsc.ok) console.log(tsc.output)

// 5. Lint
const lint = run('npx oxlint')
report('Lint (oxlint)', lint.ok, lint.ok ? undefined : 'see output above')
if (!lint.ok) console.log(lint.output)

// 6. Build
const build = run('npx vite build')
report('Production build (vite build)', build.ok, build.ok ? undefined : 'see output above')
if (!build.ok) console.log(build.output)

// 7. Route integrity — the exact class of drift that made History invisible
// earlier this project's history: a route/nav entry that's in the working
// tree but was never actually reachable, or vice versa. Not exhaustive —
// spot-checks the routes this project's own release history has actually
// gotten wrong, so this list should grow as new surfaces ship.
const REQUIRED_ROUTES = ["'research'", "'planning'", "'decisions'", "'actions'", "'executions'", "'history'", "'history/records/:recordId'", "'history/journeys/:journeyId'"]
let routerSource = ''
try {
  routerSource = readFileSync(join(ROOT, 'src/app/router.tsx'), 'utf8')
} catch {
  // handled below — missingRoutes will include everything
}
const missingRoutes = REQUIRED_ROUTES.filter((r) => !routerSource.includes(r))
report('Route integrity (router.tsx)', missingRoutes.length === 0, missingRoutes.length ? `missing: ${missingRoutes.join(', ')}` : `${REQUIRED_ROUTES.length}/${REQUIRED_ROUTES.length} required routes present`)

// 8. Migration inventory — count only; whether each is *applied* to
// production is never knowable from the repo, see REMOTE REQUIRED below.
let migrationCount = 0
try {
  migrationCount = readdirSync(join(ROOT, 'supabase/migrations')).filter((f) => f.endsWith('.sql')).length
} catch {
  // no migrations directory — leave at 0, reported below
}
console.log(`INFO  ${migrationCount} migration file(s) in supabase/migrations/`)

console.log('\n=== REMOTE REQUIRED (cannot be verified from this checkout) ===\n')
console.log('REMOTE REQUIRED  Vercel production deployment commit matches HEAD')
console.log('REMOTE REQUIRED  All migration files recorded as applied in supabase_migrations.schema_migrations')
console.log('REMOTE REQUIRED  Live entitlement resolution (has_feature) for each Pro Intelligence capability')
console.log('REMOTE REQUIRED  Authenticated smoke test of each product surface')

const localFailed = results.filter((r) => !r.ok)
console.log('\n=== SUMMARY ===\n')
if (localFailed.length === 0) {
  console.log('LOCAL PASS — all local checks passed. Remote verification (above) still required before declaring the release GREEN.')
} else {
  console.log(`LOCAL FAIL — ${localFailed.length} check(s) failed: ${localFailed.map((r) => r.section).join(', ')}`)
  process.exit(1)
}
