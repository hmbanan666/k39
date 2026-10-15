<template>
  <a
    :href="href"
    v-bind="anchorAttrs"
  >
    <slot />
    <sup
      v-if="product"
      class="meta-mark"
      :title="hint"
    >*</sup>
  </a>
</template>

<script setup lang="ts">
import { externalLinkAttrs } from '~~/shared/links'
import { metaFootnote, metaProductFromHref } from '~~/shared/meta-links'

// Plain-text outbound link. Meta hosts get the legal asterisk and
// rel="nofollow noopener". Do not put a brand icon in the slot.
defineOptions({ inheritAttrs: false })

const props = defineProps<{ href: string }>()
const attrs = useAttrs()
const { noteHref } = useMetaNotice()
const product = computed(() => metaProductFromHref(props.href))
const hint = computed(() => (product.value ? metaFootnote([product.value]) : ''))

// Synchronous: MetaFootnote sits later in the same render.
noteHref(props.href)
watch(() => props.href, (href) => noteHref(href))

const anchorAttrs = computed(() => ({
  ...attrs,
  ...externalLinkAttrs(props.href),
}))
</script>
