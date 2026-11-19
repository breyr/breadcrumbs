import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

type Dollar = Parameters<TestBody>[0]

const BAND = {
  plugin: 'breadcrumbs',
  component: 'AbovePrompt',
  surface: 'desktop',
  props: {
    hasSurvey: false,
    isCollapsed: false,
    isWorking: false,
    maxRows: 6,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 6 },
    view: {},
  },
} as const

const typedPrompt = (text: string) => ({ text, wait: false, origin: { kind: 'composer' } }) as const

const typedCommand = (command: string) =>
  ({
    command,
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  }) as const

const notification = {
  text: '<task-notification>',
  wait: false,
  isMeta: true,
  origin: { kind: 'task-notification' },
} as const

const MAIN_TURN_DONE = {
  reason: 'answer',
  answer: '',
  durationMs: 1000,
  isAborted: false,
  turnId: 'turn-1',
} as const

async function drawnTrails($: Dollar) {
  const ui = await $.ui.mount(BAND)
  const svgs = await ui.findAll({ type: 'Svg' })
  await ui.unmount()

  return svgs.map(svg => ({
    alt: String(svg.props.alt),
    source: String(svg.props.source),
    height: svg.props.height,
  }))
}

async function trailSource($: Dollar): Promise<string> {
  return (await drawnTrails($))[0]?.source ?? ''
}

function nameText(source: string, name: string): string {
  return new RegExp(`<text[^>]*>${name}</text>`).exec(source)?.[0] ?? ''
}

function invoke($: Dollar, skill: string) {
  return $.skill.prompt({ skill, text: 'body' })
}

test('the skills of a run are drawn as one trail above the prompt', async ($, on) => {
  on('skill.prompt', (_, e) => ({ text: e.text }))

  await invoke($, 'how')
  await invoke($, 'architect')

  const trails = await drawnTrails($)
  expect(trails).toHaveLength(1)
  expect(trails[0]?.source).toContain('>how<')
  expect(trails[0]?.source).toContain('>architect<')
})

test('the trail lists skills in the order they were first used, joined by arrows', async ($, on) => {
  on('skill.prompt', (_, e) => ({ text: e.text }))

  await invoke($, 'how')
  await invoke($, 'architect')
  await invoke($, 'unit-testing')

  const source = await trailSource($)
  expect(source.indexOf('>how<')).toBeLessThan(source.indexOf('>architect<'))
  expect(source.indexOf('>architect<')).toBeLessThan(source.indexOf('>unit-testing<'))
  expect(source.match(/>→</g)).toHaveLength(2)
})

test('a repeated skill appears once with a count', async ($, on) => {
  on('skill.prompt', (_, e) => ({ text: e.text }))

  await invoke($, 'unit-testing')
  await invoke($, 'how')
  await invoke($, 'unit-testing')

  const source = await trailSource($)
  expect(source.match(/>unit-testing</g)).toHaveLength(1)
  expect(source).toContain('>×2<')
})

test('while running, the skill used most recently shimmers', async ($, on) => {
  on('skill.prompt', (_, e) => ({ text: e.text }))

  await invoke($, 'how')
  await invoke($, 'architect')
  const first = await trailSource($)
  await invoke($, 'how')
  const second = await trailSource($)

  expect(nameText(first, 'architect')).toContain('url(#shimmer)')
  expect(nameText(first, 'how')).not.toContain('url(#shimmer)')
  expect(nameText(second, 'how')).toContain('url(#shimmer)')
  expect(nameText(second, 'architect')).not.toContain('url(#shimmer)')
  expect(second).toContain('<animate')
})

test('when the turn completes the shimmer stops and a green check ends the trail', async ($, on) => {
  on('skill.prompt', (_, e) => ({ text: e.text }))
  on('turn.complete', () => ({ text: '' }))

  await invoke($, 'how')
  await $.turn.complete(MAIN_TURN_DONE)

  const source = await trailSource($)
  expect(source).not.toContain('url(#shimmer)')
  expect(source).not.toContain('<animate')
  expect(source).toMatch(/data-icon="check"[^>]*stroke="#22a559"/)
})

const UNFINISHED_ENDINGS = [
  ['interrupted', { ...MAIN_TURN_DONE, reason: 'aborted', isAborted: true }],
  ['failed', { ...MAIN_TURN_DONE, reason: 'error' }],
] as const

for (const [label, ending] of UNFINISHED_ENDINGS) test(`a run that was ${label} ends the trail with a dash`, async ($, on) => {
  on('skill.prompt', (_, e) => ({ text: e.text }))
  on('turn.complete', () => ({ text: '' }))

  await invoke($, 'how')
  await $.turn.complete(ending)

  const trail = (await drawnTrails($))[0]
  expect(trail?.source).toContain('data-icon="stopped"')
  expect(trail?.source).not.toContain('data-icon="check"')
  expect(trail?.source).not.toContain('<animate')
  expect(trail?.alt).toContain('stopped')
})

