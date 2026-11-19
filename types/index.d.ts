export type SkillPill = {
  name: string
  count: number
}

export type RunPhase = 'running' | 'done' | 'stopped'

export type BandStyle = 'trail' | 'tags'

declare module 'claude-code' {
  interface PluginState {
    'breadcrumbs': {
      runPills: readonly SkillPill[]
      phase: RunPhase
      lastSkill: string | null
      style: BandStyle
      accent: string | null
    }
  }
}
