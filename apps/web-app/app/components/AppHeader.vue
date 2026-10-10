<template>
  <header class="site-header">
    <NuxtLink
      to="/"
      class="brand"
    >
      K39
    </NuxtLink>
    <nav>
      <NuxtLink to="/map/kaliningrad">
        Карта фортов
      </NuxtLink>
      <NuxtLink to="/quest/five-forts">
        Квест
      </NuxtLink>
      <NuxtLink to="/legal/privacy-policy">
        Политика
      </NuxtLink>
      <NuxtLink
        v-if="!loggedIn"
        to="/sign-in"
      >
        Войти
      </NuxtLink>
      <a
        v-else
        href="/api/auth/logout"
      >Выйти</a>
    </nav>
  </header>
</template>

<script setup lang="ts">
const { loggedIn } = useUserSession()
</script>

<style scoped>
.site-header { display: flex; justify-content: space-between; gap: 1rem; align-items: center; padding: 0.9rem 1.25rem; border-bottom: 1px solid #e6d5b0; }
.brand { font-family: "K39 Display", Georgia, serif; font-size: 1.4rem; font-weight: 700; text-decoration: none; color: inherit; }
nav { display: flex; gap: 0.9rem; flex-wrap: wrap; }
a { color: inherit; }
</style>