test('a subagent finishing does not end the main run', async ($, on) => {
  on('skill.prompt', (_, e) => ({ text: e.text }))
  on('turn.complete', () => ({ text: '' }))

  await invoke($, 'how')
  await $.turn.complete({ ...MAIN_TURN_DONE, agentId: 'subagent-1' })

  expect(await trailSource($)).toContain('url(#shimmer)')
})

test('a finished trail is dimmed rather than recolored', async ($, on) => {
  on('skill.prompt', (_, e) => ({ text: e.text }))
  on('turn.complete', () => ({ text: '' }))

  await invoke($, 'how')
  await invoke($, 'architect')
  const running = await trailSource($)
  await $.turn.complete(MAIN_TURN_DONE)
  const done = await trailSource($)

  const opacity = (source: string) => Number(/opacity="([0-9.]+)"/.exec(nameText(source, 'how'))?.[1])
  expect(opacity(done)).toBeLessThanOrEqual(opacity(running))
  expect(nameText(done, 'architect')).toMatch(/opacity="0\.6"/)
})

test('names are black on light themes and white on dark themes', async ($, on) => {
  on('skill.prompt', (_, e) => ({ text: e.text }))

  await invoke($, 'how')

  const source = await trailSource($)
  expect(source).toMatch(/\.ink\s*\{\s*fill:\s*#111111/)
  expect(source).toMatch(/@media \(prefers-color-scheme: dark\)\s*\{\s*\.ink\s*\{\s*fill:\s*#f5f5f5/)
})

test('by default the shimmer is a bright sweep in the theme text color', async ($, on) => {
  on('skill.prompt', (_, e) => ({ text: e.text }))

  await invoke($, 'how')

  const source = await trailSource($)
  const gradient = /<linearGradient id="shimmer"[\s\S]*?<\/linearGradient>/.exec(source)?.[0] ?? ''
  expect(gradient).toMatch(/<stop offset="0.5" class="ink-stop"/)
  expect(gradient).not.toMatch(/stop-color="#/)
  expect(gradient).toMatch(/<animate[^>]*attributeName="x1"/)
})

test('the trail is one line of monospace text with no boxes', async ($, on) => {
  on('skill.prompt', (_, e) => ({ text: e.text }))

  await invoke($, 'how')
  await invoke($, 'architect')

  const trail = (await drawnTrails($))[0]
  expect(trail?.height).toBe(20)
  expect(trail?.source).toContain('monospace')
  expect(trail?.source).not.toContain('<rect')
  expect(trail?.source).not.toContain('textLength')
})

test('sending a new prompt clears the trail of the last run', async ($, on) => {
  on('skill.prompt', (_, e) => ({ text: e.text }))
  on('prompt.submit', (_, e) => ({ text: e.text }))

  await invoke($, 'how')
  await $.prompt.submit(typedPrompt('next question'))

  expect(await drawnTrails($)).toHaveLength(0)
})

test('a prompt the person did not type leaves the trail alone', async ($, on) => {
  on('skill.prompt', (_, e) => ({ text: e.text }))
  on('prompt.submit', (_, e) => ({ text: e.text }))

  await invoke($, 'how')
  await $.prompt.submit(notification)

  expect(await drawnTrails($)).toHaveLength(1)
})

test('with no skills used the band draws nothing', async ($) => {
  const ui = await $.ui.mount(BAND)

  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  expect(await ui.find({ type: 'Text' })).toBeUndefined()
  await ui.unmount()
})

test('a skill name cannot inject markup into the drawing', async ($, on) => {
  on('skill.prompt', (_, e) => ({ text: e.text }))

  await invoke($, 'a&b<c>')

  const source = await trailSource($)
  expect(source).toContain('a&amp;b&lt;c&gt;')
  expect(source).not.toContain('a&b<c>')
})

test('the trail describes itself for screen readers', async ($, on) => {
  on('skill.prompt', (_, e) => ({ text: e.text }))

  await invoke($, 'how')
  await invoke($, 'architect')
  await invoke($, 'how')

  expect((await drawnTrails($))[0]?.alt).toBe('Skills this run: how (2 uses), architect, running')
})

test('a surface with no Svg gets the trail as text', async ($, on) => {
  on('skill.prompt', (_, e) => ({ text: e.text }))

  await invoke($, 'how')
  await invoke($, 'architect')

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'how → architect' })).toBeDefined()
  await ui.unmount()
})

const SESSION = { cwd: '/', surface: 'desktop', isInteractive: true } as const

const styleCommand = (args: string) => ({ ...typedCommand('breadcrumbs'), args }) as const

test('the command is offered as /breadcrumbs when the session starts', async ($, on) => {
  const registered: unknown[] = []
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => {
    registered.push(e)
    return { value: { command: 'breadcrumbs' } }
  })
  mock.store(on)

  await $.session.start(SESSION)

  expect(registered).toEqual([expect.objectContaining({ name: 'breadcrumbs' })])
})

test('/breadcrumbs style tags draws one outlined tag per skill', async ($, on) => {
  on('skill.prompt', (_, e) => ({ text: e.text }))
  mock.store(on)

  await $.command.run(styleCommand('style tags'))
  await invoke($, 'how')
  await invoke($, 'architect')

  const drawings = await drawnTrails($)
  expect(drawings).toHaveLength(2)
  expect(drawings[0]?.source).toContain('<rect')
  expect(drawings[0]?.source).toMatch(/<circle[^>]*class="name"/)
})

test('/breadcrumbs style trail switches back to the trail', async ($, on) => {
  on('skill.prompt', (_, e) => ({ text: e.text }))
  mock.store(on)

  await $.command.run(styleCommand('style tags'))
  await $.command.run(styleCommand('style trail'))
  await invoke($, 'how')
  await invoke($, 'architect')

  const drawings = await drawnTrails($)
  expect(drawings).toHaveLength(1)
  expect(drawings[0]?.source).toContain('>→<')
})

test('the chosen style is saved and used in later sessions', async ($, on) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'breadcrumbs' } }))
  on('skill.prompt', (_, e) => ({ text: e.text }))
  mock.store(on, { style: 'tags' })

  await $.session.start(SESSION)
  await invoke($, 'how')
  await invoke($, 'architect')

  expect(await drawnTrails($)).toHaveLength(2)
})

