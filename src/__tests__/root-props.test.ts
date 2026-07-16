import { describe, expect, test } from 'vitest'
import { createCallable } from '../createCallable'
import GreeterComponent from './shared/Greeter.vue'
import { flush } from './shared/flush'
import { renderCallable } from './shared/renderCallable'

// Fixture purpose-built for the Root-props contract: the third generic
// (`RootProps`) is what `<Greeter userName="..." />` accepts and what
// `call.root` exposes to each rendered UserComponent. The default `Confirm`
// fixture uses `RootProps = {}` so does not exercise this path.

type Props = { message: string }
type RootProps = { userName: string }

const Greeter = createCallable<Props, void, RootProps>(GreeterComponent)

describe('Root props (call.root)', () => {
  test('passes Root props through to call.root', async () => {
    const wrapper = renderCallable(Greeter, { userName: 'Ismael' })
    Greeter.call({ message: 'hello' })
    await flush()
    expect(wrapper.text()).toContain('Hi Ismael!')
    expect(wrapper.text()).toContain('hello')
  })

  test('Root prop changes re-render active calls with the new value', async () => {
    const wrapper = renderCallable(Greeter, { userName: 'Ismael' })
    Greeter.call({ message: 'hello' })
    await flush()
    expect(wrapper.text()).toContain('Hi Ismael!')

    await wrapper.setProps({ userName: 'Desko' })
    expect(wrapper.text()).toContain('Hi Desko!')
    // Same call still in the stack, only the Root prop projection changed.
    expect(wrapper.text()).toContain('hello')
  })
})
