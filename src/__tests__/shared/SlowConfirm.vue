<script setup lang="ts">
import type { PropsWithCall } from '../../createCallable/types.public'

defineProps<PropsWithCall<{ message: string }, boolean, Record<string, never>>>()
</script>

<template>
  <div role="dialog" :aria-label="message" :data-ended="String(call.ended)">
    <p>{{ message }}</p>
    <button type="button" @click="call.end(true)">Yes</button>
    <button type="button" @click="call.end(false)">No</button>
  </div>
</template>
