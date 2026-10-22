<template>
  <component
    :is="href ? 'a' : 'div'"
    class="postcard"
    :class="[captionStyle, stampPlace, { 'tilted': !!tilt, 'has-stamp': showStamp }]"
    :style="frameStyle"
    :href="href || undefined"
  >
    <span
      v-if="showStamp"
      class="corner"
    >
      <Stamp
        :src="stampSrc"
        :label="stampLabel"
        :size="stampSize"
      />
    </span>
    <img
      v-if="postmark"
      class="postmark"
      :src="POSTMARK_SRC"
      alt=""
      width="260"
      height="140"
    >
    <slot
      v-if="$slots.art"
      name="art"
    />
    <img
      v-else
      class="art"
      :src="src"
      :alt="alt"
      :width="width"
      :height="height"
      :loading="priority ? 'eager' : 'lazy'"
      :fetchpriority="priority ? 'high' : undefined"
    >
    <div
      v-if="caption || meta"
      class="cap"
      :class="[captionStyle, metaPlace]"
    >
      <component
        :is="captionTag"
        class="caption"
      >
        {{ caption }}
      </component>
      <small v-if="meta">{{ meta }}</small>
    </div>
    <div
      v-if="$slots.default"
      class="extra"
    >
      <slot />
    </div>
  </component>
</template>

<script setup lang="ts">
import { POSTMARK_SRC } from '~~/shared/illustrations'

const props = withDefaults(defineProps<{
  src: string
  alt: string
  caption?: string
  meta?: string
  captionTag?: 'p' | 'h3'
  captionStyle?: 'script' | 'title'
  metaPlace?: 'aside' | 'below'
  href?: string
  tilt?: string
  stampSrc?: string
  stampLabel?: string
  stampSize?: 'sm' | 'md'
  stampPlace?: 'in' | 'out'
  postmark?: boolean
  priority?: boolean
  ratio?: string
  width?: number
  height?: number
}>(), {
  caption: '',
  meta: '',
  captionTag: 'p',
  captionStyle: 'script',
  metaPlace: 'aside',
  href: '',
  tilt: '',
  stampSrc: '',
  stampLabel: '',
  stampSize: 'md',
  stampPlace: 'out',
  postmark: false,
  priority: false,
  ratio: '3 / 2',
  width: 640,
  height: 400,
})

const showStamp = computed(() => Boolean(props.stampSrc || props.stampLabel))
const frameStyle = computed(() => ({
  '--ratio': props.ratio,
  ...(props.tilt ? { transform: `rotate(${props.tilt})` } : {}),
}))
</script>

<style scoped>
.postcard {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 10px 10px 12px;
  border: 1px solid var(--color-line);
  border-radius: 6px;
  background: var(--color-surface);
  color: inherit;
  text-decoration: none;
  box-shadow: var(--shadow-card);
}
.tilted {
  border: 0;
  padding: 12px 12px 8px;
  box-shadow: var(--shadow-postcard);
}
.art {
  display: block;
  width: 100%;
  aspect-ratio: var(--ratio);
  object-fit: cover;
  border-radius: 2px;
  background: var(--color-sand);
}
.cap {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.6rem;
  padding: 0.7rem 0.2rem 0.15rem;
}
.caption { margin: 0; }
.script .caption {
  color: var(--color-brick-dark);
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 500;
  font-style: italic;
  line-height: 1.2;
}
.title .caption {
  flex: 1 1 auto;
  min-width: 0;
  color: var(--text);
  font-family: var(--font-display);
  font-size: 1.3rem;
  font-weight: 700;
  line-height: 1.15;
}
.script small {
  flex: none;
  color: var(--muted);
  font: 500 0.75rem/1 var(--font-body);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.title small {
  flex: none;
  color: var(--color-pine);
  font: 600 0.82rem/1 var(--font-body);
}
.below {
  flex-direction: column;
  align-items: flex-start;
  gap: 0.3rem;
}
.below small {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  color: var(--muted);
  font: 400 0.9rem/1.45 var(--font-body);
  letter-spacing: 0;
  text-align: left;
  text-transform: none;
}
.extra { padding: 0 0.15rem 0.2rem; }
.corner {
  position: absolute;
  z-index: 2;
}
.in .corner { top: 0.85rem; left: 0.85rem; }
.out .corner {
  top: -1.15rem;
  right: -0.85rem;
  transform: rotate(5deg);
}
.postmark {
  position: absolute;
  z-index: 3;
  width: 10.5rem;
  height: auto;
  pointer-events: none;
  mix-blend-mode: multiply;
  opacity: 0.88;
}
.out .postmark {
  top: -0.2rem;
  right: -2.4rem;
  transform: rotate(-8deg);
}
@media (max-width: 600px) {
  .out .corner { top: -0.7rem; right: -0.35rem; }
  .out .corner :deep(.md) { width: 4.6rem; }
  .out .postmark { top: 0.15rem; right: -1rem; width: 7.2rem; }
}
</style>
