<template>
  <header class="site-header">
    <a
      href="/"
      class="brand"
    >K39</a>
    <nav>
      <a
        v-for="link in hubs"
        :key="link.href"
        :href="link.href"
      >{{ link.text }}</a>
      <a
        v-if="!loggedIn"
        href="/sign-in"
      >Войти</a>
      <a
        v-else
        href="/admin"
      >Админка</a>
      <a
        v-if="loggedIn"
        href="/api/auth/logout"
      >Выйти</a>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { HUBS } from '~~/shared/links'

const { loggedIn } = useUserSession()
const hubs = HUBS
</script>

<style scoped>
.site-header { display: flex; justify-content: space-between; gap: 1rem; align-items: center; padding: 0.9rem 1.25rem; border-bottom: 1px solid #e6d5b0; }
.brand { font-family: "K39 Display", Georgia, serif; font-size: 1.4rem; font-weight: 700; text-decoration: none; color: inherit; }
nav { display: flex; gap: 0.75rem; flex-wrap: wrap; }
a { color: inherit; }
</style>
