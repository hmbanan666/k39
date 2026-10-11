<template>
  <article class="page page-wide">
    <header class="hero">
      <div>
        <p class="kicker">
          Путеводитель K39
        </p>
        <h1>{{ page.doc.h1 }}</h1>
        <p class="lede">
          Форты, замки, пляжи и курорты. У каждого места свой адрес, статус и источник.
        </p>
      </div>
      <div
        class="stamps"
        aria-hidden="true"
      >
        <div class="stamp">
          <PostcardSketch
            label=""
            :width="280"
            :height="175"
          />
        </div>
        <span class="postmark">K39</span>
      </div>
    </header>
    <h2>Куда поехать</h2>
    <div class="hub-grid">
      <a
        v-for="hub in page.hubs"
        :key="hub.href"
        :href="hub.href"
        class="hub-card"
      >
        <PostcardSketch
          :label="hub.title"
          :width="320"
          :height="180"
        />
        <h3>{{ hub.title }}</h3>
        <p>{{ hub.summary }}</p>
      </a>
    </div>
    <section
      v-if="page.route"
      class="sea-band"
    >
      <p class="band-kicker">
        Маршрут
      </p>
      <h2>{{ page.route.title }}</h2>
      <p v-if="page.route.summary">
        {{ page.route.summary }}
      </p>
      <ol>
        <li
          v-for="(step, index) in page.route.steps"
          :key="step.href"
        >
          <span>{{ index + 1 }}</span>
          <a :href="step.href">{{ step.text }}</a>
        </li>
      </ol>
      <UiButton
        :href="page.route.href"
        variant="quiet"
      >
        Открыть маршрут
      </UiButton>
    </section>
    <section
      v-if="page.quest"
      class="quest"
    >
      <div>
        <p class="kicker">
          Квест
        </p>
        <h2>{{ page.quest.title }}</h2>
        <p v-if="page.quest.summary">
          {{ page.quest.summary }}
        </p>
      </div>
      <UiButton :href="page.quest.href">
        Открыть квест
      </UiButton>
    </section>
  </article>
</template>

<script setup lang="ts">
import type { SeoDocument } from '~~/shared/seo'

const page = await fetchPublic<{
  doc: SeoDocument
  hubs: Array<{ href: string, title: string, summary: string }>
  route: { href: string, title: string, summary: string, steps: Array<{ href: string, text: string }> } | null
  quest: { href: string, title: string, summary: string } | null
}>('/api/public/home')
usePublicHead(page.doc)
onMounted(() => useTrack().track('page_view'))
</script>

<style scoped>
.hero {
  display: grid;
  gap: var(--space-5);
  align-items: center;
  margin-bottom: var(--space-6);
}
.kicker {
  margin: 0 0 var(--space-2);
  color: var(--color-brick);
  font-family: var(--font-stamp);
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.lede { max-width: 36rem; color: var(--muted); }
.stamps { position: relative; }
.stamp {
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: var(--shadow-card);
}
.postmark {
  position: absolute;
  right: 8%;
  bottom: -0.6rem;
  display: grid;
  width: 4.2rem;
  height: 4.2rem;
  place-items: center;
  border: 2px dashed var(--color-brick);
  border-radius: 50%;
  color: var(--color-brick);
  font-family: var(--font-stamp);
  transform: rotate(-12deg);
  background: var(--color-paper);
}
.hub-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
}
.hub-card {
  overflow: hidden;
  border: 1px solid var(--color-line);
  border-radius: 16px;
  background: var(--surface);
  color: inherit;
  text-decoration: none;
  box-shadow: var(--shadow-card);
}
.hub-card h3,
.hub-card p { margin: 0.7rem 0.9rem; }
.hub-card p { color: var(--muted); font-size: var(--step--1); }
.sea-band {
  margin-top: var(--space-7);
  padding: var(--space-5);
  border-radius: 20px;
  background: var(--color-sea);
  color: var(--color-surface);
}
.sea-band h2,
.sea-band p { color: inherit; }
.band-kicker {
  font-family: var(--font-stamp);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 0.75rem;
}
.sea-band ol { margin: 0 0 var(--space-4); padding: 0; list-style: none; }
.sea-band li { display: flex; gap: 0.6rem; padding: 0.35rem 0; }
.sea-band a { color: var(--color-surface); }
.quest {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  align-items: center;
  justify-content: space-between;
  margin-top: var(--space-5);
  padding: var(--space-5);
  border-radius: 18px;
  background: var(--color-amber-soft);
}
@media (min-width: 720px) {
  .hero { grid-template-columns: 1.1fr 0.9fr; }
  .hub-grid { grid-template-columns: 1fr 1fr 1fr; }
}
</style>
