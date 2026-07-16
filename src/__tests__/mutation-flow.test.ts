import { defineComponent, h, nextTick, type PropType } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, test, vi } from 'vitest'
import { createCallable } from '../createCallable'
import { type MutationFn, useMutationFlow } from '../mutation-flow'
import { renderCallable } from './shared/renderCallable'

// mirrors useMutationFlow — propagates throws from `mutationFn` as
// unhandled rejections; tests that intentionally throw use this to scope
// the suppression to their own body so the runner doesn't fail the test
// (and so unintended rejections elsewhere still do).
function suppressUnhandledRejection() {
  const listener = () => {}
  process.on('unhandledRejection', listener)
  return () => {
    process.off('unhandledRejection', listener)
  }
}

// Component fixtures cover the three consumer patterns:
//   - Required handler: submit() runs the mutation; no chain.
//   - Optional handler with Fallback response: submit().orEnd(value).
//   - Picker with per-callsite fallbacks: each button chains its own
//     .orEnd value, aligned with its payload.

type RequiredProps = { mutationFn: MutationFn<boolean> }

const RequiredComponent = defineComponent({
  props: {
    mutationFn: { type: Function as PropType<MutationFn<boolean>>, required: true },
    call: { type: Object, required: true },
  },
  setup(props: any) {
    const submit = useMutationFlow(props.call, () => props.mutationFn)
    return () =>
      h('div', { role: 'dialog' }, [
        h('p', 'Are you sure?'),
        h(
          'button',
          {
            type: 'button',
            'data-testid': 'submit',
            'data-pending': String(submit.pending),
            disabled: submit.pending,
            onClick: () => submit(),
          },
          'Yes',
        ),
        h(
          'button',
          {
            type: 'button',
            'data-testid': 'cancel',
            onClick: () => props.call.end(false),
          },
          'No',
        ),
      ])
  },
})

const Required = createCallable<RequiredProps, boolean, Record<string, never>>(
  RequiredComponent,
)

type OptionalProps = { mutationFn?: MutationFn<boolean> }

const OptionalComponent = defineComponent({
  props: {
    mutationFn: { type: Function as PropType<MutationFn<boolean>>, required: false },
    call: { type: Object, required: true },
  },
  setup(props: any) {
    const submit = useMutationFlow(props.call, () => props.mutationFn)
    return () =>
      h(
        'button',
        {
          type: 'button',
          'data-testid': 'submit',
          'data-pending': String(submit.pending),
          disabled: submit.pending,
          onClick: () => submit().orEnd(true),
        },
        'Yes',
      )
  },
})

const Optional = createCallable<OptionalProps, boolean, Record<string, never>>(
  OptionalComponent,
)

type PayloadProps = { mutationFn: MutationFn<string, { choice: 'A' | 'B' }> }

const PayloadComponent = defineComponent({
  props: {
    mutationFn: {
      type: Function as PropType<MutationFn<string, { choice: 'A' | 'B' }>>,
      required: true,
    },
    call: { type: Object, required: true },
  },
  setup(props: any) {
    const submit = useMutationFlow<string, { choice: 'A' | 'B' }>(
      props.call,
      () => props.mutationFn,
    )
    return () => [
      h('button', { type: 'button', onClick: () => submit({ choice: 'A' }) }, 'A'),
      h('button', { type: 'button', onClick: () => submit({ choice: 'B' }) }, 'B'),
    ]
  },
})

const Payload = createCallable<PayloadProps, string, Record<string, never>>(
  PayloadComponent,
)

type PickerProps = {
  mutationFn?: MutationFn<'A' | 'B', { choice: 'A' | 'B' }>
}

const PickerComponent = defineComponent({
  props: {
    mutationFn: {
      type: Function as PropType<MutationFn<'A' | 'B', { choice: 'A' | 'B' }>>,
      required: false,
    },
    call: { type: Object, required: true },
  },
  setup(props: any) {
    const submit = useMutationFlow<'A' | 'B', { choice: 'A' | 'B' }>(
      props.call,
      () => props.mutationFn,
    )
    return () => [
      h(
        'button',
        { type: 'button', onClick: () => submit({ choice: 'A' }).orEnd('A') },
        'A',
      ),
      h(
        'button',
        { type: 'button', onClick: () => submit({ choice: 'B' }).orEnd('B') },
        'B',
      ),
    ]
  },
})

const Picker = createCallable<PickerProps, 'A' | 'B', Record<string, never>>(
  PickerComponent,
)

type ManualCloseProps = { mutationFn?: MutationFn<boolean> }