test('choosing a style writes it to the store', async ($, on) => {
  const writes: unknown[] = []
  on('store.set', (_, e) => {
    writes.push(e)
    return { value: undefined }
  })

  await $.command.run(styleCommand('style tags'))

  expect(writes).toEqual([expect.objectContaining({ key: 'style', value: 'tags' })])
})

test('an unknown style is refused and names the choices', async ($, on) => {
  on('skill.prompt', (_, e) => ({ text: e.text }))
  mock.store(on)

  const { text } = await $.command.run(styleCommand('style bubbles'))
  await invoke($, 'how')
  await invoke($, 'architect')

  expect(text).toMatch(/tags/)
  expect(text).toMatch(/trail/)
  expect(await drawnTrails($)).toHaveLength(1)
})

test('the command on its own says which style is in use', async ($, on) => {
  mock.store(on)

  const { text } = await $.command.run(styleCommand(''))

  expect(text).toMatch(/trail/)
})

test('/breadcrumbs color sets the shimmer and the tag dot to that color', async ($, on) => {
  on('skill.prompt', (_, e) => ({ text: e.text }))
  mock.store(on)

  await $.command.run(styleCommand('color #3B82F6'))
  await invoke($, 'how')
  const trail = await trailSource($)
  await $.command.run(styleCommand('style tags'))
  const tag = await trailSource($)

  expect(trail).toMatch(/<stop offset="0.5" stop-color="#3b82f6"/)
  expect(tag).toMatch(/<circle[^>]*fill="#3b82f6"/)
})

test('/breadcrumbs color default goes back to the theme text color', async ($, on) => {
  on('skill.prompt', (_, e) => ({ text: e.text }))
  mock.store(on)

  await $.command.run(styleCommand('color #3b82f6'))
  await $.command.run(styleCommand('color default'))
  await invoke($, 'how')

  expect(await trailSource($)).not.toContain('#3b82f6')
})

test('a color that is not a hex code is refused', async ($, on) => {
  on('skill.prompt', (_, e) => ({ text: e.text }))
  mock.store(on)

  const { text } = await $.command.run(styleCommand('color "><script>'))
  await invoke($, 'how')

  expect(text).toMatch(/#rrggbb/)
  expect(await trailSource($)).not.toContain('script')
})

test('the chosen color is saved and used in later sessions', async ($, on) => {
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.register', () => ({ value: { command: 'breadcrumbs' } }))
  on('skill.prompt', (_, e) => ({ text: e.text }))
  mock.store(on, { accent: '#10b981' })

  await $.session.start(SESSION)
  await invoke($, 'how')

  expect(await trailSource($)).toContain('stop-color="#10b981"')
})

test('the command on its own also says which color is in use', async ($, on) => {
  mock.store(on)

  await $.command.run(styleCommand('color #3b82f6'))
  const { text } = await $.command.run(styleCommand(''))

  expect(text).toContain('#3b82f6')
})

test('a skill you typed is drawn just like one Claude invoked, in both styles', async ($, on) => {
  on('command.run', () => ({ text: '' }))
  on('skill.prompt', (_, e) => ({ text: e.text }))
  mock.store(on)

  await $.command.run(typedCommand('how'))
  await invoke($, 'how')
  const trail = await trailSource($)
  await $.command.run(styleCommand('style tags'))
  const tag = await trailSource($)

  expect(trail).toContain('>how<')
  expect(trail).not.toContain('/how')
  expect(tag).toContain('>how<')
  expect(tag).not.toContain('/how')
})
