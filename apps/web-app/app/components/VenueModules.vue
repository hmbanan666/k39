<template>
  <!-- Venue content modules (docs/venue-modules.md). Server-rendered in full. -->
  <section
    v-for="block in shown"
    :id="block.id"
    :key="block.id"
    class="vm"
    :class="`vm-${block.type}`"
  >
    <header
      v-if="block.type === 'prices'"
      class="price-head"
    >
      <div class="price-title-row">
        <h2>{{ block.title }}</h2>
        <p
          v-if="block.summary"
          class="price-badge"
          :title="block.summary.label"
          :aria-label="block.summary.label"
        >
          {{ block.summary.text }}
        </p>
      </div>
      <p class="price-lead">
        {{ block.lead }}
      </p>
    </header>
    <h2
      v-else
      :class="{ 'with-sticker': block.type === 'audience' }"
    >
      {{ block.title }}
      <Sticker
        v-if="block.type === 'audience'"
        slug="with-heart"
        :width="72"
        decorative
      />
    </h2>
    <ProseHtml
      v-if="block.type === 'text'"
      class="reader-html"
      :class="{ lead: block.variant === 'lead' }"
      :html="block.html"
    />
    <template v-else-if="block.type === 'dishes'">
      <ul class="price-grid">
        <li
          v-for="(dish, index) in block.items"
          :key="dish.id"
          class="price-item"
        >
          <div
            class="dish-card"
            :tabindex="dishHasDetail(dish) ? 0 : undefined"
            :aria-describedby="dishHasDetail(dish) ? detailId(block.id, index) : undefined"
          >
            <span class="price-row">
              <span
                class="price-art"
                :class="{ photo: Boolean(dish.media) }"
              >
                <MediaImage
                  v-if="dish.media"
                  :media="dish.media"
                  sizes="56px"
                  :show-credit="false"
                />
                <Sticker
                  v-else
                  slug="cook-with-pan"
                  :width="PRICE_STICKER_WIDTH"
                  decorative
                />
              </span>
              <span class="price-copy">
                <span class="price-name">{{ dish.name }}</span>
              </span>
              <span
                v-if="dish.priceRub"
                class="price-rub"
              >{{ formatRub(dish.priceRub) }}</span>
            </span>
          </div>
          <span
            v-if="dishHasDetail(dish)"
            :id="detailId(block.id, index)"
            class="price-detail"
            role="tooltip"
          >
            <span v-if="dish.description">{{ dish.description }}</span>
            <span
              v-if="dish.media && dishCredit(dish.media)"
              class="credit"
            >
              <span v-if="dish.media.author">{{ dish.media.author }}</span>
              <MetaLink
                v-if="licenseHref(dish.media.license)"
                :href="licenseHref(dish.media.license) || ''"
              >
                {{ licenseLabel(dish.media.license) }}
              </MetaLink>
              <span v-else-if="licenseLabel(dish.media.license)">{{ licenseLabel(dish.media.license) }}</span>
            </span>
          </span>
        </li>
      </ul>
      <p
        v-if="block.note"
        class="note"
      >
        {{ block.note }}
      </p>
      <p v-if="menuUrl">
        <UiLink
          :href="menuUrl"
          data-track="outbound"
          data-track-name="menu"
        >
          Меню целиком на сайте заведения
        </UiLink>
      </p>
    </template>
    <ul
      v-else-if="block.type === 'audience'"
      class="cards"
    >
      <li
        v-for="item in block.items"
        :key="item.who"
      >
        <p class="who">
          <span class="aud-icon"><Icon
            :name="tablerIcon(`aud-${item.icon}`)"
            size="20"
          /></span>
          {{ item.who }}
        </p>
        <ProseHtml :html="item.html" />
      </li>
    </ul>
    <dl
      v-else-if="block.type === 'practical'"
      class="practical"
    >
      <div
        v-for="item in block.items"
        :key="item.key + item.label"
      >
        <dt>
          <Icon
            :name="tablerIcon(item.key === 'other' ? 'checked' : item.key)"
            size="20"
          />
          {{ item.label }}
        </dt>
        <dd>{{ item.value }}</dd>
      </div>
    </dl>
    <ProseHtml
      v-else-if="block.type === 'best-time'"
      class="reader-html"
      :html="block.html"
    />
    <ul
      v-else-if="block.type === 'tips'"
      class="tips"
    >
      <li
        v-for="tip in block.items"
        :key="tip"
      >
        {{ tip }}
      </li>
    </ul>
    <template v-else-if="block.type === 'prices'">
      <ul class="price-grid">
        <li
          v-for="(row, index) in block.items"
          :key="row.slug + row.variant"
          class="price-item"
          :class="{ 'is-open': openDetail === detailId(block.id, index) }"
        >
          <component
            :is="row.href ? MetaLink : 'div'"
            class="price-card"
            :tabindex="row.href ? undefined : 0"
            :aria-describedby="detailId(block.id, index)"
            v-bind="row.href ? { href: row.href } : {}"
            @click="onPriceClick($event, detailId(block.id, index))"
          >
            <span class="price-row">
              <span
                class="price-art"
                aria-hidden="true"
              >
                <img
                  v-if="row.image"
                  :src="row.image"
                  alt=""
                >
                <Sticker
                  v-else-if="row.sticker"
                  set="food"
                  :slug="row.sticker"
                  :width="PRICE_STICKER_WIDTH"
                  decorative
                />
                <Icon
                  v-else
                  :name="tablerIcon(row.icon)"
                  size="28"
                />
              </span>
              <span class="price-copy">
                <span class="price-name">{{ row.title }}</span>
                <span
                  v-if="row.variant"
                  class="price-variant"
                >{{ row.variant }}</span>
              </span>
              <span class="price-rub">{{ formatRub(row.priceRub) }}</span>
            </span>
            <span
              v-if="row.comparison.band"
              class="scale"
              role="img"
              :aria-label="row.comparison.scaleLabel"
            >
              <span class="track-wrap">
                <span class="track">
                  <i :class="{ on: row.comparison.band === 'cheap' }" />
                  <i :class="{ on: row.comparison.band === 'medium' }" />
                  <i :class="{ on: row.comparison.band === 'expensive' }" />
                </span>
                <span
                  class="mark"
                  :class="row.comparison.band"
                  :style="{ '--pos': `${row.comparison.position ?? 0}%` }"
                />
              </span>
            </span>
            <span
              v-else
              class="scale scale-quiet"
              aria-hidden="true"
            >
              <i />
            </span>
          </component>
          <span
            :id="detailId(block.id, index)"
            class="price-detail"
            role="tooltip"
          >
            <span class="price-verdict">{{ row.comparison.line }}</span>
            <span class="price-facts">
              <span class="price-kicker">{{ row.comparison.town.where }}</span>
              <span>Медиана: {{ formatRub(row.comparison.town.medianRub) }}</span>
              <span>Диапазон: {{ formatTownRange(row.comparison.town) }}</span>
              <span>Мест: {{ row.comparison.town.places }}</span>
            </span>
            <span
              v-if="knownPortion(row.variant)"
              class="price-facts"
            >
              <span class="price-kicker">В этом заведении</span>
              <span>Порция: {{ knownPortion(row.variant) }}</span>
            </span>
          </span>
        </li>
      </ul>
      <p
        v-if="block.source"
        class="price-foot price-sources"
      >
        <UiLink
          v-if="block.source.url"
          :href="block.source.url"
          data-track="outbound"
          data-track-name="price-source"
        >
          {{ block.source.title }}
        </UiLink>
        <template v-else>
          {{ block.source.title }}
        </template>,
        <time :datetime="block.source.date">{{ formatPriceDate(block.source.date) }}</time>
        Цены могли измениться.
      </p>
    </template>
    <div
      v-else-if="block.type === 'faq'"
      class="faq"
    >
      <details
        v-for="item in block.items"
        :key="item.question"
        open
      >
        <summary>{{ item.question }}</summary>
        <ProseHtml :html="item.html" />
      </details>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { PublicMedia } from '~~/shared/media'