const ManualCloseComponent = defineComponent({
  props: {
    mutationFn: { type: Function as PropType<MutationFn<boolean>>, required: false },
    call: { type: Object, required: true },
  },
  setup(props: any) {
    const submit = useMutationFlow(props.call, () => props.mutationFn)
    return () =>
      h('div', { role: 'dialog' }, [
        h(
          'button',
          { type: 'button', 'data-testid': 'submit', onClick: () => submit() },
          'Yes',
        ),
        h(
          'button',
          {
            type: 'button',
            'data-testid': 'cancel',
            onClick: () => props.call.end(false),
          },
          'No',
        ),
      ])
  },
})

const ManualClose = createCallable<ManualCloseProps, boolean, Record<string, never>>(
  ManualCloseComponent,
)

type SyncReentryProps = { mutationFn: MutationFn<boolean> }

const SyncReentryComponent = defineComponent({
  props: {
    mutationFn: { type: Function as PropType<MutationFn<boolean>>, required: true },
    call: { type: Object, required: true },
  },
  setup(props: any) {
    const submit = useMutationFlow(props.call, () => props.mutationFn)
    // Fire twice in one handler — the second call lands in the same
    // event-loop turn, before `pending` flushes, so only the inFlight
    // closure variable can guard it. (The button is intentionally never
    // disabled.)
    return () =>
      h(
        'button',
        {
          type: 'button',
          'data-testid': 'double',
          onClick: () => {
            submit()
            submit()
          },
        },
        'Go',
      )
  },
})

const SyncReentry = createCallable<SyncReentryProps, boolean, Record<string, never>>(
  SyncReentryComponent,
)

const click = async (wrapper: ReturnType<typeof mount>, testid: string) => {
  await wrapper.get(`[data-testid="${testid}"]`).trigger('click')
}

describe('useMutationFlow — pending lifecycle', () => {
  test('pending flips true while the mutationFn is in-flight, false when it settles', async () => {
    let resolveMutation!: () => void
    const mutationFn = vi.fn<MutationFn<boolean>>(
      (call) =>
        new Promise<void>((resolve) => {
          resolveMutation = () => {
            call.end(true)
            resolve()
          }
        }),
    )

    const wrapper = renderCallable(Required)
    const promise = Required.call({ mutationFn })
    await nextTick()

    await click(wrapper, 'submit')
    expect(wrapper.get('[data-testid="submit"]').attributes('data-pending')).toBe(
      'true',
    )
    expect(wrapper.get('[data-testid="submit"]').attributes('disabled')).toBeDefined()

    resolveMutation()
    await nextTick()

    await expect(promise).resolves.toBe(true)
  })

  test('thrown mutationFn keeps the dialog open and clears pending', async () => {
    const restore = suppressUnhandledRejection()
    try {
      const mutationFn = vi.fn<MutationFn<boolean>>(() =>
        Promise.reject(new Error('boom')),
      )

      const wrapper = renderCallable(Required)
      Required.call({ mutationFn })
      await nextTick()

      await click(wrapper, 'submit')
      await nextTick()

      expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
      expect(wrapper.get('[data-testid="submit"]').attributes('data-pending')).toBe(
        'false',
      )
      expect(
        wrapper.get('[data-testid="submit"]').attributes('disabled'),
      ).toBeUndefined()
    } finally {
      restore()
    }
  })
})

describe('useMutationFlow — fallback via .orEnd', () => {
  test('submit().orEnd(value) closes the call with the fallback when no mutationFn was provided', async () => {
    const wrapper = renderCallable(Optional)
    const promise = Optional.call({})
    await nextTick()

    await click(wrapper, 'submit')

    await expect(promise).resolves.toBe(true)
  })

  test('submit().orEnd(value) with a mutationFn runs the managed flow and the orEnd value is ignored', async () => {
    const mutationFn = vi.fn<MutationFn<boolean>>(async (call) => {
      call.end(false)
    })

    const wrapper = renderCallable(Optional)
    const promise = Optional.call({ mutationFn })
    await nextTick()

    await click(wrapper, 'submit')

    await expect(promise).resolves.toBe(false)
    expect(mutationFn).toHaveBeenCalledTimes(1)
  })
})

describe('useMutationFlow — per-callsite fallback', () => {
  test('the A button chains .orEnd("A")', async () => {
    const wrapper = renderCallable(Picker)
    const promise = Picker.call({})
    await nextTick()

    await wrapper.get('button').trigger('click')
    await expect(promise).resolves.toBe('A')
  })

  test('the B button chains .orEnd("B")', async () => {
    const wrapper = renderCallable(Picker)
    const promise = Picker.call({})
    await nextTick()

    await wrapper.findAll('button')[1]!.trigger('click')
    await expect(promise).resolves.toBe('B')
  })
})

