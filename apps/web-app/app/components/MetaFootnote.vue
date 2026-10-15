<template>
  <p
    v-if="show && footnote"
    class="meta-footnote"
  >
    {{ footnote }}
  </p>
</template>

<script setup lang="ts">
const { footnote, claimFootnote } = useMetaNotice()
const show = claimFootnote()
</script>

<style scoped>
.meta-footnote {
  margin: var(--space-6) 0 var(--space-2);
  color: var(--muted);
  font-size: var(--step--1);
  line-height: 1.45;
}
</style>
