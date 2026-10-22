<template>
  <section
    v-if="items.length"
    class="upcoming"
  >
    <h2>{{ title }}</h2>
    <ul>
      <li
        v-for="item in items"
        :key="item.id"
      >
        <time
          :datetime="item.datetime"
          :title="item.when"
          class="date"
        >
          <span class="day">{{ item.day }}</span>
          <span class="month">{{ item.month }}</span>
        </time>
        <div class="what">
          <p class="name">
            {{ item.title }}
          </p>
          <p class="meta">
            <span v-if="item.detail">{{ item.detail }}</span>
            <UiLink
              v-if="item.subject"
              :href="item.subject.href"
            >
              {{ item.subject.title }}
            </UiLink>
          </p>
        </div>
        <UiLink
          v-if="item.ticketUrl"
          class="tickets"
          :href="item.ticketUrl"
          data-track="outbound"
          data-track-name="ticket"
        >
          Билеты
        </UiLink>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import type { EventLine } from '~~/shared/events'

defineProps<{ items: EventLine[], title: string }>()
</script>

<style scoped>
.upcoming { margin-top: 3rem; }
.upcoming h2 { margin: 0 0 0.8rem; }
ul { margin: 0; padding: 0; list-style: none; }
li {
  display: grid;
  grid-template-columns: 3.4rem 1fr;
  gap: 0.4rem 0.9rem;
  align-items: start;
  padding: 0.75rem 0;
  border-top: 1px solid var(--color-line);
}
li:last-child { border-bottom: 1px solid var(--color-line); }
.date {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.3rem 0 0.35rem;
  border: 1.5px solid var(--color-brick);
  border-radius: 8px;
  color: var(--color-brick);
  line-height: 1;
}
.day { font: 700 1.35rem/1 var(--font-body); font-variant-numeric: tabular-nums; }
.month { margin-top: 0.2rem; font-family: var(--font-stamp); font-size: 0.72rem; }
.what p { margin: 0; }
.name { font-weight: 600; line-height: 1.35; }
.what .meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.15rem 0.7rem;
  margin-top: 0.2rem;
  color: var(--muted);
  font-size: 0.92rem;
}
.tickets { grid-column: 2; justify-self: start; font-size: 0.92rem; }
@media (min-width: 700px) {
  li { grid-template-columns: 3.4rem 1fr auto; align-items: center; }
  .tickets { grid-column: 3; }
}
</style>
