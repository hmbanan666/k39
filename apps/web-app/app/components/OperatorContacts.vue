<template>
  <p class="who">
    {{ title }}<br />
    {{ operatorIdLine() }}<br />
    {{ operator.address }}<br />
    Электронная почта: <a :href="operatorMailHref()">{{ operator.email }}</a>
  </p>
</template>

<script setup lang="ts">
import { operator, operatorIdLine, operatorMailHref } from '~~/shared/operator'

const title = `${operator.form.charAt(0).toLocaleUpperCase('ru')}${operator.form.slice(1)} ${operator.name}`
</script>

<style scoped>
.who {
  line-height: 1.6;
}
</style>
