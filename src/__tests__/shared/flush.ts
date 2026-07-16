import { nextTick } from 'vue'

/**
 * Wait a tick so a DOM update triggered by a library call (Confirm.call,
 * Confirm.upsert, Confirm.end, Confirm.update) made from outside a
 * component's render flow has actually flushed before the test asserts
 * on it.
 *
 * Deliberately NOT `withFlush(fn)`-shaped: `Confirm.call()` / `.upsert()`
 * return a Promise<Response> that only settles when the dialog closes.
 * Any helper that both invokes the call AND `return`s its result through
 * an async function (or a `.then()` callback) gets that Promise
 * auto-adopted by the JS Promise Resolution Procedure — the helper's own
 * returned promise then silently hangs until the dialog closes. Keeping
 * "invoke" and "flush" as two separate statements at the call site avoids
 * ever handing a pending Promise to an async return.
 */
export async function flush(): Promise<void> {
  await nextTick()
}

/**
 * end() defers its actual stack removal to a macrotask (the
 * unmountingDelay setTimeout, default 0) so `call.ended` has a chance to
 * be observed first. `flush()`'s microtask-only tick isn't enough to see
 * the item actually leave the stack — wait a real macrotask, then a tick.
 */
export async function flushEnd(): Promise<void> {
  await new Promise((resolve) => globalThis.setTimeout(resolve, 0))
  await nextTick()
}
