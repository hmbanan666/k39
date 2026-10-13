<template>
  <section class="month-stats">
    <h2>{{ module.title }}</h2>
    <p
      v-if="module.verdict"
      class="verdict"
    >
      {{ module.verdict }}
    </p>
    <dl class="tiles">
      <div
        v-for="tile in module.tiles"
        :key="tile.label"
        class="tile"
      >
        <dt>{{ tile.label }}</dt>
        <dd>
          <strong>{{ tile.value }}</strong>
          <small v-if="tile.note">{{ tile.note }}</small>
        </dd>
      </div>
    </dl>
    <details
      v-if="module.rows.length"
      class="rows"
    >
      <summary>Все показатели</summary>
      <table>
        <tbody>
          <tr
            v-for="row in module.rows"
            :key="row.label"
          >
            <th scope="row">
              {{ row.label }}
            </th>
            <td>{{ row.value }}</td>
          </tr>
        </tbody>
      </table>
    </details>
  </section>
</template>

<script setup lang="ts">
import type { PublicPageModule } from '~~/shared/page-modules'

defineProps<{
  module: Extract<PublicPageModule, { type: 'month-stats' }>
}>()
</script>

<style scoped>
h2 {
  margin: 0 0 0.5rem;
  font-family: var(--font-display);
  font-size: clamp(1.7rem, 1.3rem + 0.8vw, 2rem);
  letter-spacing: -0.02em;
}
.verdict {
  margin: 0 0 1rem;
  color: var(--muted);
}
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
  gap: 0.6rem;
  margin: 0;
}
.tile {
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--color-line);
  border-radius: 8px;
  background: var(--color-surface);
}
dt {
  color: var(--muted);
  font-size: 0.85rem;
}
dd {
  display: grid;
  gap: 0.1rem;
  margin: 0.2rem 0 0;
}
dd strong {
  font: 700 1.35rem/1.15 var(--font-display);
}
dd small {
  color: var(--muted);
  font-size: 0.8rem;
}
.rows { margin-top: 0.9rem; }
.rows summary {
  color: var(--color-sea);
  font-weight: 600;
  cursor: pointer;
}
table {
  width: 100%;
  max-width: 36rem;
  margin-top: 0.6rem;
  border-collapse: collapse;
}
th, td {
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--color-line);
  text-align: left;
}
th { font-weight: 400; }
td {
  font-weight: 600;
  text-align: right;
  white-space: nowrap;
}
</style>
