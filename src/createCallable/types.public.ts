import type { Component } from 'vue'
import type { CallItemPublicProperties } from './store'

/**
 * The call() method
 */
export type CallFunction<Props, Response> = (props: Props) => Promise<Response>

/**
 * The upsert() method
 */
export type UpsertFunction<Props, Response> = (
  props: Props,
) => Promise<Response>

/**
 * The special call prop in UserComponent
 */
export type CallContext<Props, Response, RootProps> = CallItemPublicProperties<
  Props,
  Response
> & {
  root: RootProps
  index: number
  stackSize: number
}

/**
 * User props + the call prop
 */
export type PropsWithCall<Props, Response, RootProps> = Props & {
  call: CallContext<Props, Response, RootProps>
}

/**
 * What is passed to createCallable. Typically the default export of a
 * `<script setup>` SFC, so it keeps full access to Vue's composition API
 * (refs, lifecycle hooks, composables) — unlike a plain functional
 * component, which has no setup phase.
 */
export type UserComponent<Props, Response, RootProps> = Component<
  PropsWithCall<Props, Response, RootProps>
>

/**
 * What createCallable returns.
 *
 * The Callable is the Root component itself — mount it with `<Confirm />`
 * and use the imperative methods (`call`, `upsert`, `end`, `update`) as
 * properties on the same object. Vue resolves components by reference, so
 * `Object.assign`-ing the extra methods onto the component definition
 * keeps both the template usage and the imperative API on one export.
 */
export type Callable<Props, Response, RootProps> = Component<RootProps> & {
  /**
   * Alias for the callable itself — `Confirm.Root === Confirm`. Kept for
   * parity with the source library, where `<Component />` cannot carry
   * static properties the way a component object can here.
   */
  Root: Component<RootProps>
  call: CallFunction<Props, Response>
  upsert: UpsertFunction<Props, Response>
  end: ((promise: Promise<Response>, response: Response) => void) &
    ((response: Response) => void)
  update: ((promise: Promise<Response>, props: Partial<Props>) => void) &
    ((props: Partial<Props>) => void)
}
