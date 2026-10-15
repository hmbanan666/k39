<template>
  <section
    v-for="block in blocks"
    :id="block.id"
    :key="block.id"
    class="mod"
  >
    <h2>{{ block.title }}</h2>
    <div
      v-if="block.type === 'choose'"
      class="prose"
      v-html="block.html"
    />
    <ul
      v-else-if="block.type === 'situation'"
      class="card-grid cols-3 picks"
    >
      <li
        v-for="(item, index) in block.items"
        :key="item.card.href"
      >
        <VenueCard
          :href="item.card.href"
          :name="item.card.name"
          :kind-label="item.card.kindLabel"
          :media="item.card.media"
          :meta="item.card.meta"
          :stale="item.card.stale"
          :schedule="item.card.schedule"
          :lean="index % 2 === 0 ? 'left' : 'right'"
          sizes="(min-width: 1100px) 380px, (min-width: 720px) 46vw, 92vw"
        >
          <template #kicker>
            <span class="why">
              <Icon
                v-if="item.icon"
                :name="tablerIcon(SITUATION_ICON_KEYS[item.icon])"
                size="16"
              />
              {{ item.label }}
            </span>
          </template>
          <span
            v-if="item.note"
            class="note"
          >{{ item.note }}</span>
        </VenueCard>
      </li>
    </ul>
    <ul
      v-else-if="block.type === 'areas'"
      class="areas"
    >
      <li
        v-for="item in block.items"
        :key="item.name"
      >
        <h3>{{ item.name }}</h3>
        <div
          class="prose"
          v-html="item.html"
        />
      </li>
    </ul>
    <template v-else-if="block.type === 'season'">
      <div
        v-if="block.html"
        class="prose"
        v-html="block.html"
      />
      <ul
        v-if="block.items.length"
        class="seasons"
      >
        <li
          v-for="item in block.items"
          :key="item.when"
        >
          <h3>{{ item.when }}</h3>
          <div
            class="prose"
            v-html="item.html"
          />
        </li>
      </ul>
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
        <div
          class="prose"
          v-html="item.html"
        />
      </details>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { PublicListingModule } from '~~/shared/listing-modules'
import { tablerIcon } from '~~/shared/icons'
import { SITUATION_ICON_KEYS } from '~~/shared/listing-modules'

defineProps<{ blocks: PublicListingModule[] }>()
</script>

<style scoped>
.mod { margin: 0 0 1.8rem; }
.mod h2 { margin: 0 0 0.8rem; }
.picks { margin: 0; padding: 0; list-style: none; }
.picks li { display: flex; min-width: 0; }
.why {
  display: inline-flex;
  gap: 0.3rem;
  align-items: center;
  color: var(--accent);
  font-family: var(--font-stamp);
  font-size: var(--step--1);
  font-weight: 700;
}
.note { color: var(--muted); font-size: var(--step--1); }
.areas, .seasons { margin: 0; padding: 0; list-style: none; }
.areas li, .seasons li { margin-top: 1rem; }
.areas h3, .seasons h3 { margin: 0 0 0.3rem; }
.faq details { padding: 0.6rem 0; border-top: 1px solid var(--color-line); }
.faq summary { font-weight: 600; cursor: pointer; }
.prose :deep(p:last-child) { margin-bottom: 0; }
</style>
