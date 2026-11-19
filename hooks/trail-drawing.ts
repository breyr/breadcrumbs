import type { RunPhase, SkillPill } from '../types'

const HEIGHT = 20
const BASELINE = 14
const FONT_SIZE = 12
const CHAR_WIDTH = 7.2
const GAP = 7
const SHIMMER_WIDTH = 48
const SHIMMER_SECONDS = 1.6

const INK_LIGHT = '#111111'
const INK_DARK = '#f5f5f5'
const DONE = '#22a559'
const FONT_FAMILY = "ui-monospace, 'Cascadia Mono', Consolas, 'SF Mono', Menlo, monospace"

const THEME_STYLE =
  `<style>.ink{fill:${INK_LIGHT}}.ink-stop{stop-color:${INK_LIGHT}}.ink-line{stroke:${INK_LIGHT}}` +
  `@media (prefers-color-scheme: dark){.ink{fill:${INK_DARK}}.ink-stop{stop-color:${INK_DARK}}.ink-line{stroke:${INK_DARK}}}</style>`

export type TrailDrawing = { source: string; alt: string; width: number; height: number }

type Piece = { svg: string; width: number }

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function textWidth(text: string): number {
  return Math.ceil(text.length * CHAR_WIDTH)
}

function text(x: number, content: string, attributes: string): string {
  return `<text x="${x}" y="${BASELINE}" font-family="${FONT_FAMILY}" font-size="${FONT_SIZE}" ${attributes}>${escapeXml(content)}</text>`
}

function shimmer(x: number, width: number, accent: string | null): string {
  const sweep = (from: number, to: number, attribute: string) =>
    `<animate attributeName="${attribute}" from="${from}" to="${to}" dur="${SHIMMER_SECONDS}s" repeatCount="indefinite"/>`
  const highlight = accent === null ? 'class="ink-stop"' : `stop-color="${accent}"`

  return (
    `<defs><linearGradient id="shimmer" gradientUnits="userSpaceOnUse" x1="${x - SHIMMER_WIDTH}" y1="0" x2="${x}" y2="0">` +
    `<stop offset="0" class="ink-stop" stop-opacity="0.35"/><stop offset="0.5" ${highlight}/><stop offset="1" class="ink-stop" stop-opacity="0.35"/>` +
    sweep(x - SHIMMER_WIDTH, x + width, 'x1') +
    sweep(x, x + width + SHIMMER_WIDTH, 'x2') +
    `</linearGradient></defs>`
  )
}

function endMark(runPhase: RunPhase, x: number): Piece {
  if (runPhase === 'done') {
    return {
      svg: `<path data-icon="check" d="M${x + 0.5} ${HEIGHT / 2 + 0.3} l2.8 2.9 l5.2-6" fill="none" stroke="${DONE}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
      width: 10,
    }
  }

  if (runPhase === 'stopped') {
    return {
      svg: `<path data-icon="stopped" class="ink-line" opacity="0.6" d="M${x + 1.5} ${HEIGHT / 2} h7" stroke-width="1.5" stroke-linecap="round"/>`,
      width: 10,
    }
  }

  return { svg: '', width: 0 }
}

function altText(pills: readonly SkillPill[], runPhase: RunPhase): string {
  const names = pills.map(pill => (pill.count > 1 ? `${pill.name} (${pill.count} uses)` : pill.name))
  const state = runPhase === 'done' ? '' : `, ${runPhase}`

  return `Skills this run: ${names.join(', ')}${state}`
}

export function trailDrawing(
  pills: readonly SkillPill[],
  runPhase: RunPhase,
  lastSkill: string | null,
  accent: string | null,
): TrailDrawing {
  const isRunning = runPhase === 'running'
  const parts: string[] = []
  let x = 0

  pills.forEach((pill, index) => {
    if (index > 0) {
      parts.push(text(x, '→', 'class="ink" opacity="0.35"'))
      x += textWidth('→') + GAP
    }

    const name = pill.name
    const width = textWidth(name)
    const isCurrent = isRunning && pill.name === lastSkill

    if (isCurrent) {
      parts.push(shimmer(x, width, accent))
      parts.push(text(x, name, 'fill="url(#shimmer)" opacity="1"'))
    } else {
      parts.push(text(x, name, 'class="ink" opacity="0.6"'))
    }
    x += width

    if (pill.count > 1) {
      const count = `×${pill.count}`
      x += 4
      parts.push(text(x, count, 'class="ink" opacity="0.45"'))
      x += textWidth(count)
    }

    x += GAP
  })

  const mark = endMark(runPhase, x)
  parts.push(mark.svg)
  const width = Math.ceil(x + mark.width)

  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEIGHT}" viewBox="0 0 ${width} ${HEIGHT}">` +
    THEME_STYLE +
    parts.join('') +
    `</svg>`

  return { source, alt: altText(pills, runPhase), width, height: HEIGHT }
}
