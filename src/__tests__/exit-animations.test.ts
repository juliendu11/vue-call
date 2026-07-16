import { nextTick } from 'vue'
import { describe, expect, test } from 'vitest'
import { createCallable } from '../createCallable'
import { flush } from './shared/flush'
import { renderCallable } from './shared/renderCallable'
import SlowConfirmComponent from './shared/SlowConfirm.vue'

// The README documents that `unmountingDelay` keeps a finished call in the
// stack for the given milliseconds so the consumer can drive an exit
// animation using the `call.ended` boolean. The default fixture uses
// `unmountingDelay = 0`, which collapses the ended state into a single
// macrotask and makes the intermediate `ended: true` window unobservable.
// This fixture sets a real delay (50ms is enough — short enough to keep
// tests fast, long enough to be reliably observed under happy-dom + Vue).

const UNMOUNTING_DELAY = 50

const SlowConfirm = createCallable<{ message: string }, boolean, Record<string, never>>(
  SlowConfirmComponent,
  UNMOUNTING_DELAY,
)

const waitFor = async (assertion: () => void, timeout: number) => {
  const start = Date.now()
  for (;;) {
    try {
      assertion()
      return
    } catch (err) {
      if (Date.now() - start > timeout) throw err
      await new Promise((resolve) => globalThis.setTimeout(resolve, 5))
      await nextTick()
    }
  }
}

describe('Exit animations (unmountingDelay + call.ended)', () => {
  test('call.ended starts false during the active call', async () => {
    const wrapper = renderCallable(SlowConfirm)
    SlowConfirm.call({ message: 'foo' })
    await flush()
    expect(wrapper.get('[role="dialog"]').attributes('data-ended')).toBe(
      'false',
    )
  })

  test('call.ended flips to true on end() and the dialog stays mounted until unmountingDelay elapses', async () => {
    const wrapper = renderCallable(SlowConfirm)
    SlowConfirm.call({ message: 'foo' })
    await flush()

    await wrapper.find('button:nth-of-type(2)').trigger('click')

    // Immediately after end(): still mounted, ended = true. The consumer's
    // CSS would apply the exit-animation class via `call.ended` from here.
    const endedDialog = wrapper.get('[role="dialog"]')
    expect(endedDialog.attributes('data-ended')).toBe('true')

    // After the delay, the item is removed from the stack entirely.
    await waitFor(() => {
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    }, UNMOUNTING_DELAY * 4)
  })

  test('external SlowConfirm.end(false) honours unmountingDelay the same way an inside end() does', async () => {
    const wrapper = renderCallable(SlowConfirm)
    SlowConfirm.call({ message: 'foo' })
    await flush()

    SlowConfirm.end(false)
    await flush()

    const endedDialog = wrapper.get('[role="dialog"]')
    expect(endedDialog.attributes('data-ended')).toBe('true')

    await waitFor(() => {
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    }, UNMOUNTING_DELAY * 4)
  })
})
