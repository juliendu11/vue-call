import { nextTick } from 'vue'
import { describe, expect, test } from 'vitest'
import { Confirm } from './shared/Confirm'
import { flush } from './shared/flush'
import { renderCallable } from './shared/renderCallable'

/**
 * The end-all path defers its stack removal to a macrotask (the
 * unmountingDelay setTimeout, default 0). Flush that macrotask, then a
 * tick, so we can assert what survives once the deferred removal has run.
 */
const flushUnmountingDelay = async () => {
  await new Promise((resolve) => globalThis.setTimeout(resolve, 0))
  await nextTick()
}

describe('end()', () => {
  describe('inside', () => {
    test('removes one', async () => {
      const wrapper = renderCallable(Confirm)
      Confirm.call({ message: 'foo' })
      await flush()
      await wrapper.find('button:nth-of-type(2)').trigger('click')
      await flushUnmountingDelay()
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    })

    test('removes all', async () => {
      const wrapper = renderCallable(Confirm)
      const messages = ['foo', 'bar', 'xyz', '123', '456']
      for (const message of messages) Confirm.call({ message })
      await flush()
      for (const message of messages) {
        const dialog = wrapper.get(`[aria-label="${message}"]`)
        await dialog.find('button:nth-of-type(2)').trigger('click')
      }
      await flushUnmountingDelay()
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    })

    describe('removes only specific target', () => {
      test('first one', async () => {
        const wrapper = renderCallable(Confirm)
        Confirm.call({ message: 'first one' })
        Confirm.call({ message: 'middle one' })
        Confirm.call({ message: 'last one' })
        await flush()
        await wrapper
          .get('[aria-label="first one"] button:nth-of-type(2)')
          .trigger('click')
        await flushUnmountingDelay()
        expect(wrapper.find('[aria-label="first one"]').exists()).toBe(false)
        expect(wrapper.find('[aria-label="middle one"]').exists()).toBe(true)
        expect(wrapper.find('[aria-label="last one"]').exists()).toBe(true)
      })

      test('middle one', async () => {
        const wrapper = renderCallable(Confirm)
        Confirm.call({ message: 'first one' })
        Confirm.call({ message: 'middle one' })
        Confirm.call({ message: 'last one' })
        await flush()
        await wrapper
          .get('[aria-label="middle one"] button:nth-of-type(2)')
          .trigger('click')
        await flushUnmountingDelay()
        expect(wrapper.find('[aria-label="middle one"]').exists()).toBe(false)
        expect(wrapper.find('[aria-label="first one"]').exists()).toBe(true)
        expect(wrapper.find('[aria-label="last one"]').exists()).toBe(true)
      })

      test('last one', async () => {
        const wrapper = renderCallable(Confirm)
        Confirm.call({ message: 'first one' })
        Confirm.call({ message: 'middle one' })
        Confirm.call({ message: 'last one' })
        await flush()
        await wrapper
          .get('[aria-label="last one"] button:nth-of-type(2)')
          .trigger('click')
        await flushUnmountingDelay()
        expect(wrapper.find('[aria-label="last one"]').exists()).toBe(false)
        expect(wrapper.find('[aria-label="first one"]').exists()).toBe(true)
        expect(wrapper.find('[aria-label="middle one"]').exists()).toBe(true)
      })
    })
  })

  describe('outside', () => {
    test('removes one', async () => {
      const wrapper = renderCallable(Confirm)
      const promise = Confirm.call({ message: 'foo' })
      await flush()
      Confirm.end(promise, false)
      await flushUnmountingDelay()
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    })

    test('removes all', async () => {
      const wrapper = renderCallable(Confirm)
      const messages = ['foo', 'bar', 'xyz', '123', '456']
      for (const message of messages) Confirm.call({ message })
      await flush()
      Confirm.end(false)
      await flushUnmountingDelay()
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    })

    describe('removes only specific target', () => {
      test('first one', async () => {
        const wrapper = renderCallable(Confirm)
        const firstPromise = Confirm.call({ message: 'first one' })
        Confirm.call({ message: 'middle one' })
        Confirm.call({ message: 'last one' })
        await flush()
        Confirm.end(firstPromise, false)
        await flushUnmountingDelay()
        expect(wrapper.find('[aria-label="first one"]').exists()).toBe(false)
        expect(wrapper.find('[aria-label="middle one"]').exists()).toBe(true)
        expect(wrapper.find('[aria-label="last one"]').exists()).toBe(true)
      })

      test('middle one', async () => {
        const wrapper = renderCallable(Confirm)
        Confirm.call({ message: 'first one' })
        const middlePromise = Confirm.call({ message: 'middle one' })
        Confirm.call({ message: 'last one' })
        await flush()
        Confirm.end(middlePromise, false)
        await flushUnmountingDelay()
        expect(wrapper.find('[aria-label="middle one"]').exists()).toBe(false)
        expect(wrapper.find('[aria-label="first one"]').exists()).toBe(true)
        expect(wrapper.find('[aria-label="last one"]').exists()).toBe(true)
      })

      test('last one', async () => {
        const wrapper = renderCallable(Confirm)
        Confirm.call({ message: 'first one' })
        Confirm.call({ message: 'middle one' })
        const lastPromise = Confirm.call({ message: 'last one' })
        await flush()
        Confirm.end(lastPromise, false)
        await flushUnmountingDelay()
        expect(wrapper.find('[aria-label="last one"]').exists()).toBe(false)
        expect(wrapper.find('[aria-label="first one"]').exists()).toBe(true)
        expect(wrapper.find('[aria-label="middle one"]').exists()).toBe(true)
      })
    })
  })

  // Regression: an end-all in the same synchronous tick used to schedule a
  // blanket stack wipe that also clobbered calls added *after* it.
  describe('same tick as later call()', () => {
    test('end-all then call() — later calls survive', async () => {
      const wrapper = renderCallable(Confirm)
      const messages = ['foo', 'bar', 'xyz']
      Confirm.end(false) // end all (stack empty here — intended no-op)
      for (const message of messages) Confirm.call({ message })
      await flush()
      await flushUnmountingDelay()
      expect(wrapper.findAll('[role="dialog"]')).toHaveLength(3)
      for (const message of messages) {
        expect(wrapper.find(`[aria-label="${message}"]`).exists()).toBe(true)
      }
    })

    test('end-all removes the pre-existing calls but keeps the later ones', async () => {
      const wrapper = renderCallable(Confirm)
      Confirm.call({ message: 'before one' })
      Confirm.call({ message: 'before two' })
      await flush()
      Confirm.end(false) // end the two pre-existing calls
      Confirm.call({ message: 'after one' })
      Confirm.call({ message: 'after two' })
      await flush()
      await flushUnmountingDelay()
      expect(wrapper.find('[aria-label="before one"]').exists()).toBe(false)
      expect(wrapper.find('[aria-label="before two"]').exists()).toBe(false)
      expect(wrapper.find('[aria-label="after one"]').exists()).toBe(true)
      expect(wrapper.find('[aria-label="after two"]').exists()).toBe(true)
    })

    test('targeted end(promise) then call() — later calls survive', async () => {
      const wrapper = renderCallable(Confirm)
      const targeted = Confirm.call({ message: 'targeted' })
      await flush()
      Confirm.end(targeted, false) // end one specific call
      Confirm.call({ message: 'after one' })
      Confirm.call({ message: 'after two' })
      await flush()
      await flushUnmountingDelay()
      expect(wrapper.find('[aria-label="targeted"]').exists()).toBe(false)
      expect(wrapper.find('[aria-label="after one"]').exists()).toBe(true)
      expect(wrapper.find('[aria-label="after two"]').exists()).toBe(true)
    })

    test('update-all then call() — later calls survive', async () => {
      const wrapper = renderCallable(Confirm)
      Confirm.call({ message: 'before' })
      await flush()
      Confirm.update({ message: 'updated' }) // update all (no removal)
      Confirm.call({ message: 'after one' })
      Confirm.call({ message: 'after two' })
      await flush()
      await flushUnmountingDelay()
      expect(wrapper.findAll('[role="dialog"]')).toHaveLength(3)
      expect(wrapper.find('[aria-label="updated"]').exists()).toBe(true)
      expect(wrapper.find('[aria-label="after one"]').exists()).toBe(true)
      expect(wrapper.find('[aria-label="after two"]').exists()).toBe(true)
    })
  })
})
