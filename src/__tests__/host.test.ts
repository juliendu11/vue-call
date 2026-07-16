import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, test } from 'vitest'
import { mount as mountHost } from '../host'
import { Confirm } from './shared/Confirm'

// Cached host lives on globalThis (mirrors the source library's ADR-0016
// idempotency). Tests run in the same process so we must tear it down
// between cases to avoid one test's mount leaking into the next.
const HOST_KEY = Symbol.for('vue-call.host')
type HostStore = {
  [HOST_KEY]?: { app: { unmount: () => void }; container: HTMLElement }
}

const teardownHost = () => {
  const store = globalThis as HostStore
  const cached = store[HOST_KEY]
  if (cached) {
    cached.app.unmount()
    cached.container.remove()
    delete store[HOST_KEY]
  }
  for (const el of document.querySelectorAll('[data-vue-call-host]')) {
    el.remove()
  }
}

afterEach(teardownHost)

const CallButton = defineComponent({
  props: { message: { type: String, required: true } },
  setup(props) {
    return () =>
      h(
        'button',
        { type: 'button', onClick: () => Confirm.call({ message: props.message }) },
        props.message,
      )
  },
})

describe('mount()', () => {
  test('mounts into a body-level <div data-vue-call-host>', async () => {
    mountHost(Confirm)
    await nextTick()
    const host = document.querySelector('[data-vue-call-host]')
    expect(host).not.toBeNull()
    expect(host?.parentElement).toBe(document.body)
  })

  test('multi-host scenario: N parallel subtrees + one mount() does not throw', async () => {
    const wrappers = ['story-1', 'story-2', 'story-3', 'story-4'].map((m) =>
      mount(CallButton, { props: { message: m }, attachTo: document.body }),
    )
    mountHost(Confirm)
    await nextTick()

    await wrappers[1]!.find('button').trigger('click')
    await nextTick()

    expect(
      document.querySelectorAll('[aria-label="story-2"]'),
    ).toHaveLength(1)

    for (const w of wrappers) w.unmount()
  })

  test('end() resolves the call across the host boundary', async () => {
    const wrapper = mount(CallButton, {
      props: { message: 'boundary' },
      attachTo: document.body,
    })
    mountHost(Confirm)
    await nextTick()

    const promise = Confirm.call({ message: 'manual' })
    await nextTick()
    const dialog = document.querySelector('[aria-label="manual"]')
    expect(dialog).not.toBeNull()
    ;(dialog?.querySelector('button') as HTMLButtonElement).click()
    expect(await promise).toBe(true)

    wrapper.unmount()
  })

  test('idempotent: second call re-uses the same container and app', async () => {
    mountHost(Confirm)
    await nextTick()
    const firstHost = document.querySelector('[data-vue-call-host]')

    mountHost(Confirm)
    await nextTick()
    const allHosts = document.querySelectorAll('[data-vue-call-host]')

    expect(allHosts).toHaveLength(1)
    expect(allHosts[0]).toBe(firstHost)
  })

  test('wrapper option wraps the rendered content', async () => {
    const Wrapper = defineComponent({
      setup(_, { slots }) {
        return () =>
          h('section', { 'data-testid': 'wrapper' }, slots.default?.())
      },
    })
    mountHost(Confirm, { wrapper: Wrapper })
    await nextTick()

    const wrapperEl = document.querySelector('[data-testid="wrapper"]')
    expect(wrapperEl).not.toBeNull()
    expect(wrapperEl?.tagName).toBe('SECTION')
  })

  test('custom container option mounts into the provided element', async () => {
    const container = document.createElement('aside')
    container.setAttribute('data-testid', 'custom-container')
    document.body.appendChild(container)

    mountHost(Confirm, { container })
    await nextTick()
    Confirm.call({ message: 'inside-aside' })
    await nextTick()

    expect(container.querySelector('[role="dialog"]')).not.toBeNull()
    expect(document.querySelector('[data-vue-call-host]')).toBeNull()
    container.remove()
  })

  test('re-mount with a different wrapper swaps content on the same app', async () => {
    const A = defineComponent({
      setup(_, { slots }) {
        return () => h('div', { 'data-testid': 'A' }, slots.default?.())
      },
    })
    const B = defineComponent({
      setup(_, { slots }) {
        return () => h('div', { 'data-testid': 'B' }, slots.default?.())
      },
    })
    mountHost(Confirm, { wrapper: A })
    await nextTick()
    expect(document.querySelector('[data-testid="A"]')).not.toBeNull()
    expect(document.querySelector('[data-testid="B"]')).toBeNull()

    mountHost(Confirm, { wrapper: B })
    await nextTick()
    expect(document.querySelector('[data-testid="B"]')).not.toBeNull()
    expect(document.querySelector('[data-testid="A"]')).toBeNull()
  })
})
