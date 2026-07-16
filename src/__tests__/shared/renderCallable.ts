import { type Component, type ComponentPublicInstance, defineComponent, h } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach } from 'vitest'

const wrappers: VueWrapper<ComponentPublicInstance>[] = []

// @vue/test-utils has no built-in auto-cleanup between tests (unlike RTL's
// render(), which unmounts automatically via a global afterEach). Root's
// assertSingleRoot() throws on more than one mounted instance of the same
// Callable, so leaked mounts from a previous test would break later ones
// in the same file — track every mount and tear it down here instead.
afterEach(() => {
  for (const wrapper of wrappers.splice(0)) wrapper.unmount()
})

export function renderCallable(
  component: Component,
  props: Record<string, unknown> = {},
): VueWrapper<ComponentPublicInstance> {
  const wrapper = mount(component, { props })
  wrappers.push(wrapper)
  return wrapper
}

// A tiny host so isolation tests can mount two independent Callables
// (which otherwise each require their own single <Root>) side by side,
// the same way the source library's tests render `<><A /><B /></>`.
export function renderMultiple(components: Component[]): VueWrapper<ComponentPublicInstance> {
  const Host = defineComponent({
    name: 'MultiHost',
    setup() {
      return () => components.map((c) => h(c))
    },
  })
  const wrapper = mount(Host)
  wrappers.push(wrapper)
  return wrapper
}
