import type { RunPhase, SkillPill } from '../types'

const HEIGHT = 22
const RADIUS = 5
const FONT_SIZE = 12
const CHAR_WIDTH = 7
const SIDE_PADDING = 8
const GAP = 6
const GLYPH_SLOT = 10

const INK_LIGHT = '#111111'
const INK_DARK = '#f5f5f5'
const OUTLINE = '#888888'
const DONE = '#22a559'
const FONT_FAMILY = "ui-monospace, 'Cascadia Mono', Consolas, 'SF Mono', Menlo, monospace"

const THEME_STYLE =
  `<style>.name{fill:${INK_LIGHT}}.ink{stroke:${INK_LIGHT}}` +
  `@media (prefers-color-scheme: dark){.name{fill:${INK_DARK}}.ink{stroke:${INK_DARK}}}</style>`

export type PillDrawing = { source: string; alt: string; width: number; height: number }

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function altText(pill: SkillPill, runPhase: RunPhase): string {
  const uses = pill.count > 1 ? `, used ${pill.count} times` : ''
  const state = runPhase === 'done' ? '' : `, ${runPhase}`

  return `${pill.name}${uses}${state}`
}

function glyph(runPhase: RunPhase, x: number, cy: number, accent: string | null): string {
  if (runPhase === 'running') {
    const paint = accent === null ? 'class="name"' : `fill="${accent}"`

    return (
      `<circle cx="${x + GLYPH_SLOT / 2}" cy="${cy}" r="3" ${paint}>` +
      `<animate attributeName="opacity" values="1;0.35;1" dur="1.4s" repeatCount="indefinite"/>` +
      `</circle>`
    )
  }

  if (runPhase === 'stopped') {
    return `<path data-icon="stopped" class="ink" opacity="0.6" d="M${x + 1.5} ${cy} h7" stroke-width="1.5" stroke-linecap="round"/>`
  }

  return `<path data-icon="check" d="M${x + 0.5} ${cy + 0.3} l2.8 2.9 l5.2-6" fill="none" stroke="${DONE}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`
}

export function pillDrawing(pill: SkillPill, runPhase: RunPhase, accent: string | null): PillDrawing {
  const isRunning = runPhase === 'running'
  const middle = HEIGHT / 2
  const baseline = middle + FONT_SIZE / 3
  const label = pill.name
  const nameX = SIDE_PADDING + GLYPH_SLOT + GAP
  const nameWidth = Math.ceil(label.length * CHAR_WIDTH)
  const hasCount = pill.count > 1
  const digits = String(pill.count)
  const countX = nameX + nameWidth + GAP
  const contentEnd = hasCount ? countX + Math.ceil(digits.length * CHAR_WIDTH) : nameX + nameWidth
  const width = contentEnd + SIDE_PADDING
  const nameOpacity = isRunning ? '1' : '0.6'

  const count = hasCount
    ? `<text class="name" opacity="0.45" x="${countX}" y="${baseline}" font-family="${FONT_FAMILY}" font-size="${FONT_SIZE}">${digits}</text>`
    : ''

  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEIGHT}" viewBox="0 0 ${width} ${HEIGHT}">` +
    THEME_STYLE +
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${HEIGHT - 1}" rx="${RADIUS}" fill="none" stroke="${OUTLINE}" stroke-opacity="${isRunning ? 0.55 : 0.3}"/>` +
    glyph(runPhase, SIDE_PADDING, middle, accent) +
    `<text class="name" opacity="${nameOpacity}" x="${nameX}" y="${baseline}" font-family="${FONT_FAMILY}" font-size="${FONT_SIZE}">${escapeXml(label)}</text>` +
    count +
    `</svg>`

  return { source, alt: altText(pill, runPhase), width, height: HEIGHT }
}
