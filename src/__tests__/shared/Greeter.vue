<script setup lang="ts">
import type { PropsWithCall } from '../../createCallable/types.public'

defineProps<
  PropsWithCall<{ message: string }, void, { userName: string }>
>()
</script>

<template>
  <div role="dialog" :aria-label="message">
    <p>Hi {{ call.root.userName }}!</p>
    <p>{{ message }}</p>
    <button type="button" @click="call.end()">OK</button>
  </div>
</template>
