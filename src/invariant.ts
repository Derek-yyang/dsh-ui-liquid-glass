/**
 * Package-owned invariant companion for `dsh-ui-liquid-glass`.
 * @module dsh-ui-liquid-glass/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = 'dsh-ui-liquid-glass'

/** Cordis companion plugin name. */
export const name = 'client-ui-liquid-glass-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the overlay controller's preference↔DOM↔token-layer
 * consistency is applied synchronously in one `#apply` step and asserted
 * directly by this package's controller specs; a runtime check would race the
 * HMR window where the old fiber's teardown and the new fiber's start are
 * only separately atomic, failing on a state no observer can observe.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
