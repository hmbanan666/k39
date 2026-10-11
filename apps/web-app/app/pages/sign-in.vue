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
      <UiButton
        v-for="provider in providers"
        :key="provider.id"
        :href="`/api/auth/provider?provider=${provider.id}&redirectTo=${encodeURIComponent(redirectTo)}`"
      >
        {{ provider.label }}
      </UiButton>
    </div>
    <p class="fine">
      Кнопка входа означает согласие с
      <UiLink href="/legal/privacy-policy">
        политикой конфиденциальности
      </UiLink>.
    </p>
    <p>
      <UiLink :href="redirectTo">
        Вернуться
      </UiLink>
    </p>
  </main>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'empty',
  middleware: ['guest-only'],
})

const route = useRoute()
const redirectTo = computed(() => typeof route.query.redirectTo === 'string' ? route.query.redirectTo : '/')
const { data, pending } = await useFetch<{ providers: string[] }>('/api/auth/providers')

const labels: Record<string, string> = {
  yandex: 'Войти через Яндекс',
  vk: 'Войти через ВКонтакте',
}
const providers = computed(() => (data.value?.providers ?? []).map((id) => ({ id, label: labels[id] ?? id })))

useSeoMeta({ title: 'Вход | K39', robots: 'noindex, nofollow' })
</script>

<style scoped>
.actions { display: flex; flex-direction: column; gap: 0.6rem; align-items: flex-start; }
.fine { font-size: var(--step--1); }
</style>
