import { defineComponent, h, type PropType } from 'vue'
import { describe, expect, test } from 'vitest'
import { createCallable } from '../createCallable'
import type { CallContext } from '../createCallable/types.public'
import { flush, flushEnd } from './shared/flush'
import { renderMultiple } from './shared/renderCallable'

// Each createCallable() invocation builds an independent store. This
// invariant is implicit in the factory pattern but never asserted — and
// is the difference between "two dialogs in an app" working and silently
// bleeding into each other.

type Props = { message: string }

const dialog = (instanceLabel: string) =>
  defineComponent({
    name: `Dialog${instanceLabel}`,
    props: {
      message: { type: String, required: true },
      call: {
        type: Object as PropType<
          CallContext<Props, void, Record<string, never>>
        >,
        required: true,
      },
    },
    setup(props) {
      return () =>
        h(
          'div',
          {
            role: 'dialog',
            'aria-label': props.message,
            'data-testid': `dialog-${instanceLabel}-${props.message}`,
          },
          [h('button', { type: 'button', onClick: () => props.call.end() }, 'OK')],
        )
    },
  })

describe('Multiple createCallable instances are independent', () => {
  test('a call on instance A renders only inside A.Root, not B.Root', async () => {
    const A = createCallable(dialog('a'))
    const B = createCallable(dialog('b'))
    const wrapper = renderMultiple([A, B])

    A.call({ message: 'hello' })
    await flush()

    expect(wrapper.find('[data-testid="dialog-a-hello"]').exists()).toBe(
      true,
    )
    expect(wrapper.find('[data-testid="dialog-b-hello"]').exists()).toBe(
      false,
    )
  })

  test('each instance maintains its own independent stack', async () => {
    const A = createCallable(dialog('a'))
    const B = createCallable(dialog('b'))
    const wrapper = renderMultiple([A, B])

    A.call({ message: 'a-only' })
    B.call({ message: 'b-only' })
    await flush()

    expect(wrapper.find('[data-testid="dialog-a-a-only"]').exists()).toBe(
      true,
    )
    expect(wrapper.find('[data-testid="dialog-b-b-only"]').exists()).toBe(
      true,
    )
    expect(wrapper.find('[data-testid="dialog-b-a-only"]').exists()).toBe(
      false,
    )
    expect(wrapper.find('[data-testid="dialog-a-b-only"]').exists()).toBe(
      false,
    )
  })

  test('B.end() does not touch A', async () => {
    const A = createCallable(dialog('a'))
    const B = createCallable(dialog('b'))
    const wrapper = renderMultiple([A, B])

    A.call({ message: 'a-stays' })
    B.call({ message: 'b-goes' })
    await flush()

    B.end()
    await flushEnd()

    expect(wrapper.find('[data-testid="dialog-b-b-goes"]').exists()).toBe(
      false,
    )
    expect(wrapper.find('[data-testid="dialog-a-a-stays"]').exists()).toBe(
      true,
    )
  })

  test('upsert state is per-instance: A.upsert returns its own promise, not shared with B', async () => {
    const A = createCallable(dialog('a'))
    const B = createCallable(dialog('b'))
    renderMultiple([A, B])

    const pa = A.upsert({ message: 'a1' })
    const pb = B.upsert({ message: 'b1' })
    await flush()

    expect(pa).not.toBe(pb)

    const pa2 = A.upsert({ message: 'a2' })
    await flush()
    expect(pa2).toBe(pa)
    const pb2 = B.upsert({ message: 'b2' })
    await flush()
    expect(pb2).toBe(pb)
    expect(pb2).not.toBe(pa2)
  })
})
