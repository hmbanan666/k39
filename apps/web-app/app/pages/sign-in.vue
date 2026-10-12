<template>
  <div class="signin">
    <div
      class="map"
      aria-hidden="true"
    />

    <a
      class="logo"
      href="/"
    >
      <picture class="logo-mark">
        <source
          type="image/webp"
          srcset="/logo/moose-head.webp 1x, /logo/moose-head@2x.webp 2x"
        >
        <source
          type="image/png"
          srcset="/logo/moose-head.png 1x, /logo/moose-head@2x.png 2x"
        >
        <img
          src="/logo/moose-head.png"
          alt=""
          width="108"
          height="96"
        >
      </picture>
      <span class="logo-word">
        K39
        <small>Калининградская область</small>
      </span>
    </a>

    <main class="sheet">
      <div class="sheet-main">
        <h1>Мы вас заждались!</h1>

        <p
          v-if="pending"
          class="status"
        >
          Проверяем, какие входы подключены.
        </p>
        <p
          v-else-if="!providers.length"
          class="status"
        >
          Вход через Яндекс и ВКонтакте пока не подключен.
        </p>
        <template v-else>
          <p
            v-if="consentError"
            class="warn"
          >
            Вход не начался: не подтверждено согласие на обработку персональных данных.
          </p>
          <div class="actions">
            <UiButton
              v-for="provider in providers"
              :key="provider.id"
              class="login"
              :href="startHref(provider.id)"
            >
              {{ provider.label }}
            </UiButton>
          </div>
          <p class="consent">
            Нажимая кнопку входа, вы даёте
            <UiLink href="/soglasie">
              Согласие на обработку персональных данных
            </UiLink>
            и принимаете
            <UiLink href="/privacy">
              Политику конфиденциальности
            </UiLink>.
          </p>
        </template>
      </div>

      <p class="back">
        <UiLink :href="redirectTo">
          Вернуться
        </UiLink>
      </p>
    </main>

    <figure class="quote">
      <img
        src="/img/famous/immanuel-kant.jpg"
        alt="Иммануил Кант"
        width="96"
        height="96"
      >
      <blockquote>
        <p>
          «Такой город, как Кенигсберг на Прегеле, можно признать подходящим местом для расширения знания и человека, и света.<span class="quote-more"> Здесь и без путешествия можно приобрести такое знание.</span>»
        </p>
      </blockquote>
      <figcaption>Иммануил Кант</figcaption>
    </figure>
  </div>
</template>

<script setup lang="ts">
import { CONSENT_VERSION } from '~~/shared/consent'

definePageMeta({
  layout: 'empty',
  middleware: ['guest-only'],
})

const route = useRoute()
const redirectTo = computed(() => typeof route.query.redirectTo === 'string' && route.query.redirectTo.startsWith('/') && !route.query.redirectTo.startsWith('//')
  ? route.query.redirectTo
  : '/')
const consentError = computed(() => route.query.error === 'consent')
const { data, pending } = await useFetch<{ providers: string[] }>('/api/auth/providers')

const labels: Record<string, string> = {
  yandex: 'Войти через Яндекс',
  vk: 'Войти через ВКонтакте',
}
const providers = computed(() => (data.value?.providers ?? []).map((id) => ({ id, label: labels[id] ?? id })))

function startHref(id: string) {
  const params = new URLSearchParams({
    provider: id,
    consent: '1',
    version: CONSENT_VERSION,
    redirectTo: redirectTo.value,
  })
  return `/api/auth/provider?${params.toString()}`
}

useSeoMeta({ title: 'Вход | K39', robots: 'noindex, nofollow' })
</script>

<style scoped>
.signin {
  display: grid;
  grid-template-areas:
    "map"
    "sheet"
    "quote";
  grid-template-columns: minmax(0, 1fr);
  width: 100%;
  max-width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--color-paper);
  color: var(--color-ink);
}

.map {
  grid-area: map;
  min-height: 11.5rem;
  background-color: var(--color-sea);
  background-image: url('/img/bg-pattern-1.jpg');
  background-repeat: no-repeat;
  background-position: center 42%;
  background-size: cover;
}