import type { PublicDish, PublicVenueModule } from '~~/shared/venue-modules'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { tablerIcon } from '~~/shared/icons'
import { licenseHref, licenseLabel } from '~~/shared/media'
import { formatPriceDate, formatRub, formatTownRange, knownPortion, PRICE_STICKER_WIDTH, priceCardTap } from '~~/shared/price-compare'
import { presentVenueBlocks } from '~~/shared/venue-modules'
import MetaLink from './MetaLink.vue'

const props = defineProps<{ blocks: PublicVenueModule[], menuUrl?: string | null }>()
const shown = computed(() => presentVenueBlocks(props.blocks))
const openDetail = ref<string | null>(null)

function detailId(blockId: string, index: number) {
  return `${blockId}-d${index}`
}

function dishCredit(media: PublicMedia) {
  return Boolean(media.author || licenseLabel(media.license))
}

function dishHasDetail(dish: PublicDish) {
  return Boolean(dish.description || (dish.media && dishCredit(dish.media)))
}

function finePointer() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

function onPriceClick(event: MouseEvent, id: string) {
  const action = priceCardTap({
    finePointer: finePointer(),
    keyboard: event.detail === 0,
    open: openDetail.value === id,
  })
  if (action === 'follow') {
    return
  }
  event.preventDefault()
  openDetail.value = id
}

