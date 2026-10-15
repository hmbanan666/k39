<template>
  <!-- Venue content modules (docs/venue-modules.md). Server-rendered in full. -->
  <section
    v-for="block in blocks"
    :id="block.id"
    :key="block.id"
    class="vm"
    :class="`vm-${block.type}`"
  >
    <h2 :class="{ 'with-sticker': block.type === 'audience' }">
      {{ block.title }}
      <Sticker
        v-if="block.type === 'audience'"
        slug="with-heart"
        :width="72"
        decorative
      />
    </h2>
    <div
      v-if="block.type === 'text'"
      class="reader-html"
      :class="{ lead: block.variant === 'lead' }"
      v-html="block.html"
    />
    <template v-else-if="block.type === 'dishes'">
      <ul class="showcase">
        <li
          v-for="dish in block.items"
          :key="dish.id"
        >
          <div
            class="pic"
            :class="{ empty: !dish.media }"
          >
            <MediaImage
              v-if="dish.media"
              :media="dish.media"
              sizes="(min-width: 800px) 280px, 100vw"
              :show-credit="false"
            />
            <Icon
              v-else
              :name="tablerIcon('food')"
              size="40"
            />
          </div>
          <div class="body">
            <p class="line">
              <span class="dish-name">{{ dish.name }}</span>
              <span
                v-if="dish.priceRub"
                class="dish-price"
              >{{ formatRub(dish.priceRub) }}</span>
            </p>
            <p
              v-if="dish.description"
              class="blurb"
            >
              {{ dish.description }}
            </p>
            <p
              v-if="dish.media && dishCredit(dish.media)"
              class="credit"
            >
              <span v-if="dish.media.author">{{ dish.media.author }}</span>
              <a
                v-if="licenseHref(dish.media.license)"
                :href="licenseHref(dish.media.license)"
                v-bind="externalLinkAttrs(licenseHref(dish.media.license))"
              >{{ licenseLabel(dish.media.license) }}</a>
              <span v-else-if="licenseLabel(dish.media.license)">{{ licenseLabel(dish.media.license) }}</span>
            </p>
          </div>
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
        <div v-html="item.html" />
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
    <div
      v-else-if="block.type === 'best-time'"
      class="reader-html"
      v-html="block.html"
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
      <p
        v-if="block.summary"
        class="price-chip"
      >
        {{ block.summary }}
      </p>
      <ul class="price-grid">
        <li
          v-for="row in block.items"
          :key="row.slug + row.variant"
        >
          <component
            :is="row.href ? 'a' : 'div'"
            class="price-card"
            v-bind="row.href ? { href: row.href } : {}"
          >
            <span
              class="price-icon"
              aria-hidden="true"
            >
              <Icon
                :name="tablerIcon(row.icon)"
                size="22"
              />
            </span>
            <span class="price-name">{{ row.title }}</span>
            <span class="price-variant">{{ row.variant }}</span>
            <span class="price-rub">{{ formatRub(row.priceRub) }}</span>
            <span
              v-if="row.comparison.band"
              class="scale"
              role="img"
              :aria-label="priceScaleLabel(row.comparison.band)"
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
                  :style="{ left: `${row.comparison.position ?? 0}%` }"
                />
              </span>
              <span class="scale-labels">
                <span :class="{ on: row.comparison.band === 'cheap' }">дёшево</span>
                <span :class="{ on: row.comparison.band === 'medium' }">средне</span>
                <span :class="{ on: row.comparison.band === 'expensive' }">дорого</span>
              </span>
            </span>
            <span class="price-line">{{ row.comparison.line }}</span>
          </component>
          <p
            v-if="!block.source"
            class="price-src"
          >
            <UiLink
              v-if="row.sourceUrl"
              :href="row.sourceUrl"
              data-track="outbound"
              data-track-name="price-source"
            >
              {{ row.sourceTitle }}
            </UiLink>
            <template v-else>
              {{ row.sourceTitle }}
            </template>,
            {{ formatPriceDate(row.checkedAt) }}
          </p>
        </li>
      </ul>
      <p
        v-if="block.source"
        class="note"
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
        {{ block.source.when }}
      </p>
      <p class="note">
        Цены для сравнения заведений, не меню целиком. Могли измениться.
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
        <div v-html="item.html" />
      </details>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { PublicMedia } from '~~/shared/media'
import type { PublicVenueModule } from '~~/shared/venue-modules'
import { tablerIcon } from '~~/shared/icons'
import { externalLinkAttrs } from '~~/shared/links'
import { licenseHref, licenseLabel } from '~~/shared/media'
import { formatPriceDate, formatRub, priceScaleLabel } from '~~/shared/price-compare'

defineProps<{ blocks: PublicVenueModule[], menuUrl?: string | null }>()

function dishCredit(media: PublicMedia) {
  return Boolean(media.author || licenseLabel(media.license))
}
</script>

