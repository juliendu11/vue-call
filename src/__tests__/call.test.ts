import { describe, expect, test } from 'vitest'
import { Confirm } from './shared/Confirm'
import { flush } from './shared/flush'
import { renderCallable } from './shared/renderCallable'

describe('call()', () => {
  describe('receives', () => {
    test('a message param', async () => {
      const wrapper = renderCallable(Confirm)
      Confirm.call({ message: 'an important message' })
      await flush()
      expect(
        wrapper.find('[aria-label="an important message"]').exists(),
      ).toBe(true)
    })
  })

  describe('returns', () => {
    test('true when yes is clicked', async () => {
      const wrapper = renderCallable(Confirm)
      const promise = Confirm.call({ message: 'foo' })
      await flush()
      await wrapper.find('button:nth-of-type(1)').trigger('click')
      expect(await promise).toBe(true)
    })

    test('false when no is clicked', async () => {
      const wrapper = renderCallable(Confirm)
      const promise = Confirm.call({ message: 'foo' })
      await flush()
      await wrapper.find('button:nth-of-type(2)').trigger('click')
      expect(await promise).toBe(false)
    })
  })

  describe('throws', () => {
    test('no <Root> found', () => {
      expect(() => Confirm.call({ message: 'foo' })).toThrowError(
        /no <root> found/i,
      )
    })

    test('multiple instances of <Root> found', () => {
      renderCallable(Confirm)
      renderCallable(Confirm)
      expect(() => Confirm.call({ message: 'foo' })).toThrowError(
        /multiple instances of <root> found/i,
      )
    })
  })
})
