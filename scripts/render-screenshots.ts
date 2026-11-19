import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { pillDrawing } from '../hooks/tag-drawing.ts'
import { trailDrawing } from '../hooks/trail-drawing.ts'
import type { RunPhase, SkillPill } from '../types/index.d.ts'

type Theme = 'dark' | 'light'
type Shot = { file: string; style: 'trail' | 'tags'; phase: RunPhase; theme: Theme; accent: string | null }

const WIDTH = 640
const BAND = { x: 16, y: 16, height: 40 }
const INPUT = { y: 64, height: 44 }
const HEIGHT = INPUT.y + INPUT.height + 16
const TAG_GAP = 6

const PALETTE = {
  dark: { page: '#050506', band: '#111114', inputStroke: '#2a2a30', placeholder: '#5c5c66', ink: '#f5f5f5' },
  light: { page: '#ffffff', band: '#f2f2f4', inputStroke: '#d4d4d8', placeholder: '#8a8a94', ink: '#111111' },
} as const

const PILLS: readonly SkillPill[] = [
  { name: 'how', count: 1 },
  { name: 'architect', count: 1 },
  { name: 'unit-testing', count: 2 },
]

const SHOTS: readonly Shot[] = [
  { file: 'trail-running-dark.svg', style: 'trail', phase: 'running', theme: 'dark', accent: null },
  { file: 'trail-done-dark.svg', style: 'trail', phase: 'done', theme: 'dark', accent: null },
  { file: 'trail-stopped-dark.svg', style: 'trail', phase: 'stopped', theme: 'dark', accent: null },
  { file: 'trail-running-blue-dark.svg', style: 'trail', phase: 'running', theme: 'dark', accent: '#3b82f6' },
  { file: 'trail-done-light.svg', style: 'trail', phase: 'done', theme: 'light', accent: null },
  { file: 'tags-running-dark.svg', style: 'tags', phase: 'running', theme: 'dark', accent: null },
  { file: 'tags-done-dark.svg', style: 'tags', phase: 'done', theme: 'dark', accent: null },
  { file: 'tags-done-light.svg', style: 'tags', phase: 'done', theme: 'light', accent: null },
]

function pinTheme(source: string, theme: Theme): string {
  const ink = PALETTE[theme].ink

  return source
    .replace(/@media \(prefers-color-scheme: dark\)\{.*?\}\}/, '')
    .replace(/#111111/g, ink)
}

function placed(source: string, x: number, y: number): string {
  return source.replace('<svg ', `<svg x="${x}" y="${y}" `)
}

function bandContents(shot: Shot): string {
  if (shot.style === 'trail') {
    const drawing = trailDrawing(PILLS, shot.phase, 'unit-testing', shot.accent)
    const y = BAND.y + (BAND.height - drawing.height) / 2

    return placed(pinTheme(drawing.source, shot.theme), BAND.x + 12, y)
  }

  let x = BAND.x + 10

  return PILLS.map(pill => {
    const phase = pill.name === 'unit-testing' ? shot.phase : shot.phase === 'running' ? 'done' : shot.phase
    const drawing = pillDrawing(pill, phase, shot.accent)
    const y = BAND.y + (BAND.height - drawing.height) / 2
    const svg = placed(pinTheme(drawing.source, shot.theme), x, y)
    x += drawing.width + TAG_GAP

    return svg
  }).join('')
}

function screenshot(shot: Shot): string {
  const colors = PALETTE[shot.theme]
  const inner = WIDTH - BAND.x * 2

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">` +
    `<rect width="${WIDTH}" height="${HEIGHT}" rx="12" fill="${colors.page}"/>` +
    `<rect x="${BAND.x}" y="${BAND.y}" width="${inner}" height="${BAND.height}" rx="10" fill="${colors.band}"/>` +
    bandContents(shot) +
    `<rect x="${BAND.x + 0.5}" y="${INPUT.y + 0.5}" width="${inner - 1}" height="${INPUT.height - 1}" rx="12" fill="none" stroke="${colors.inputStroke}"/>` +
    `<text x="${BAND.x + 16}" y="${INPUT.y + 27}" font-family="system-ui, 'Segoe UI', sans-serif" font-size="14" fill="${colors.placeholder}">Type / for commands</text>` +
    `</svg>`
  )
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs')
mkdirSync(outDir, { recursive: true })

for (const shot of SHOTS) {
  writeFileSync(join(outDir, shot.file), screenshot(shot))
  console.log(`wrote docs/${shot.file}`)
}