function onPointerDown(event: Event) {
  const target = event.target
  if (!(target instanceof Element) || target.closest('.price-item.is-open')) {
    return
  }
  openDetail.value = null
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    openDetail.value = null
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.vm { margin-top: 2.6rem; }
.vm:first-child { margin-top: 0; }
.vm h2 { margin-bottom: 0.9rem; }
.vm-text .lead {
  font-size: 1.2rem;
  line-height: 1.65;
}
.vm-text .lead :deep(p) { margin: 0 0 0.95rem; }
.vm-text .lead :deep(p:last-child) { margin-bottom: 0; }
.note { color: var(--muted); font-size: 0.92rem; }
.note :deep(a) { font-weight: 400; }
.price-head {
  display: grid;
  gap: 0.3rem;
  margin-bottom: 0.85rem;
}
.price-title-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 0.75rem;
}
.price-head h2 { margin: 0; }
.price-lead {
  margin: 0;
  color: var(--muted);
  font-size: 1rem;
  line-height: 1.4;
}
.price-badge {
  margin: 0;
  padding: 0.32rem 0.75rem;
  border: 1px solid #dfc48a;
  border-radius: 999px;
  background: var(--color-amber-soft);
  color: var(--color-partner);
  font-size: 0.95rem;
  font-weight: 700;
  line-height: 1.3;
  white-space: nowrap;
}
.price-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.45rem;
  margin: 0 0 0.55rem;
  padding: 0;
  list-style: none;
}
.price-item {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.price-item:hover,
.price-item:focus-within,
.price-item.is-open { z-index: 2; }
.price-card,
.dish-card {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.7rem 0.8rem 0.75rem;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  background: var(--surface);
  color: inherit;
  text-decoration: none;
  transition: border-color var(--duration) var(--ease), background-color var(--duration) var(--ease);
}
.dish-card { cursor: default; }
.price-card:focus-visible,
.dish-card:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.price-card:hover {
  border-color: var(--color-sea);
  background: var(--color-sea-light);
}
.price-row {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) auto;
  gap: 0.1rem 0.7rem;
  align-items: center;
}
.price-art {
  display: grid;
  grid-row: 1 / span 2;
  place-items: center;
  width: 56px;
  height: 56px;
  overflow: hidden;
}
.price-art :deep(picture.sticker),
.price-art :deep(picture.sticker img),
.price-art > img {
  display: block;
  width: 56px;
  height: 56px;
  max-width: 56px;
  max-height: 56px;
  object-fit: contain;
}
.price-art.photo :deep(figure),
.price-art.photo :deep(picture) {
  width: 56px;
  height: 56px;
  margin: 0;
  overflow: hidden;
  border-radius: 8px;
}
.price-art.photo :deep(img) {
  width: 56px;
  height: 56px;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 8px;
}
.price-copy { grid-column: 2; grid-row: 1 / span 2; min-width: 0; }
.price-name { display: block; font-weight: 700; line-height: 1.2; }
.price-variant { display: block; color: var(--muted); font-size: 0.82rem; line-height: 1.25; }
.price-rub {
  grid-column: 3;
  grid-row: 1 / span 2;
  font-family: var(--font-display);
  font-size: 1.55rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}
