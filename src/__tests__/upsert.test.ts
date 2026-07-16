import { describe, expect, test } from 'vitest'
import { Confirm } from './shared/Confirm'
import { flush, flushEnd } from './shared/flush'
import { renderCallable } from './shared/renderCallable'

describe('upsert()', () => {
  test('creates new instance when called without existing instance', async () => {
    const wrapper = renderCallable(Confirm)
    Confirm.upsert({ message: 'Hello' })
    await flush()
    expect(wrapper.find('[aria-label="Hello"]').exists()).toBe(true)
  })

  test('updates existing instance when called with existing instance', async () => {
    const wrapper = renderCallable(Confirm)

    const promise1 = Confirm.upsert({ message: 'First' })
    await flush()
    expect(wrapper.find('[aria-label="First"]').exists()).toBe(true)

    const promise2 = Confirm.upsert({ message: 'Updated' })
    await flush()
    expect(wrapper.find('[aria-label="Updated"]').exists()).toBe(true)

    expect(wrapper.findAll('[role="dialog"]')).toHaveLength(1)
    expect(promise1).toBe(promise2)
  })

  test('does not affect normal calls', async () => {
    const wrapper = renderCallable(Confirm)

    Confirm.call({ message: 'Normal 1' })
    await flush()
    expect(wrapper.find('[aria-label="Normal 1"]').exists()).toBe(true)

    Confirm.upsert({ message: 'Upsert 1' })
    await flush()
    expect(wrapper.find('[aria-label="Upsert 1"]').exists()).toBe(true)

    Confirm.call({ message: 'Normal 2' })
    await flush()
    expect(wrapper.find('[aria-label="Normal 2"]').exists()).toBe(true)

    expect(wrapper.findAll('[role="dialog"]')).toHaveLength(3)

    Confirm.upsert({ message: 'Upsert Updated' })
    await flush()
    expect(wrapper.find('[aria-label="Upsert Updated"]').exists()).toBe(true)

    expect(wrapper.findAll('[role="dialog"]')).toHaveLength(3)
  })

  test('creates new instance after previous one is ended', async () => {
    const wrapper = renderCallable(Confirm)

    Confirm.upsert({ message: 'First' })
    await flush()
    expect(wrapper.find('[aria-label="First"]').exists()).toBe(true)

    await wrapper.find('button:nth-of-type(1)').trigger('click')
    await flushEnd()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)

    Confirm.upsert({ message: 'Second' })
    await flush()
    expect(wrapper.find('[aria-label="Second"]').exists()).toBe(true)
  })

  test('creates new instance after previous one is ended externally', async () => {
    const wrapper = renderCallable(Confirm)

    Confirm.upsert({ message: 'First' })
    await flush()
    expect(wrapper.find('[aria-label="First"]').exists()).toBe(true)

    Confirm.end(false)
    await flushEnd()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)

    Confirm.upsert({ message: 'Second' })
    await flush()
    expect(wrapper.find('[aria-label="Second"]').exists()).toBe(true)
  })
})
