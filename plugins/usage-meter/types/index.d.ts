export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Snapshot = {
  ctxTokens?: number
  ctxWindow: number
  ctxPercent?: number
  limits: Limit[]
  usd?: number
  hasUnknownPrice?: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'usage-meter': { snapshot: Shaped<Snapshot | null> }
  }
}
