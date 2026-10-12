<template>
  <main class="page">
    <PostcardHero
      h1="Вход"
      kicker="K39"
    />
    <p v-if="pending">
      Проверяем, какие входы подключены.
    </p>
    <p v-else-if="!providers.length">
      Вход через Яндекс и ВКонтакте пока не подключен.
    </p>
    <div
      v-else
      class="actions"
    >
      <label class="check">
        <input
          v-model="agreed"
          type="checkbox"
        >
        <span>
          Я даю согласие на
          <UiLink
            href="/soglasie"
            @click.stop
          >
            обработку персональных данных
          </UiLink>
        </span>
      </label>
      <p class="fine">
        Входя, вы принимаете
        <UiLink href="/terms">
          Пользовательское соглашение
        </UiLink>
        и знакомы с
        <UiLink href="/privacy">
          Политикой
        </UiLink>.
      </p>
      <p
        v-if="consentError"
        class="warn"
      >
        Чтобы войти, отметьте согласие на обработку персональных данных.
      </p>
      <UiButton
        v-for="provider in providers"
        :key="provider.id"
        :disabled="!agreed"
        :href="agreed ? startHref(provider.id) : undefined"
      >
        {{ provider.label }}
      </UiButton>
    </div>
    <p>
      <UiLink :href="redirectTo">
        Вернуться
      </UiLink>
    </p>
  </main>
</template>

<script setup lang="ts">
import { CONSENT_VERSION } from '~~/shared/consent'

definePageMeta({
  layout: 'empty',
  middleware: ['guest-only'],
})

const route = useRoute()
const agreed = ref(false)
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
.actions { display: flex; flex-direction: column; gap: 0.75rem; align-items: flex-start; }
.check { display: flex; gap: 0.55rem; align-items: flex-start; max-width: 36rem; }
.check input { margin-top: 0.28rem; }
.fine { font-size: var(--step--1); max-width: 36rem; }
.warn { color: var(--color-brick-dark); max-width: 36rem; }
</style>
