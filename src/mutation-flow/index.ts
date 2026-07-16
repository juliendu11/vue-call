import { type MaybeRefOrGetter, ref, toValue } from 'vue'

/**
 * The narrow view of a CallContext that a MutationFn receives. Only `end`
 * — the handler has no business reading `key`, `index`, `root`, etc. and
 * keeping it minimal lets MutationFn skip the `RootProps` generic.
 */
export type MutationCall<Response> = {
  end: (response: Response) => void
}

/**
 * The async handler the caller provides as a prop of the call. Owns the
 * side effects and decides when to close the call (via `call.end`).
 */
export type MutationFn<Response, Payload = void> = (
  call: MutationCall<Response>,
  payload: Payload,
) => Promise<void>

/**
 * The callable returned by `useMutationFlow` when the MutationFn
 * parameter is non-nullable. `pending` reflects the in-flight state for
 * the UI; calling the trigger runs the MutationFn.
 */
export type Trigger<Payload> = ((payload: Payload) => void) & {
  readonly pending: boolean
}

/**
 * The callable returned by `useMutationFlow` when the MutationFn
 * parameter may be undefined. Calling the trigger returns a chain
 * object exposing `.orEnd(value)`, which the consumer uses to deliver
 * the Fallback response at the callsite. When the MutationFn is
 * actually present at runtime, `.orEnd` is a no-op.
 */
export type ChainTrigger<Payload, Response> = ((payload: Payload) => {
  orEnd: (value: Response) => void
}) & { readonly pending: boolean }

const NOOP_CHAIN = { orEnd: () => {} }

// Overloads encode the invariant "the Fallback response is reachable
// iff mutationFn may be undefined". Required handler → submit returns
// void. Possibly-undefined handler → submit returns a chain object
// whose `.orEnd(value)` delivers the fallback at the callsite.
//
// `mutationFn` accepts a getter (`() => props.mutationFn`) as well as a
// plain value: `setup()` runs once per component instance, unlike a React
// function component's body re-running every render, so a plain value
// argument would freeze `mutationFn` at whatever it was on the first
// call — Callable.update() swapping it mid-call would silently do
// nothing. Passing a getter and re-reading it via `toValue()` on every
// trigger() call keeps it live.
export function useMutationFlow<Response, Payload = void>(
  call: MutationCall<Response>,
  mutationFn: MaybeRefOrGetter<MutationFn<Response, Payload>>,
): Trigger<Payload>
export function useMutationFlow<Response, Payload = void>(
  call: MutationCall<Response>,
  mutationFn: MaybeRefOrGetter<MutationFn<Response, Payload> | undefined>,
): ChainTrigger<Payload, Response>
export function useMutationFlow<Response, Payload = void>(
  call: MutationCall<Response>,
  mutationFn: MaybeRefOrGetter<MutationFn<Response, Payload> | undefined>,
): ChainTrigger<Payload, Response> {
  const pending = ref(false)
  // Synchronous re-entry guard. `pending` alone can't guard against a
  // second call dispatched programmatically inside the same event-loop
  // turn (the ref hasn't triggered a re-render yet); the plain closure
  // variable does — useMutationFlow runs once per component instance
  // (inside setup), so this variable is as stable as a React useRef.
  let inFlight = false

  const trigger = ((payload: Payload) => {
    if (inFlight) return NOOP_CHAIN
    const fn = toValue(mutationFn)
    if (!fn) {
      return { orEnd: (value: Response) => call.end(value) }
    }
    inFlight = true
    pending.value = true
    fn(call, payload).finally(() => {
      inFlight = false
      pending.value = false
    })
    return NOOP_CHAIN
  }) as ChainTrigger<Payload, Response>

  // A getter (rather than assigning a snapshot boolean like the source
  // library does per-render) so that `submit.pending` stays reactive:
  // accessing `pending.value` here, while a render effect is evaluating
  // the template, still registers the dependency correctly — Vue tracks
  // any `.value` read during an active effect, however deeply nested.
  Object.defineProperty(trigger, 'pending', {
    enumerable: true,
    get: () => pending.value,
  })

  return trigger
}
