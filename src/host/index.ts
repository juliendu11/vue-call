import { type App, type Component, createApp, defineComponent, h, shallowRef } from 'vue'

// vue-call/host — imperative mount for environments that render multiple
// isolated Vue subtrees in parallel for previewing (Storybook, Histoire,
// etc). Mounting a Callable per-subtree from a decorator triggers the
// multi-root throw (assertSingleRoot), so this helper mounts a single
// shared Root once via its own createApp, outside the previewed subtrees.
//
// Unlike React's createRoot, a Vue app's root component is fixed at
// createApp() time and can't be swapped by calling render again — so the
// host keeps its own reactive `content` ref and a tiny wrapper component
// that re-renders whenever mount() is called again.

export interface MountOptions {
  wrapper?: Component
  container?: HTMLElement
}

interface Content {
  component: Component
  wrapper?: Component
}

interface HostState {
  app: App
  container: HTMLElement
  content: ReturnType<typeof shallowRef<Content | null>>
}

// Symbol.for keeps the cached host stable across module re-evaluations so
// an open call survives edits. globalThis is the only storage that
// outlives module identity.
const HOST_KEY = Symbol.for('vue-call.host')

const createHostContainer = (): HTMLElement => {
  const div = document.createElement('div')
  div.setAttribute('data-vue-call-host', '')
  document.body.appendChild(div)
  return div
}

export function mount(component: Component, options: MountOptions = {}): void {
  const store = globalThis as { [HOST_KEY]?: HostState }
  const cached = store[HOST_KEY]
  if (cached) {
    cached.content.value = { component, wrapper: options.wrapper }
    return
  }

  const container = options.container ?? createHostContainer()
  const content = shallowRef<Content | null>({
    component,
    wrapper: options.wrapper,
  })

  // `content` is captured by closure, not passed as a declared prop: an
  // app's root props are a plain object fixed at createApp() time, so a
  // ref assigned as a prop value would hand the component the Ref
  // instance itself (not its unwrapped, live-updating current value).
  // Reading `content.value` directly inside the render function is what
  // keeps re-mount()s reactive on this single, never-recreated app.
  const HostRoot = defineComponent({
    name: 'VueCallHostRoot',
    setup() {
      return () => {
        const current = content.value
        if (!current) return null
        const { component: c, wrapper } = current
        return wrapper ? h(wrapper, () => h(c)) : h(c)
      }
    },
  })

  const app = createApp(HostRoot)
  app.mount(container)
  store[HOST_KEY] = { app, container, content }
}