.logo {
  z-index: 1;
  display: flex;
  grid-area: map;
  align-self: start;
  justify-self: end;
  align-items: center;
  gap: 0.6rem;
  max-width: calc(100% - 2rem);
  margin: var(--space-4) var(--space-4) 0 0;
  padding: 0.45rem 0.8rem 0.45rem 0.45rem;
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  color: inherit;
  text-decoration: none;
}

.logo-mark {
  display: block;
  flex: none;
  height: 40px;
}

.logo-mark img {
  display: block;
  width: auto;
  height: 40px;
  max-width: none;
}

.logo-word {
  color: var(--color-ink);
  font: 700 1.35rem/1 var(--font-display);
}

.logo-word small {
  display: block;
  margin-top: 3px;
  color: var(--color-muted);
  font: 500 11px/1.2 var(--font-body);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.sheet {
  display: flex;
  grid-area: sheet;
  min-width: 0;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--space-5);
  padding: var(--space-6) var(--space-4) var(--space-5);
}

.sheet-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  width: min(100%, 24rem);
  margin: 0 auto;
}

h1 {
  margin: 0 0 var(--space-5);
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: var(--step-2);
  text-align: center;
}

h1::after {
  content: "";
  display: block;
  width: 3rem;
  height: 3px;
  margin: var(--space-3) auto 0;
  border-radius: 999px;
  background: var(--color-amber);
}

.status,
.warn,
.consent,
.back {
  margin: 0;
  text-align: center;
}

.status {
  color: var(--color-ink);
}

.warn {
  margin-bottom: var(--space-4);
  color: var(--color-brick-dark);
  font-size: var(--step--1);
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.login {
  width: 100%;
  min-height: 44px;
}

.consent {
  margin-top: var(--space-4);
  color: var(--color-muted);
  font-size: var(--step--1);
  line-height: 1.45;
}

.back {
  font-size: var(--step-0);
}

.quote {
  display: grid;
  grid-area: quote;
  min-width: 0;
  grid-template-areas:
    "portrait text"
    "portrait byline";
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.35rem var(--space-4);
  align-items: start;
  margin: 0 var(--space-4) var(--space-5);
  padding: var(--space-4);
  border: 1px solid var(--color-line);
  border-left: 4px solid var(--color-pine);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.quote img {
  grid-area: portrait;
  width: 4.5rem;
  height: 4.5rem;
  max-width: none;
  object-fit: cover;
  border-radius: 50%;
  box-shadow: 0 0 0 3px var(--color-amber-soft);
}

.quote blockquote {
  grid-area: text;
  margin: 0;
}

.quote p {
  margin: 0;
  color: var(--color-ink);
  font-family: var(--font-display);
  font-size: 1.02rem;
  font-style: italic;
  line-height: 1.35;
}

.quote figcaption {
  grid-area: byline;
  margin: 0;
  color: var(--color-muted);
  font-family: var(--font-body);
  font-size: var(--step--1);
  font-style: normal;
  font-weight: 700;
}

@media (max-width: 899px) {
  .quote-more {
    display: none;
  }

  .logo-word small {
    display: none;
  }
}

@media (min-width: 900px) {
  .signin {
    grid-template-areas: "map sheet";
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    height: 100vh;
    height: 100dvh;
    min-height: 100vh;
    min-height: 100dvh;
    overflow: hidden;
  }

  .map {
    min-height: 0;
  }

  .logo {
    margin: var(--space-5) var(--space-5) 0 0;
  }

  .logo-mark,
  .logo-mark img {
    height: 48px;
  }

  .logo-word {
    font-size: 1.5rem;
  }

  .sheet {
    min-height: 0;
    padding: var(--space-6) var(--space-6) var(--space-5);
    overflow: auto;
  }

  .quote {
    grid-area: map;
    align-self: end;
    width: min(34rem, calc(100% - 2.5rem));
    margin: 0 0 var(--space-5) var(--space-5);
  }
}
</style>
