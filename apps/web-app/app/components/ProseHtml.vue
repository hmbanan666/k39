<template>
  <div v-html="html" />
</template>

<script setup lang="ts">
// Markdown HTML. Registers Meta hosts inside the fragment so the page
// footnote is present even when the link was not a Vue component.
const props = defineProps<{ html: string }>()
const { noteHtml } = useMetaNotice()

// Synchronous so a later MetaFootnote in this render sees the hosts.
noteHtml(props.html || '')
watch(() => props.html, (html) => noteHtml(html || ''))
</script>
