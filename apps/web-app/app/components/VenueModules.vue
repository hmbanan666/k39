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
      <ul class="dishes">
        <li
          v-for="dish in block.items"
          :key="dish.name"
        >
          <span class="dish-name">{{ dish.name }}</span>
          <span
            v-if="dish.priceRub"
            class="dish-price"
          >{{ rub(dish.priceRub) }}</span>
          <span
            v-if="dish.note"
            class="dish-note"
          >{{ dish.note }}</span>
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
      <ul class="dishes">
        <li
          v-for="row in block.items"
          :key="row.title + row.variant"
        >
          <span class="dish-name">{{ row.title }}<span
            v-if="row.variant"
            class="variant"
          >, {{ row.variant }}</span></span>
          <span class="dish-price">{{ rub(row.priceRub) }}</span>
          <span class="dish-note">
            <UiLink
              v-if="row.sourceUrl"
              :href="row.sourceUrl"
              data-track="outbound"
              data-track-name="price-source"
            >{{ row.sourceTitle }}</UiLink>
            <template v-else>{{ row.sourceTitle }}</template>,
            {{ shortDate(row.checkedAt) }}
          </span>
        </li>
      </ul>
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
import type { PublicVenueModule } from '~~/shared/venue-modules'
import { tablerIcon } from '~~/shared/icons'

defineProps<{ blocks: PublicVenueModule[], menuUrl?: string | null }>()

const shortDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const rub = (value: number) => `${new Intl.NumberFormat('ru-RU').format(value)} ₽`
</script>

<style scoped>
.vm { margin-top: 2.6rem; }
.vm:first-child { margin-top: 0; }
.vm h2 { margin-bottom: 0.9rem; }
.lead { font-size: 1.08rem; }
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
