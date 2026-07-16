import { describe, expect, test } from 'vitest'
import { Confirm } from './shared/Confirm'
import { flush } from './shared/flush'
import { renderCallable } from './shared/renderCallable'

describe('<Root>', () => {
  describe('renders', () => {
    test('nothing when empty', () => {
      const wrapper = renderCallable(Confirm)
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    })

    test('one item at one call', async () => {
      const wrapper = renderCallable(Confirm)
      Confirm.call({ message: 'foo' })
      await flush()
      expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    })

    test('multiple items at multiple calls', async () => {
      const wrapper = renderCallable(Confirm)
      const messages = ['foo', 'bar', 'xyz', '123', '456']
      for (const message of messages) Confirm.call({ message })
      await flush()
      for (const message of messages) {
        expect(wrapper.find(`[aria-label="${message}"]`).exists()).toBe(true)
      }
    })
  })
})
