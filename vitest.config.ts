import { existsSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Standalone test runner for the plugin's client suites. Specs declare the
 * jsdom environment per file with a `// @vitest-environment jsdom` pragma;
 * the default environment stays node. Forks keep jsdom Web Storage from
 * leaking across workers (`--no-webstorage`), matching the harness repo's
 * thread-safe lane.
 *
 * Published @deepseek-ai client artifacts are closure bundles for the dsh web
 * module loader — vitest cannot import them — so tests resolve them to the
 * SOURCE plane of a deepseek-harness checkout cloned as a sibling of this
 * repository (in-repo development uses tsconfig paths for the same reason).
 * Explicit aliases are required because the sources live outside this
 * project root, where paths-based plugins stop applying.
 */

/** Sibling deepseek-harness checkout providing the test-time source plane. */
const HARNESS_ROOT = fileURLToPath(new URL('../deepseek-harness/', import.meta.url))

if (!existsSync(HARNESS_ROOT)) {
  throw new Error(
    'vitest.config: no deepseek-harness checkout found at ../deepseek-harness. '
    + 'Clone it next to this repository to run tests: '
    + 'git clone https://github.com/deepseek-ai/deepseek-harness',
  )
}

/**
 * Alias every workspace package name its published manifest spells, resolved
 * to harness sources. Vendored frameworks first, then every packages/client/*
 * plugin package (bare name plus /client subpath), then the few node-face
 * packages the plugin's node half reads.
 */
function harnessAliases(): { find: RegExp, replacement: string }[] {
  const rules: { find: RegExp, replacement: string }[] = []
  const escape = (name: string): string => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const map = (specifier: string, target: string): void => {
    if (existsSync(target)) rules.push({ find: new RegExp(`^${escape(specifier)}$`), replacement: target })
  }
  map('@deepseek-ai/cordis', `${HARNESS_ROOT}vendor/cordis/src`)
  map('@deepseek-ai/cosmokit', `${HARNESS_ROOT}vendor/cosmokit/src`)
  map('@deepseek-ai/schemastery', `${HARNESS_ROOT}vendor/schemastery/src`)
  for (const dir of readdirSync(`${HARNESS_ROOT}packages/client`)) {
    map(`@deepseek-ai/dsh-client-${dir}/client`, `${HARNESS_ROOT}packages/client/${dir}/src/client`)
    map(`@deepseek-ai/dsh-client-${dir}`, `${HARNESS_ROOT}packages/client/${dir}/src`)
  }
  map('@deepseek-ai/dsh-client-test-runtime', `${HARNESS_ROOT}packages/test-support/client-runtime/src`)
  map('@deepseek-ai/dsh-invariants', `${HARNESS_ROOT}packages/runtime-diagnostics/invariants/src/index.ts`)
  map('@deepseek-ai/dsh-settings', `${HARNESS_ROOT}packages/settings/settings/src`)
  map('@deepseek-ai/dsh-settings/types', `${HARNESS_ROOT}packages/settings/settings/src/types.ts`)
  map('@deepseek-ai/dsh-session/surface', `${HARNESS_ROOT}packages/core/session/src/surface.ts`)
  map('@deepseek-ai/dsh-session/types', `${HARNESS_ROOT}packages/core/session/src/types.ts`)
  map('@deepseek-ai/dsh-host-apiproxy/api', `${HARNESS_ROOT}packages/host/apiproxy/src/api`)
  map('@deepseek-ai/dsh-llm/message', `${HARNESS_ROOT}packages/llm/llm/src/message.ts`)
  return rules
}

/** Pin one instance of React and its bridge libraries for both trees: nested copies split hook dispatchers. */
function pinnedPackageAliases(): { find: RegExp, replacement: string }[] {
  const escape = (name: string): string => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return ['react', 'react-dom', 'use-sync-external-store'].flatMap((pkg): { find: RegExp, replacement: string }[] => {
    const dir = dirname(createRequire(import.meta.url).resolve(`${pkg}/package.json`))
    return [
      { find: new RegExp(`^${escape(pkg)}$`), replacement: dir },
      { find: new RegExp(`^${escape(pkg)}/(.*)$`), replacement: `${dir}/$1` },
    ]
  })
}

export default defineConfig({
  resolve: {
    alias: [...pinnedPackageAliases(), ...harnessAliases()],
  },
  test: {
    include: ['tests/**/*.spec.{ts,tsx}'],
    pool: 'forks',
    execArgv: process.allowedNodeEnvironmentFlags.has('--webstorage') ? ['--no-webstorage'] : [],
  },
})
