import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { BandStyle, SkillPill } from '../types'
import { pillDrawing } from './tag-drawing'
import { trailDrawing } from './trail-drawing'

const COMMAND = 'breadcrumbs'
const STYLES: readonly BandStyle[] = ['trail', 'tags']

const runPills = atom({ plugin: 'breadcrumbs', key: 'runPills' } as const, [])
const phase = atom({ plugin: 'breadcrumbs', key: 'phase' } as const, 'done')
const lastSkill = atom({ plugin: 'breadcrumbs', key: 'lastSkill' } as const, null)
const style = atom({ plugin: 'breadcrumbs', key: 'style' } as const, 'trail')
const accent = atom({ plugin: 'breadcrumbs', key: 'accent' } as const, null)

function isStyle(value: unknown): value is BandStyle {
  return STYLES.some(known => known === value)
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

function colorName(value: string | null): string {
  return value ?? 'default (your theme text color)'
}

function withInvocation(current: readonly SkillPill[], name: string): readonly SkillPill[] {
  const isKnown = current.some(pill => pill.name === name)

  if (!isKnown) {
    return [...current, { name, count: 1 }]
  }

  return current.map(pill => (pill.name === name ? { ...pill, count: pill.count + 1 } : pill))
}

function trailText(pills: readonly SkillPill[]): string {
  return pills.map(pill => (pill.count > 1 ? `${pill.name} ×${pill.count}` : pill.name)).join(' → ')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: COMMAND,
      description: 'Choose how the skill band looks: its style and its animation color',
      argumentHint: 'style trail|tags · color #rrggbb|default',
    })
    const savedStyle = await $.store.get('style')
    const savedAccent = await $.store.get('accent')

    if (isStyle(savedStyle)) {
      await update($, style, () => savedStyle)
    }

    if (isHexColor(savedAccent)) {
      await update($, accent, () => savedAccent.toLowerCase())
    }

    return next(e)
  })

  on('command.run', async ($, e, next) => {
    if (e.command !== COMMAND) {
      return next(e)
    }

    const [verb, choice] = e.args.trim().split(/\s+/)

    if (verb === 'style' && choice !== undefined) {
      if (!isStyle(choice)) {
        return { text: `Unknown style "${choice}". Choose ${STYLES.join(' or ')}.` }
      }

      await $.store.set('style', choice)
      await update($, style, () => choice)

      return { text: `breadcrumbs style set to ${choice}.` }
    }

    if (verb === 'color' && choice !== undefined) {
      if (choice === 'default') {
        await $.store.delete('accent')
        await update($, accent, () => null)

        return { text: `breadcrumbs color set to ${colorName(null)}.` }
      }

      if (!isHexColor(choice)) {
        return { text: `"${choice}" is not a color. Use a hex code like #rrggbb, or default.` }
      }

      const color = choice.toLowerCase()
      await $.store.set('accent', color)
      await update($, accent, () => color)

      return { text: `breadcrumbs color set to ${color}.` }
    }

    return {
      text:
        `breadcrumbs style: ${await read($, style)}, color: ${colorName(await read($, accent))}. ` +
        `Change them with /breadcrumbs style ${STYLES.join('|')} or /breadcrumbs color #rrggbb|default.`,
    }
  })

  on('skill.prompt', async ($, e, next) => {
    await update($, runPills, current => withInvocation(current, e.skill))
    await update($, lastSkill, () => e.skill)
    await update($, phase, () => 'running')

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (!e.isMeta) {
      await update($, runPills, () => [])
      await update($, lastSkill, () => null)
      await update($, phase, () => 'done')
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, phase, () => (e.reason === 'answer' ? 'done' : 'stopped'))
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const current = await read($, runPills)

    if (e.props.hasSurvey || current.length === 0) {
      return next(e)
    }

    if (e.surface !== 'desktop') {
      const { Text } = $.ui.resolve(e)

      return <Text>{trailText(current)}</Text>
    }

    const { Box, Svg } = $.ui.resolve(e)
    const runPhase = await read($, phase)
    const color = await read($, accent)

    if ((await read($, style)) === 'tags') {
      return (
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          {current.map(pill => {
            const drawing = pillDrawing(pill, runPhase, color)

            return (
              <Box key={`pill:${pill.name}`}>
                <Svg source={drawing.source} alt={drawing.alt} width={drawing.width} height={drawing.height} />
              </Box>
            )
          })}
        </Box>
      )
    }

    const drawing = trailDrawing(current, runPhase, await read($, lastSkill), color)

    return (
      <Box>
        <Svg source={drawing.source} alt={drawing.alt} width={drawing.width} height={drawing.height} />
      </Box>
    )
  })
}
