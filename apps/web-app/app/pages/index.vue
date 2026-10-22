<template>
  <article class="page page-wide home">
    <header class="home-hero">
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
        class="collage"
        aria-hidden="true"
      >
        <Postcard
          class="shot a"
          :src="page.photo?.src || illustrationFor('forty')"
          :alt="page.photo?.alt || ''"
          caption="Форты"
          meta="K39"
          tilt="-5deg"
          ratio="4 / 3"
          priority
        >
          <template
            v-if="page.photo"
            #art
          >
            <MediaImage
              :media="page.photo"
              priority
              :show-credit="false"
              :sizes="heroSizes"
            />
          </template>
        </Postcard>
        <Postcard
          class="shot b"
          :src="illustrationFor('kurorty')"
          alt=""
          caption="Курорты"
          meta="K39"
          tilt="4deg"
          ratio="4 / 3"
        />
        <Postcard
          class="shot c"
          :src="illustrationFor('plyazhi')"
          alt=""
          caption="Пляжи"
          meta="K39"
          tilt="-2deg"
          ratio="4 / 3"
        />
        <Stamp
          class="float-stamp"
          :src="illustrationFor('forty')"
          label="K39"
        />
        <img
          class="pm"
          :src="POSTMARK_SRC"
          alt=""
          width="260"
          height="140"
        >
      </div>
    </header>
    <div class="sh">
      <h2>Куда поехать</h2>
    </div>
    <div class="hub-grid">
      <Postcard
        v-for="(hub, index) in page.hubs"
        :key="hub.href"
        :href="hub.href"
        :src="illustrationFor(hub.href.slice(1))"
        :alt="hub.title"
        caption-tag="h3"
        caption-style="title"
        meta-place="below"
        :caption="hub.title"
        :meta="hub.summary"
        :stamp-label="romans[index] || String(index + 1)"
        stamp-size="sm"
        stamp-place="in"
        ratio="16 / 9"
      />
    </div>
    <RouteSteps
      v-if="page.route"
      variant="feature"
      kicker="Маршрут"
      :title="page.route.title"
      :summary="page.route.summary"
      :href="page.route.href"
      :steps="page.route.steps"
      :art="illustrationFor('forty')"
      action="Открыть маршрут"
    />
    <section
      v-if="page.quest"
      class="quest"
    >
      <div
        class="seal"
        aria-hidden="true"
      >
        <b>K39<small>квест</small></b>
      </div>
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
import type { PublicMedia } from '~~/shared/media'
import type { SeoDocument } from '~~/shared/seo'
import { illustrationFor, POSTMARK_SRC } from '~~/shared/illustrations'
import { lcpPreload } from '~~/shared/media'

const romans = ['I', 'II', 'III', 'IV', 'V', 'VI']
const page = await fetchPublic<{
  doc: SeoDocument
  hubs: Array<{ href: string, title: string, summary: string }>
  route: { href: string, title: string, summary: string, steps: Array<{ href: string, text: string }> } | null
  quest: { href: string, title: string, summary: string } | null
  photo: PublicMedia | null
}>('/api/public/home')
const heroSizes = '(min-width: 980px) 440px, 100vw'
const heroPreload = page.photo ? lcpPreload(page.photo, heroSizes) : null
if (heroPreload) {
  useHead({ link: [heroPreload] })
}
usePublicHead(page.doc)
onMounted(() => useTrack().track('page_view'))
</script>

<style scoped>
.home-hero {
  display: grid;
  gap: 1.5rem;
  align-items: center;
  margin-bottom: 1rem;
  padding-top: 0.5rem;
}
.kicker {
  margin: 0 0 0.6rem;
  color: var(--color-brick);
  font-family: var(--font-stamp);
  font-size: 0.75rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.home-hero h1 {
  margin: 0.4rem 0 0.8rem;
  font-size: clamp(2.4rem, 1.2rem + 3.1vw, 4.15rem);
  line-height: 1.02;
  letter-spacing: -0.02em;
}
.lede {
  max-width: 36ch;
  margin: 0;
  color: var(--color-ink-soft);
  font-size: 1.15rem;
  line-height: 1.5;
}
.collage {
  position: relative;
  height: 32rem;
}
.shot { position: absolute; }
.a { top: 3.6rem; left: 0; z-index: 2; width: 68%; }
.b { top: 0; right: 0; z-index: 1; width: 54%; }
.c { right: 0.2rem; bottom: 0; z-index: 3; width: 48%; }
.float-stamp {
  position: absolute;
  top: 0.2rem;
  left: 58%;
  z-index: 4;
  width: 6.4rem;
  transform: rotate(8deg);
}
.pm {
  position: absolute;
  bottom: 0.4rem;
  left: 0;
  z-index: 5;
  width: 11rem;
  height: auto;
  pointer-events: none;
  mix-blend-mode: multiply;
  transform: rotate(-10deg);
  opacity: 0.85;
}
.sh { margin: 3.2rem 0 1.2rem; }
.sh h2 { margin: 0; font-size: clamp(1.8rem, 1.3rem + 1vw, 2.4rem); }
.hub-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.2rem;
}
.quest {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.2rem;
  align-items: center;
  margin-top: 3.2rem;
  padding: 1.4rem;
  border: 1.5px dashed var(--color-amber-line);
  border-radius: 18px;
  background-color: var(--color-amber-soft);
  background-image: var(--noise);
}
.quest h2 { margin: 0.3rem 0 0.45rem; font-size: clamp(1.6rem, 1.2rem + 1vw, 2.15rem); }
.quest p { max-width: 52ch; margin: 0; color: var(--color-quest-ink); }
.quest .kicker { margin-bottom: 0.2rem; }
.seal {
  display: grid;
  width: 7.5rem;
  height: 7.5rem;
  place-items: center;
  border-radius: 50%;
  background: var(--color-brick);
  box-shadow: inset 0 0 0 6px var(--color-brick), inset 0 0 0 8px var(--color-seal-line);
  isolation: isolate;
  position: relative;
}
.seal::before {
  content: "";
  position: absolute;
  z-index: -1;
  inset: -8px;
  border-radius: 50%;
  background: repeating-conic-gradient(var(--color-brick) 0 6deg, transparent 6deg 12deg);
  -webkit-mask: radial-gradient(circle, transparent 68px, #000 69px);
  mask: radial-gradient(circle, transparent 68px, #000 69px);
}
.seal b {
  color: #fff;
  font: 800 1.6rem/1 var(--font-display);
  text-align: center;
}
.seal small {
  display: block;
  margin-top: 0.35rem;
  color: var(--color-amber-soft);
  font: 600 0.68rem/1.2 var(--font-body);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
@media (min-width: 720px) {
  .hub-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 980px) {
  .collage {
    display: grid;
    height: auto;
    gap: 0.85rem;
    padding-top: 0.4rem;
  }
  .shot,
  .float-stamp,
  .pm {
    position: relative;
    top: auto;
    right: auto;
    bottom: auto;
    left: auto;
    width: auto;
  }
  .float-stamp { justify-self: end; width: 5.2rem; margin-top: -1.4rem; }
  .pm { width: 8.5rem; margin-top: -2.2rem; }
}
@media (min-width: 981px) {
  .home-hero { grid-template-columns: 1fr 1.05fr; gap: 2rem; padding: 1.2rem 0 0.4rem; }
  .hub-grid { grid-template-columns: 1fr 1fr 1fr; }
  .quest { grid-template-columns: 9rem 1fr auto; gap: 2rem; padding: 2rem 2.4rem; }
}
</style>
