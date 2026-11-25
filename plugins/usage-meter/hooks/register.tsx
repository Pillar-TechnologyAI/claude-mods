import { atom, read, update } from 'claude-code'
import type { Register, SessionContextUsage, SessionCost, SessionRateLimit } from 'claude-code'

import type { Snapshot } from '../types'

const snapshot = atom({ plugin: 'usage-meter', key: 'snapshot' } as const, null, { shape: 'snap-1' })

const bar = (pct: number, width = 8): string => {
  const filled = Math.round((Math.min(100, Math.max(0, pct)) / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}
const tone = (pct: number): string => (pct >= 90 ? 'red' : pct >= 70 ? 'yellow' : 'green')
const LABELS: Record<string, string> = { five_hour: '5h', seven_day: 'wk', spend_limit: 'spend' }
const label = (kind: string): string => LABELS[kind] ?? kind.replace(/_/g, ' ')
const resets = (iso: string | undefined, now: number): string => {
  if (!iso) return ''
  const ms = Date.parse(iso) - now
  if (!Number.isFinite(ms) || ms <= 0) return ''
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h >= 24 ? ` (${Math.floor(h / 24)}d${h % 24}h)` : ` (${h}h${m}m)`
}

// How long each window lasts, so the time already spent in it can be worked out
// from resetsAt. A window of unknown length gets no projection.
const WINDOW_MS: Record<string, number> = { five_hour: 5 * 3_600_000, seven_day: 7 * 86_400_000 }
// Ignore the first tenth of a window: a few minutes in, one burst projects wildly.
const MIN_ELAPSED_SHARE = 0.1

type Pace = { isOnTrackToRunOut: boolean; runsOutInMs?: number }

// Projects the window's average burn so far out to its reset.
const pace = (kind: string, pct: number, iso: string | undefined, now: number): Pace => {
  const windowMs = WINDOW_MS[kind]
  const resetAt = iso ? Date.parse(iso) : NaN
  if (!windowMs || !Number.isFinite(resetAt) || pct <= 0) return { isOnTrackToRunOut: false }
  const remaining = resetAt - now
  const elapsed = windowMs - remaining
  if (remaining <= 0 || elapsed < windowMs * MIN_ELAPSED_SHARE) return { isOnTrackToRunOut: false }
  const perMs = pct / elapsed
  const runsOutInMs = (100 - pct) / perMs
  return { isOnTrackToRunOut: runsOutInMs < remaining, runsOutInMs }
}
const span = (ms: number): string => {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return h >= 24 ? `${Math.floor(h / 24)}d${h % 24}h` : `${h}h${m}m`
}

type Figures ={ context: SessionContextUsage; rateLimits: SessionRateLimit[]; cost?: SessionCost }

const toSnapshot = (u: Figures): Snapshot => ({
  ctxTokens: u.context.tokens,
  ctxWindow: u.context.window,
  ctxPercent: u.context.percent,
  limits: u.rateLimits.map(r => ({ kind: r.kind, percentUsed: r.percentUsed, resetsAt: r.resetsAt })),
  usd: u.cost?.usd,
  hasUnknownPrice: u.cost?.hasUnknownPrice === true,
})

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const ran = await next(e)
    try {
      const snap = toSnapshot(await $.session.usage())
      await update($, snapshot, () => snap)
    } catch {
      // No figures yet; the first session.measure fills them in.
    }
    return ran
  })

  on('session.measure', async ($, e, next) => {
    const snap = toSnapshot(e)
    await update($, snapshot, () => snap)
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const snap = await read($, snapshot)
    if (e.props.hasSurvey || snap === null) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const now = await $.clock.now()
    const ctxPct = snap.ctxPercent ?? 0

    return (
      <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
        <Text>
          <Text dimColor>ctx </Text>
          <Text color={tone(ctxPct)}>{bar(ctxPct)}</Text>
          <Text> {Math.round(ctxPct)}%</Text>
        </Text>
        {snap.limits.map(l => {
          const p = pace(l.kind, l.percentUsed, l.resetsAt, now)
          const color =
            l.percentUsed >= 90 ? 'red' : p.isOnTrackToRunOut ? 'yellow' : tone(l.percentUsed)
          return (
            <Text>
              <Text dimColor>{label(l.kind)} </Text>
              <Text color={color}>{bar(l.percentUsed, 6)}</Text>
              <Text> {Math.round(l.percentUsed)}%</Text>
              <Text dimColor>{resets(l.resetsAt, now)}</Text>
              {p.isOnTrackToRunOut && p.runsOutInMs !== undefined && (
                <Text color="yellow"> out in ~{span(p.runsOutInMs)}</Text>
              )}
            </Text>
          )
        })}
        {snap.usd !== undefined && (
          <Text dimColor>
            ~${snap.usd.toFixed(snap.usd < 1 ? 3 : 2)} est{snap.hasUnknownPrice ? '*' : ''}
          </Text>
        )}
      </Box>
    )
  })
}
