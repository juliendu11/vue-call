import { describe, expect, test } from 'vitest'
import { Confirm } from './shared/Confirm'
import { flush } from './shared/flush'
import { renderCallable } from './shared/renderCallable'

describe('update()', () => {
  describe('target promise', () => {
    test('updates params one time', async () => {
      const wrapper = renderCallable(Confirm)
      const promise = Confirm.call({ message: 'one' })
      await flush()
      Confirm.update(promise, { message: 'two' })
      await flush()
      expect(wrapper.find('[aria-label="two"]').exists()).toBe(true)
    })

    test('updates params multiple times', async () => {
      const wrapper = renderCallable(Confirm)
      const promise = Confirm.call({ message: 'one' })
      await flush()
      Confirm.update(promise, { message: 'two' })
      await flush()
      Confirm.update(promise, { message: 'three' })
      await flush()
      expect(wrapper.find('[aria-label="three"]').exists()).toBe(true)
      Confirm.update(promise, { message: 'four' })
      await flush()
      expect(wrapper.find('[aria-label="four"]').exists()).toBe(true)
    })
  })

  describe('all', () => {
    test('update params one time', async () => {
      const wrapper = renderCallable(Confirm)
      Confirm.call({ message: 'one' })
      Confirm.call({ message: 'one' })
      Confirm.call({ message: 'one' })
      await flush()
      Confirm.update({ message: 'two' })
      await flush()
      expect(wrapper.findAll('[aria-label="two"]')).toHaveLength(3)
    })

    test('update params multiple times', async () => {
      const wrapper = renderCallable(Confirm)
      Confirm.call({ message: 'one' })
      Confirm.call({ message: 'one' })
      Confirm.call({ message: 'one' })
      await flush()
      Confirm.update({ message: 'two' })
      await flush()
      Confirm.update({ message: 'three' })
      await flush()
      expect(wrapper.findAll('[aria-label="three"]')).toHaveLength(3)
      Confirm.update({ message: 'four' })
      await flush()
      expect(wrapper.findAll('[aria-label="four"]')).toHaveLength(3)
    })
  })
})