<style scoped>
.vm { margin-top: 2.6rem; }
.vm:first-child { margin-top: 0; }
.vm h2 { margin-bottom: 0.9rem; }
.lead { font-size: 1.08rem; }
.showcase {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr));
  gap: 0.8rem;
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
}
.showcase > li {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  background: var(--color-paper, #fffdf8);
  overflow: hidden;
}
.pic {
  display: grid;
  place-items: center;
  aspect-ratio: 4 / 3;
  background: var(--color-amber-soft);
  color: var(--accent);
}
.pic :deep(figure),
.pic :deep(picture) { display: block; width: 100%; height: 100%; margin: 0; }
.pic :deep(img) { width: 100%; height: 100%; aspect-ratio: auto; object-fit: cover; border-radius: 0; }
.showcase .body { padding: 0.85rem 1rem 1rem; }
.showcase .line { display: flex; gap: 0.75rem; align-items: baseline; justify-content: space-between; margin: 0; }
.showcase .dish-name { font-family: var(--font-display); font-size: 1.15rem; font-weight: 700; line-height: 1.2; }
.showcase .dish-price { color: var(--text); font-weight: 700; white-space: nowrap; }
.showcase .blurb { margin: 0.35rem 0 0; color: var(--muted); font-size: 0.92rem; line-height: 1.4; }
.showcase .credit { display: flex; flex-wrap: wrap; gap: 0.35rem 0.7rem; margin: 0.45rem 0 0; color: var(--muted); font-size: 0.78rem; }
.dishes { margin: 0 0 1rem; padding: 0; list-style: none; }
.dishes li {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.1rem 1rem;
  padding: 0.7rem 0;
  border-top: 1px solid var(--color-line);
}
.dish-name { font-weight: 700; }
.dish-price { color: var(--muted); white-space: nowrap; }
.dish-note { grid-column: 1 / -1; color: var(--muted); font-size: 0.92rem; }
.variant { font-weight: 400; color: var(--muted); }
.note { color: var(--muted); font-size: 0.92rem; }
.note :deep(a) { font-weight: 400; }
.price-chip {
  display: inline-block;
  margin: 0 0 0.9rem;
  padding: 0.28rem 0.75rem;
  border-radius: 99px;
  background: var(--color-amber-soft);
  color: var(--color-partner);
  font-size: 0.92rem;
  font-weight: 700;
}
.price-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: 0.8rem;
  margin: 0 0 0.9rem;
  padding: 0;
  list-style: none;
}
.price-grid > li {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  background: var(--surface);
}
.price-card {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.9rem 1rem 0.85rem;
  color: inherit;
  text-decoration: none;
}
.price-card:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.price-card:hover .price-name { color: var(--color-sea); }
.price-icon {
  display: inline-grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  margin-bottom: 0.45rem;
  border: 1.5px dashed var(--color-line);
  border-radius: 50%;
  background: var(--color-amber-soft);
  color: var(--accent);
}
.price-name { font-weight: 700; line-height: 1.25; }
.price-variant { min-height: 1.25em; color: var(--muted); font-size: 0.92rem; }
.price-rub {
  margin: 0.35rem 0 0.55rem;
  font-family: var(--font-display);
  font-size: 1.7rem;
  font-weight: 700;
  line-height: 1;
}
.scale { display: grid; gap: 0.28rem; margin-top: 0.15rem; }
.track-wrap { position: relative; }
.track {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  height: 0.45rem;
  overflow: hidden;
  border-radius: 99px;
  background: var(--color-line);
}
.track i { display: block; height: 100%; }
.track i.on:nth-child(1) { background: var(--color-pine); }
.track i.on:nth-child(2) { background: var(--color-amber); }
.track i.on:nth-child(3) { background: var(--color-brick); }
.mark {
  position: absolute;
  top: 50%;
  width: 0.72rem;
  height: 0.72rem;
  border: 2px solid var(--surface);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.mark.cheap { background: var(--color-pine); }
.mark.medium { background: var(--color-amber); }
.mark.expensive { background: var(--color-brick); }
.scale-labels {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  color: var(--muted);
  font-size: 0.75rem;
}
.scale-labels span:nth-child(2) { text-align: center; }
.scale-labels span:nth-child(3) { text-align: right; }
.scale-labels .on { color: var(--text); font-weight: 700; }
.price-line { margin-top: 0.45rem; font-size: 0.92rem; line-height: 1.35; }
.price-src {
  margin: 0;
  padding: 0 1rem 0.8rem;
  color: var(--muted);
  font-size: 0.8rem;
}
.price-src :deep(a) { font-weight: 400; }
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  gap: 0.8rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.cards li {
  padding: 0.9rem 1rem;
  border: 1px solid var(--color-line);
  border-radius: 12px;
  background: var(--color-paper, #fffdf8);
}
.cards :deep(p) { margin: 0; font-size: 0.92rem; line-height: 1.45; }
.cards .who { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.4rem; font-size: 1rem; font-weight: 700; line-height: 1.25; }
.aud-icon {
  display: inline-grid;
  flex: none;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border: 1.5px dashed var(--color-line);
  border-radius: 50%;
  background: var(--color-amber-soft);
  color: var(--accent);
}
.vm h2.with-sticker { display: flex; gap: 0.6rem; align-items: center; }
.vm h2.with-sticker :deep(.sticker) { flex: none; width: 56px; margin: -0.6rem 0; transform: rotate(-6deg); }
.practical { display: grid; gap: 0; margin: 0; }
.practical > div {
  display: grid;
  grid-template-columns: minmax(9rem, 0.6fr) 1fr;
  gap: 1rem;
  padding: 0.65rem 0;
  border-top: 1px solid var(--color-line);
}
.practical dt { display: flex; gap: 0.5rem; align-items: center; font-weight: 600; }
.practical dd { margin: 0; }
.tips { margin: 0; padding-left: 1.2rem; }
.tips li + li { margin-top: 0.4rem; }
.faq details { padding: 0.6rem 0; border-top: 1px solid var(--color-line); }
.faq summary { font-weight: 600; cursor: pointer; }
.faq :deep(p) { margin: 0.4rem 0 0; }
@media (max-width: 560px) {
  .practical > div { grid-template-columns: 1fr; gap: 0.2rem; }
}
</style>