.scale { display: block; margin-left: calc(56px + 0.7rem); }
.scale-quiet {
  display: flex;
  align-items: center;
  height: 0.55rem;
}
.scale-quiet i {
  display: block;
  width: 42%;
  height: 0.55rem;
  border-radius: 99px;
  background: var(--color-line);
}
.price-detail {
  position: absolute;
  z-index: 3;
  top: calc(100% + 0.4rem);
  left: 0;
  display: grid;
  gap: 0.45rem;
  width: min(16.5rem, 100%);
  padding: 0.55rem 0.7rem 0.6rem;
  border: 1px solid var(--color-line);
  border-radius: 10px;
  background: var(--surface);
  box-shadow: var(--shadow-pop);
  font-size: 0.84rem;
  line-height: 1.35;
  opacity: 0;
  pointer-events: none;
  transform: translateY(4px) scale(0.98);
  transform-origin: top left;
  transition: opacity 150ms var(--ease), transform 150ms var(--ease);
}
.price-card:hover + .price-detail,
.price-card:focus-within + .price-detail,
.dish-card:hover + .price-detail,
.dish-card:focus-within + .price-detail,
.price-item.is-open .price-detail {
  opacity: 1;
  pointer-events: auto;
  transform: none;
}
.price-verdict { font-weight: 700; }
.price-facts { display: grid; gap: 0.12rem; }
.price-kicker {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 700;
}
.price-detail .credit {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.55rem;
  color: var(--muted);
  font-size: 0.75rem;
}
.track-wrap { position: relative; }
.track {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 3px;
  height: 0.55rem;
}
.track i {
  display: block;
  height: 100%;
  border-radius: 99px;
  background: var(--color-line);
}
.track i:nth-child(1) { background: #c9d8cd; }
.track i:nth-child(2) { background: #f0d7ab; }
.track i:nth-child(3) { background: #e8c9bf; }
.track i.on:nth-child(1) { background: var(--color-pine); }
.track i.on:nth-child(2) { background: var(--color-amber); }
.track i.on:nth-child(3) { background: var(--color-brick); }
.mark {
  position: absolute;
  top: 50%;
  left: clamp(0.45rem, var(--pos), calc(100% - 0.45rem));
  width: 0.95rem;
  height: 0.95rem;
  border: 2px solid var(--surface);
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgb(43 36 32 / 28%);
  transform: translate(-50%, -50%);
}
.mark.cheap { background: var(--color-pine); }
.mark.medium { background: var(--color-amber); }
.mark.expensive { background: var(--color-brick); }
.price-foot {
  margin: 0.25rem 0 0;
  color: var(--muted);
  font-size: 0.75rem;
  line-height: 1.35;
}
.price-foot :deep(a) { font-weight: 400; }
@media (min-width: 720px) {
  .price-grid { grid-template-columns: 1fr 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .price-card,
  .dish-card,
  .price-detail { transition: none; transform: none; }
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 0.8rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.cards li {
  padding: 1rem 1.05rem 1.05rem;
  border: 1px solid var(--color-line);
  border-radius: 14px;
  background: var(--color-surface);
}
.cards :deep(p) { margin: 0; font-size: 1rem; line-height: 1.45; }
.cards .who { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.4rem; font-size: 1rem; font-weight: 700; line-height: 1.25; }
.aud-icon {
  display: inline-grid;
  flex: none;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--color-amber-soft);
  color: var(--color-brick);
}
.vm h2.with-sticker { display: flex; gap: 0.6rem; align-items: center; }
.vm h2.with-sticker :deep(.sticker) { flex: none; width: 56px; margin: -0.6rem 0; transform: rotate(-6deg); }
.practical { display: grid; gap: 0; margin: 0; }
.practical > div {
  display: grid;
  grid-template-columns: 11.5rem minmax(0, 1fr);
  gap: 0.35rem 1rem;
  align-items: start;
  padding: 0.8rem 0;
  border-top: 1px solid var(--color-line);
}
.practical dt {
  display: flex;
  gap: 0.45rem;
  align-items: center;
  color: var(--muted);
  font-weight: 600;
}
.practical dd { margin: 0; line-height: 1.45; }
.tips { margin: 0; padding-left: 1.2rem; }
.tips li + li { margin-top: 0.4rem; }
.faq details { padding: 0.85rem 0 0.95rem; border-top: 1px solid var(--color-line); }
.faq details:last-child { border-bottom: 1px solid var(--color-line); }
.faq summary {
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1.3;
  cursor: pointer;
}
.faq :deep(p) { margin: 0.45rem 0 0; max-width: 62ch; line-height: 1.55; }
@media (max-width: 560px) {
  .practical > div { grid-template-columns: 1fr; gap: 0.2rem; }
}
</style>
