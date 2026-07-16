import { shallowRef } from 'vue'
import type { Resolve } from './types.private'

type Stack<Props, Response> = CallItem<Props, Response>[]

type CallItem<Props, Response> = CallItemPublicProperties<Props, Response> & {
  props: Props
  promise: Promise<Response>
  resolve: Resolve<Response>
}

export type CallItemPublicProperties<_, Response> = {
  key: string
  end: (response: Response) => void
  ended: boolean
}

// Vue's reactivity already does the job React's useSyncExternalStore needs
// external plumbing for: a `shallowRef` IS the subscribable store, and any
// component reading `stack.value` inside its render is auto-tracked. What's
// left to hand-roll is the concept React gets from listener count — how
// many <Root> instances are currently mounted, used by assertSingleRoot()
// and to know when to reset the stack (last Root unmounting).
export function createStackStore<Props, Response>() {
  let nextKey = 0
  const stack = shallowRef<Stack<Props, Response>>([])
  let upsertPromise: Promise<Response> | null = null
  let rootCount = 0

  return {
    stack,
    add: (call: Omit<CallItem<Props, Response>, 'key'>) => {
      stack.value = [...stack.value, { ...call, key: String(nextKey++) }]
    },
    set: (
      promise: Promise<Response> | null,
      updateFn: (call: CallItem<Props, Response>) => CallItem<Props, Response>,
    ) => {
      stack.value = stack.value.map((call) =>
        promise && call.promise !== promise ? call : updateFn(call),
      )
    },
    remove: (promises: Set<Promise<Response>>) => {
      stack.value = stack.value.filter((c) => !promises.has(c.promise))
    },
    registerRoot: () => {
      rootCount++
      return () => {
        rootCount--
        if (!rootCount) {
          nextKey = 0
          stack.value = []
          upsertPromise = null
        }
      }
    },
    getRootCount: () => rootCount,
    getUpsertPromise: () => upsertPromise,
    setUpsertPromise: (p: Promise<Response> | null) => {
      upsertPromise = p
    },
  }
}
