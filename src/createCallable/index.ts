import { defineComponent, h, onMounted, onUnmounted } from 'vue'
import { createStackStore } from './store'
import type { Resolve } from './types.private'
import type {
  Callable,
  CallContext,
  UserComponent as UserComponentType,
} from './types.public'

export function createCallable<
  Props = void,
  Response = void,
  RootProps extends Record<string, unknown> = Record<string, never>,
>(
  UserComponent: UserComponentType<Props, Response, RootProps>,
  unmountingDelay = 0,
): Callable<Props, Response, RootProps> {
  const storeRef: {
    current: ReturnType<typeof createStackStore<Props, Response>>
  } = { current: createStackStore<Props, Response>() }

  const createEnd =
    (promise: Promise<Response> | null) => (response: Response) => {
      // Capture exactly which calls this end() resolves now. `set` runs
      // `updateFn` once per targeted call — for a targeted end that's a
      // single call, for an end-all (promise === null) it's every call
      // currently in the stack. The deferred removal then clears only
      // those, so calls added later in the same tick (e.g. an end-all
      // immediately followed by call()) are never clobbered.
      const ending = new Set<Promise<Response>>()
      storeRef.current.set(promise, (call) => {
        call.resolve(response)
        ending.add(call.promise)
        return { ...call, ended: true }
      })
      globalThis.setTimeout(
        () => storeRef.current.remove(ending),
        unmountingDelay,
      )
    }

  const assertSingleRoot = () => {
    const rootCount = storeRef.current.getRootCount()
    if (!rootCount) throw new Error('No <Root> found!')
    if (rootCount > 1) throw new Error('Multiple instances of <Root> found!')
  }

  const call: Callable<Props, Response, RootProps>['call'] = (props: Props) => {
    assertSingleRoot()

    let resolve!: Resolve<Response>
    const promise = new Promise<Response>((res) => {
      resolve = res
    })

    storeRef.current.add({
      props,
      end: createEnd(promise),
      ended: false,
      promise,
      resolve,
    })

    return promise
  }

  const upsert: Callable<Props, Response, RootProps>['upsert'] = (
    props: Props,
  ) => {
    assertSingleRoot()

    const existing = storeRef.current.getUpsertPromise()
    if (existing) {
      storeRef.current.set(existing, (c) => ({ ...c, props }))
      return existing
    }

    let resolve!: Resolve<Response>
    const promise = new Promise<Response>((res) => {
      resolve = res
    })
    storeRef.current.setUpsertPromise(promise)

    storeRef.current.add({
      props,
      end: (response: Response) => {
        storeRef.current.setUpsertPromise(null)
        createEnd(promise)(response)
      },
      ended: false,
      promise,
      resolve,
    })

    return promise
  }

  const end: Callable<Props, Response, RootProps>['end'] = (
    ...args: [Promise<Response>, Response] | [Response]
  ) => {
    const targeted = args.length === 2
    const promise = targeted ? args[0] : null
    const response = targeted ? args[1] : args[0]

    if (!targeted || promise === storeRef.current.getUpsertPromise())
      storeRef.current.setUpsertPromise(null)

    return createEnd(promise)(response)
  }

  const update: Callable<Props, Response, RootProps>['update'] = (
    ...args: [Promise<Response>, Partial<Props>] | [Partial<Props>]
  ) => {
    const targeted = args.length === 2
    storeRef.current.set(targeted ? args[0] : null, (c) => ({
      ...c,
      props: { ...c.props, ...(targeted ? args[1] : args[0]) },
    }))
  }

  // `inheritAttrs: false` + reading `attrs` (rather than a declared `props`
  // option) is what lets Root accept an arbitrary RootProps shape at
  // runtime: the generic isn't known until the consumer calls
  // createCallable, so there's nothing to declare a static `props` list
  // from. `attrs` is a shallow-reactive proxy, so `call.root` stays live
  // when the consumer changes a prop on `<Confirm.Root />`.
  const Root = defineComponent({
    name: 'Root',
    inheritAttrs: false,
    setup(_, { attrs }) {
      // Registered on mount (not here in setup, which also runs during
      // SSR): onMounted never fires server-side, so a store reused across
      // SSR requests never leaks a rootCount increment with no matching
      // decrement — mirrors useSyncExternalStore's subscribe, which is
      // likewise client-only.
      let unregister: (() => void) | undefined
      onMounted(() => {
        unregister = storeRef.current.registerRoot()
      })
      onUnmounted(() => unregister?.())

      return () =>
        storeRef.current.stack.value.map(
          ({ props, key, end: callEnd, ended }, index, stack) =>
            h(UserComponent, {
              ...props,
              key,
              call: {
                key,
                end: callEnd,
                ended,
                root: attrs as RootProps,
                index,
                stackSize: stack.length,
              } satisfies CallContext<Props, Response, RootProps>,
            }),
        )
    },
  })

  const callable = Object.assign(Root, {
    Root,
    call,
    upsert,
    end,
    update,
  })

  return callable as unknown as Callable<Props, Response, RootProps>
}
