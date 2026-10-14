<template>
  <NuxtLayout>
    <main class="page error-page">
      <section class="card">
        <Sticker
          class="mascot"
          :slug="lost ? 'shocked' : 'sad-with-broken-cable'"
          :width="200"
          priority
        />
        <div class="text">
          <p class="kicker">
            {{ lost ? 'Ошибка 404' : `Ошибка ${code}` }}
          </p>
          <h1>{{ lost ? 'Такой страницы нет' : 'Что-то сломалось' }}</h1>
          <p class="lede">
            {{ lost
              ? 'Похоже, адрес устарел или в нём опечатка. Лось уже ищет, а вы пока загляните сюда.'
              : 'Мы уже чиним. Обновите страницу через минуту или начните с главной.' }}
          </p>
          <div class="actions">
            <UiButton href="/">
              На главную
            </UiButton>
            <UiButton
              v-if="!lost"
              variant="line"
              @click="retry"
            >
              Обновить
            </UiButton>
            <UiButton
              v-else
              href="/map"
              variant="line"
            >
              Открыть карту
            </UiButton>
          </div>
        </div>
        <span
          class="postmark"
          aria-hidden="true"
        >{{ code }}</span>
      </section>
      <div
        v-if="links"
        class="lists"
      >
        <LinkList
          title="Разделы"
          :links="links.hubs"
        />
        <LinkList
          title="Популярные места"
          :links="links.places"
        />
        <LinkList
          title="Маршруты"
          :links="links.routes"
        />
        <LinkList
          title="Подборки"
          :links="links.collections"
        />
      </div>
    </main>
  </NuxtLayout>
</template>

<script setup lang="ts">
import type { TextLink } from '~~/shared/links'

const props = defineProps<{ error: { statusCode: number, statusMessage?: string, message?: string } }>()

const code = computed(() => props.error.statusCode || 500)
const lost = computed(() => code.value === 404)

// Failure here must not break the error page itself, so links are optional.
interface ErrorLinks {
  hubs: TextLink[]
  places: TextLink[]
  routes: TextLink[]
  collections: TextLink[]
}
const { data: links } = await useFetch<ErrorLinks>('/api/public/error-links')

useSeoMeta({
  title: lost.value ? 'Страница не найдена | K39' : 'Ошибка | K39',
  robots: 'noindex, follow',
})

function retry() {
  window.location.reload()
}
</script>

<style scoped>
.error-page {
  display: grid;
  gap: var(--space-6);
  padding-block: var(--space-6) var(--space-8);
}
.card {
  position: relative;
  display: grid;
  gap: var(--space-5);
  align-items: center;
  padding: var(--space-6) var(--space-5);
  border: 1px solid var(--color-line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-card);
}
.mascot {
  justify-self: center;
  width: 160px;
}
.kicker {
  margin: 0 0 var(--space-2);
  color: var(--accent);
  font-family: var(--font-stamp);
  font-size: var(--step--1);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
h1 {
  margin: 0 0 var(--space-3);
  font-family: var(--font-display);
  font-size: var(--step-3);
  line-height: 1.05;
}
.lede {
  max-width: 40ch;
  margin: 0 0 var(--space-5);
  color: var(--muted);
  font-size: var(--step-0);
  line-height: 1.5;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.postmark {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  display: grid;
  place-items: center;
  width: 4.2rem;
  height: 4.2rem;
  border: 2px dashed var(--accent);
  border-radius: 50%;
  color: var(--accent);
  font-family: var(--font-stamp);
  font-size: 1.1rem;
  opacity: 0.55;
  transform: rotate(-12deg);
}
.lists {
  display: grid;
  gap: var(--space-5);
}
@media (min-width: 760px) {
  .card {
    grid-template-columns: 220px 1fr;
    padding: var(--space-7) var(--space-7) var(--space-7) var(--space-6);
  }
  .mascot { width: 200px; }
  .lists { grid-template-columns: 1fr 1fr; }
}
</style>
