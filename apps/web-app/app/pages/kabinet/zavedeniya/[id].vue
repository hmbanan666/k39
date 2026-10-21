<template>
  <main class="page frame cabinet">
    <p class="kicker">
      <a href="/kabinet">Кабинет</a>
    </p>
    <h1>Страница заведения</h1>
    <CabinetVenueEditor :venue-id="id" />
  </main>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['user-only'] })
const id = String(useRoute().params.id || '')
useSeoMeta({ title: 'Редактор заведения | K39', robots: 'noindex, nofollow' })
</script>

<style scoped>
.cabinet { padding-bottom: 3rem; }
.kicker {
  margin: 0;
  font-family: var(--font-stamp);
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.kicker a { color: var(--color-brick); text-decoration: none; }
h1 { margin: 0.3rem 0 1rem; font-size: clamp(2rem, 1.2rem + 2vw, 2.6rem); }
</style>
