/**
 * Shared browser platform modules this plugin expects the dsh web shell to
 * seed into the frozen module table. Mirrors
 * `packages/client/web/src/platform.ts` of the host generation this plugin
 * targets; re-sync when targeting a newer host.
 * @module build/platform
 */

/** The module specifiers the shell shares into the frozen module table. */
export const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
] as const

/** Client-bundle specifiers whose factories the parser preloads before the shell starts. */
export const PRELOADED_CLIENT_EXTERNALS = [
  '@deepseek-ai/dsh-client-runtime/client',
] as const
