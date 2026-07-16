<div align="center">
  <h1>vue-call</h1>
  <p><em>Call your Vue components like async functions — they resolve with a value.</em></p>
</div>

> [!NOTE]
> This is a local Vue port of [react-call](https://github.com/desko27/react-call), cloning its API and behavior 1:1 where Vue's reactivity model allows it. It isn't published to npm — see [`../vue-call-test`](../vue-call-test) for a runnable example that aliases straight to this package's source.

`createCallable()` turns a Vue component into something you can `await`.

Good fits: confirmations, dialogs, form modals, toasts, notifications, context
menus, pickers — any UI that conceptually returns a value to its caller.

## Contents

- [Getting started](#getting-started)
  - [1. 🧩 Declare](#1--declare)
  - [2. 📡 Root](#2--root)
  - [3. ▶️ Call \& Await](#3-️-call--await)
- [Advanced usage](#advanced-usage)
  - [End from caller](#end-from-caller)
  - [Update](#update)
  - [Upsert](#upsert)
- [Exit animations](#exit-animations)
- [Passing Root props](#passing-root-props)
- [Mutation flow](#mutation-flow)
  - [Optional mutationFn](#optional-mutationfn)
  - [Payload](#payload)
- [Multi-preview hosts (Storybook, Histoire, …)](#multi-preview-hosts-storybook-histoire-)
  - [With static providers](#with-static-providers)
  - [With reactive providers](#with-reactive-providers)
  - [Options](#options)
- [FAQ](#faq)
    - [What if more than one call is active?](#what-if-more-than-one-call-is-active)
    - [Can I place more than one Root?](#can-i-place-more-than-one-root)
- [TypeScript types](#typescript-types)
- [Errors](#errors)
- [Lazy loading](#lazy-loading)
- [SSR](#ssr)
- [Hot reload (HMR) — current limitations](#hot-reload-hmr--current-limitations)

# Getting started

Not published to npm yet — for now, point your app at this package's source instead of installing it. The simplest way is a Vite alias (no build step, edits hot-reload):

```ts
// vite.config.ts
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^vue-call$/,
        replacement: fileURLToPath(new URL('../vue-call/src/main.ts', import.meta.url)),
      },
    ],
  },
})
```

See [`../vue-call-test`](../vue-call-test) for a full working example, including the `vue-call/mutation-flow` and `vue-call/host` sub-path aliases.

We'll setup a confirmation dialog, but you can setup any component to be callable.

## 1. 🧩 Declare

```vue
<!-- Confirm.vue -->
<script setup lang="ts">
import type { PropsWithCall } from 'vue-call'

defineProps<PropsWithCall<{ message: string }, boolean, {}>>()
</script>

<template>
  <div role="dialog">
    <p>{{ message }}</p>
    <button type="button" @click="call.end(true)">Yes</button>
    <button type="button" @click="call.end(false)">No</button>
  </div>
</template>
```

```ts
// confirm.ts
import { createCallable } from 'vue-call'
import ConfirmComponent from './Confirm.vue'

export const Confirm = createCallable<{ message: string }, boolean>(ConfirmComponent)
```

Along with your props, there is a special `call` prop containing the `end()` method, which you can use to finish the call and return a response. `ref`, computed state, lifecycle hooks and any other Composition API feature are totally fine too — `Confirm.vue` is a normal component.

## 2. 📡 Root

The Callable itself is the mounting point — it listens to every call and renders the active ones. Place it anywhere visible when making calls, for instance in `App.vue`:

```diff
  <template>
+   <Confirm />
    <!--  ^-- it will render active calls -->
  </template>
```

`<Confirm.Root />` is also available as an explicit alias — `Confirm.Root === Confirm` — for when you'd rather spell out that it's the mounting point.

## 3. ▶️ Call & Await

You're all done! Now you can do this anywhere in your codebase:

```ts
//        ↙ response             props ↘
const accepted = await Confirm.call({ message: 'Continue?' })
```

# Advanced usage

## End from caller

The returned promise can be used to end the call from the caller scope:

```ts
const promise = Confirm.call({ message: 'Continue?' })

// For example, on some event subscription
onImportantEvent(() => {
  Confirm.end(promise, false)
})

// And still await the response where needed
const accepted = await promise
```

While the promise argument is used to target that specific call, all ongoing calls can be affected by omitting it:

```ts
// All confirm calls are ended with `false`
Confirm.end(false)
```

## Update

The returned promise can also be used to update the call props on the fly:

```ts
const promise = Alert.call({ message: 'Starting operation...' })
await asyncOperation()
Alert.update(promise, { message: 'Completed!' })
```

While the promise argument is used to target that specific call, all ongoing calls can be affected by omitting it:

```ts
// All alert calls are updated with the new message prop
Alert.update({ message: 'Completed!' })
```

## Upsert

If you need to ensure only one instance of a component is active at a time, use `upsert()` instead of `call()`. This is particularly useful for notifications, loading states, or any singleton-like UI:

```ts
// First call creates a new instance
const promise1 = Toast.upsert({ message: 'Loading...' })

// Second call updates the existing instance instead of creating a new one
const promise2 = Toast.upsert({ message: 'Almost done...' })

// promise1 === promise2 (same instance)
console.log(promise1 === promise2) // true
```

The `upsert()` method behaves as follows:

- Creates a new instance if no upsert instance is currently active
- Updates the existing upsert instance if one is already active
- Does not affect normal `call()` instances
- Creates a new instance if the previous upsert instance was ended

```ts
// Example: progress notification that updates itself
const showProgress = async () => {
  Toast.upsert({ message: 'Starting download...' })

  for (let i = 0; i <= 100; i += 10) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    Toast.upsert({ message: `Progress: ${i}%` })
  }

  Toast.end()
}
```

# Exit animations

To animate the exit of your component when `call.end()` is run, just pass the duration of your animation in milliseconds to createCallable as a second argument:

```diff
+ const UNMOUNTING_DELAY = 500

  export const Confirm = createCallable<Props, Response>(
    ConfirmComponent,
+   UNMOUNTING_DELAY,
  )
```

```vue
<template>
  <div :class="{ 'exit-animation': call.ended }">
    <!-- ... -->
  </div>
</template>
```

The `call.ended` boolean may be used to apply your animation CSS class.

# Passing Root props

You can also read props from Root, which are separate from the call props. To do that, just add your RootProps type to createCallable and pass them to your Root.

Root props will be available to your component via the `call.root` object.

```diff
+ type RootProps = { userName: string }

  export const Confirm = createCallable<
    Props,
    Response,
+   RootProps
  >(ConfirmComponent)
```

```vue
<template>Hi {{ call.root.userName }}!</template>
```

```diff
  <Confirm
+   userName="John Doe"
  />
```

You may want to use Root props if you need to:

- Share the same piece of data to every call
- Use something that is available in Root's parent
- Update your active call components on data changes

Root props are reactive: change the value passed to `<Confirm userName="..." />` and every active call re-renders with the new one — no special wiring needed, it's plain Vue reactivity.

# Mutation flow

Use `useMutationFlow` from `vue-call/mutation-flow` to wire the call to an async action. The composable manages `pending` for you, and because closing the call requires an explicit `call.end()`, a `mutationFn` that doesn't reach `end` leaves the dialog open — the user can retry without losing their place.

```vue
<script setup lang="ts">
import type { PropsWithCall } from 'vue-call'
import { useMutationFlow, type MutationFn } from 'vue-call/mutation-flow'

const props = defineProps<
  PropsWithCall<{ mutationFn: MutationFn<boolean> }, boolean, {}>
>()

// A getter, not `props.mutationFn` directly: setup() runs once per
// component instance (unlike a React function component's body, which
// re-runs every render), so a plain value would freeze at whatever
// mutationFn was on the first call — Callable.update() swapping it
// mid-call would silently do nothing without the getter.
const submit = useMutationFlow(props.call, () => props.mutationFn)
</script>

<template>
  <div role="dialog">
    <button type="button" :disabled="submit.pending" @click="submit()">Yes</button>
    <button type="button" @click="call.end(false)">No</button>
  </div>
</template>
```

```ts
await Confirm.call({
  mutationFn: async (call) => {
    await api.delete(id)
    call.end(true)
  },
})
```

The `mutationFn` receives the call context and decides when — if ever — to close.

## Optional mutationFn

If a caller may omit `mutationFn`, type the prop as optional and chain `.orEnd(value)` at the callsite. The chain fires only when no `mutationFn` was provided; with one, it's a no-op.

```vue
<script setup lang="ts">
const props = defineProps<
  PropsWithCall<{ mutationFn?: MutationFn<boolean> }, boolean, {}>
>()
const submit = useMutationFlow(props.call, () => props.mutationFn)
</script>

<template>
  <!--                            closes with `true` if no mutationFn ↓ -->
  <button type="button" :disabled="submit.pending" @click="submit().orEnd(true)">Yes</button>
</template>
```

## Payload

`MutationFn` is `<Response, Payload>`-shaped. `Payload` is the second generic and defaults to `void`, so `submit()` takes no argument unless you opt in.

```vue
<script setup lang="ts">
type Props = { mutationFn: MutationFn<boolean, { name: string }> }
//                                             ↑ payload type

const props = defineProps<PropsWithCall<Props, boolean, {}>>()
const name = ref('')
const submit = useMutationFlow(props.call, () => props.mutationFn)
</script>

<template>
  <div role="dialog">
    <input v-model="name" />
    <button type="button" @click="submit({ name })">Create</button>
  </div>
</template>
```

```ts
await Create.call({
  mutationFn: async (call, payload) => {
    //                       ↑ typed as { name: string }
    await api.create(payload.name)
    call.end(true)
  },
})
```

The payload is typed end-to-end — the trigger callsite and the handler share the same `Payload` generic — and it lives at the callsite, so triggers in the same component can forward different payloads (useful for pickers, where each option carries its own data).

# Multi-preview hosts (Storybook, Histoire, …)

Tools that render multiple stories side-by-side (Storybook's autodocs page, Histoire, …) create trouble if each story's decorator mounts `<Confirm />` — every preview registers its own listener, and `Confirm.call()` throws `Multiple instances of <Root> found!` the moment any preview's button is clicked.

`vue-call/host` exposes a `mount()` helper that puts a single Root in a body-level `<div>` outside the previews. Call it once from your host's preview entry file (e.g. `.storybook/preview.ts`); your story decorators don't need to render Callables at all.

```ts
// .storybook/preview.ts
import { mount } from 'vue-call/host'
import { Confirm } from '../src/confirm'

mount(Confirm)

const preview = { /* normal Storybook config */ }
export default preview
```

That's it for the simple case. Your app's own `<Confirm />` mount stays where it is — this helper only handles the preview environment. If you were previously rendering `<Confirm />` from inside a story decorator, drop it from the decorator. The mount is idempotent — calling it again re-renders the same host app instead of creating a second one, and an open `Confirm.call()` survives that.

## With static providers

The Confirm renders in its own Vue app, separate from every story preview — it doesn't inherit `provide`/`inject` context from your story decorators. If it needs a theme, locale, or router, pass a wrapper component:

```vue
<!-- ThemeProvider.vue -->
<script setup lang="ts">
provide('theme', 'light')
</script>

<template><slot /></template>
```

```ts
import { mount } from 'vue-call/host'
import { Confirm } from '../src/confirm'
import ThemeProvider from './ThemeProvider.vue'

mount(Confirm, { wrapper: ThemeProvider })
```

## With reactive providers

Unlike per-render frameworks, a Vue wrapper's `provide()` value can just be a `ref` — no extra subscription plumbing is needed for it to stay live. If your provider depends on external state (a Pinia store, Storybook globals bridged into a ref), read it directly inside the wrapper:

```vue
<!-- ReactiveTheme.vue -->
<script setup lang="ts">
import { useThemeStore } from '../src/stores/theme'

const theme = useThemeStore()
provide('theme', theme)
</script>

<template><slot /></template>
```

```ts
mount(Confirm, { wrapper: ReactiveTheme })
```

External stores (Pinia, or anything backed by Vue's reactivity) work the same way — both trees subscribe to the same source of truth.

## Options

```ts
mount(component, {
  wrapper?: Component,
  container?: HTMLElement, // default: <div data-vue-call-host> in document.body
})
```

Works wherever Vue's `createApp().mount()` does.

# FAQ

### What if more than one call is active?

`<Root>` works as a call stack. Multiple calls will render one after another (newer below, which is one on top of the other if your CSS is position fixed/absolute).

### Can I place more than one Root?

No. There can only be one `<Root>` mounted per createCallable(). Avoid placing it in multiple locations of the Vue tree loaded at once — an error will be thrown if so.

If you specifically need this in a sandbox host (Storybook autodocs, Histoire, …), see [Multi-preview hosts](#multi-preview-hosts-storybook-histoire-) for the supported pattern.

# TypeScript types

You won't need them most likely, but if you want to split the component declaration and such, the public types are available as named exports:

```ts
import type { UserComponent, CallContext } from 'vue-call'
```

Type | Description
--- | ---
CallFunction<Props?, Response?> | The call() method
UpsertFunction<Props?, Response?> | The upsert() method
CallContext<Props?, Response?, RootProps?> | The call prop in UserComponent
PropsWithCall<Props?, Response?, RootProps?> | Your props + the call prop
UserComponent<Props?, Response?, RootProps?> | What is passed to createCallable
Callable<Props?, Response?, RootProps?> | What createCallable returns

# Errors

Error | Solution
--- | ---
No \<Root> found! | You forgot to place the Root, check the [Root section](#2--root). If it's already in place but not present by the time you call(), you may want to place it higher in your Vue tree. If you're getting this error on the server see [SSR](#ssr).
Multiple instances of \<Root> found! | You placed more than one Root, check the [Root section](#2--root). If you're hitting this in Storybook or another multi-preview tool, see [Multi-preview hosts](#multi-preview-hosts-storybook-histoire-).

# Lazy loading

If your callable carries a heavy payload (rich-text editor, chart library, big form), wrap it with Vue's `defineAsyncComponent` so the chunk only ships when the call fires.

```ts
import { createCallable } from 'vue-call'
import { defineAsyncComponent } from 'vue'

const Confirm = createCallable(
  defineAsyncComponent({
    loader: () => import('./Confirm.vue'),
    loadingComponent: Spinner,
    delay: 200,
  }),
)
```

- The lazy module must default-export the user component (`defineAsyncComponent` requirement — any `.vue` SFC already does this).
- The first call waits for the chunk to download; `loadingComponent` (or a wrapping `<Suspense>`) signals "something's loading" while it does.
- Subsequent calls are instant; the chunk is cached by the browser.

# SSR

✅ vue-call supports Server Side Rendering. Both `createCallable` and the Root component render fine on the server — there's no extra plumbing needed on Vue's side (unlike React's `useSyncExternalStore`, a plain `shallowRef` starts empty and stays empty until a client mounts, so server and client never disagree).

However, bear in mind that because the `call()` method is meant to be triggered by user interaction, it is designed as a client-only feature.

> [!CAUTION]
> If `call()` is run on the server a "No \<Root> found!" error will be thrown — the store only starts tracking a mounted Root once `onMounted` fires, which never happens during SSR. As long as you don't run the `call()` method on the server you'll be fine.

# Hot reload (HMR) — current limitations

This port does not (yet) include an equivalent of `react-call`'s `displayName` HMR-persistence registry or its optional Vite plugin. If `createCallable(...)` lives in a plain `.ts`/`.vue` module and you edit that module while a dialog is open, Vite's default HMR propagation for non-accepting modules will reset the store (or, depending on what imports it, trigger a full reload) rather than preserve the open call. Editing files that _don't_ define the Callable itself (most day-to-day UI work) is unaffected.
