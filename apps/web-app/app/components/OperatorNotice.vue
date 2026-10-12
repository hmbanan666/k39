<template>
  <p>
    {{ identity }}
    Почта: <a :href="operatorMailHref()">{{ operator.email }}</a>.
  </p>
</template>

<script setup lang="ts">
import { operator, operatorMailHref } from '~~/shared/operator'

const props = withDefaults(defineProps<{
  lead?: string
}>(), {
  lead: 'Оператор персональных данных:',
})

const identity = computed(() => {
  const ogrnip = operator.ogrnip ? `, ОГРНИП ${operator.ogrnip}` : ''
  return `${props.lead} ${operator.form} ${operator.name}, ИНН ${operator.inn}${ogrnip}, адрес: ${operator.address}.`
})
</script>
