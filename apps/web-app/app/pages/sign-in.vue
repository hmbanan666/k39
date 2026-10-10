<template>
  <main class="sign-in">
    <h1>Вход</h1>
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
      <a
        v-for="provider in providers"
        :key="provider.id"
        :href="`/api/auth/provider?provider=${provider.id}&redirectTo=${encodeURIComponent(redirectTo)}`"
      >{{ provider.label }}</a>
    </div>
    <p class="fine">
      Кнопка входа означает согласие с
      <NuxtLink to="/legal/privacy-policy">
        политикой конфиденциальности
      </NuxtLink>.
    </p>
    <p>
      <NuxtLink :to="redirectTo">
        Вернуться
      </NuxtLink>
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
.sign-in { max-width: 24rem; margin: 4rem auto; padding: 1rem; }
.actions { display: flex; flex-direction: column; gap: 0.6rem; }
.actions a { display: block; text-align: center; padding: 0.8rem; border-radius: 10px; background: #3a2e24; color: #fbf3e2; text-decoration: none; font-weight: 700; }
.fine { font-size: 0.9rem; }
</style>