describe('useMutationFlow — Manual-close path', () => {
  test('submit() without a chain leaves the call open when no mutationFn was provided', async () => {
    const wrapper = renderCallable(ManualClose)
    const promise = ManualClose.call({})
    await nextTick()

    await click(wrapper, 'submit')

    // The call is still open — submit() was a no-op because no mutationFn
    // and no .orEnd chain. The dialog waits for the user to close it.
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)

    await click(wrapper, 'cancel')
    await expect(promise).resolves.toBe(false)
  })
})

describe('useMutationFlow — re-entry guard', () => {
  test('a second submit() while pending is a no-op', async () => {
    let resolveMutation!: () => void
    const mutationFn = vi.fn<MutationFn<boolean>>(
      (call) =>
        new Promise<void>((resolve) => {
          resolveMutation = () => {
            call.end(true)
            resolve()
          }
        }),
    )

    const wrapper = renderCallable(Required)
    Required.call({ mutationFn })
    await nextTick()

    await click(wrapper, 'submit')
    // The button is disabled by `submit.pending` in the DOM, but the hook
    // also guards programmatic re-entry via the `inFlight` closure
    // variable — force a second dispatch regardless of the disabled
    // attribute so the guard itself is what's under test.
    await wrapper.get('[data-testid="submit"]').element.dispatchEvent(
      new Event('click'),
    )
    await nextTick()

    expect(mutationFn).toHaveBeenCalledTimes(1)

    resolveMutation()
    await nextTick()
  })

  test('a synchronous second submit() in the same turn is dropped by the ref guard', async () => {
    let resolveMutation!: () => void
    const mutationFn = vi.fn<MutationFn<boolean>>(
      (call) =>
        new Promise<void>((resolve) => {
          resolveMutation = () => {
            call.end(true)
            resolve()
          }
        }),
    )

    const wrapper = renderCallable(SyncReentry)
    SyncReentry.call({ mutationFn })
    await nextTick()

    await click(wrapper, 'double')

    // The first submit() set inFlight synchronously; the second hit the
    // guard and returned the no-op chain without re-running the flow.
    expect(mutationFn).toHaveBeenCalledTimes(1)

    resolveMutation()
    await nextTick()
  })
})

describe('useMutationFlow — payload', () => {
  test('submit(payload) forwards the runtime payload to the mutationFn', async () => {
    const mutationFn = vi.fn<MutationFn<string, { choice: 'A' | 'B' }>>(
      async (call, payload) => {
        call.end(payload.choice)
      },
    )

    const wrapper = renderCallable(Payload)
    const promise = Payload.call({ mutationFn })
    await nextTick()

    await wrapper.findAll('button')[1]!.trigger('click')

    expect(mutationFn).toHaveBeenCalledWith(
      expect.objectContaining({ end: expect.any(Function) }),
      { choice: 'B' },
    )
    await expect(promise).resolves.toBe('B')
  })
})

describe('useMutationFlow — mid-call updates', () => {
  test('Callable.update can swap the mutationFn between submits', async () => {
    const restore = suppressUnhandledRejection()
    try {
      const first = vi.fn<MutationFn<boolean>>(async () => {
        throw new Error('first fails')
      })
      const second = vi.fn<MutationFn<boolean>>(async (call) => {
        call.end(true)
      })

      const wrapper = renderCallable(Required)
      const promise = Required.call({ mutationFn: first })
      await nextTick()

      await click(wrapper, 'submit')
      await nextTick()
      expect(first).toHaveBeenCalledTimes(1)
      expect(wrapper.find('[role="dialog"]').exists()).toBe(true)

      Required.update({ mutationFn: second })
      await nextTick()

      await click(wrapper, 'submit')
      expect(second).toHaveBeenCalledTimes(1)
      await expect(promise).resolves.toBe(true)
    } finally {
      restore()
    }
  })
})

describe('useMutationFlow — external end during pending', () => {
  test('external Callable.end while pending closes the call; the still-running mutationFn ending later is a no-op', async () => {
    let resolveMutation!: (response: boolean) => void
    const mutationFn = vi.fn<MutationFn<boolean>>(
      (call) =>
        new Promise<void>((resolve) => {
          resolveMutation = (response) => {
            call.end(response)
            resolve()
          }
        }),
    )

    const wrapper = renderCallable(Required)
    const promise = Required.call({ mutationFn })
    await nextTick()

    await click(wrapper, 'submit')

    Required.end(false)
    await nextTick()

    await expect(promise).resolves.toBe(false)

    // Even though the mutation later "succeeds" with true, the promise is
    // already resolved with the external end's value.
    resolveMutation(true)
    await nextTick()
    await expect(promise).resolves.toBe(false)
  })
})
