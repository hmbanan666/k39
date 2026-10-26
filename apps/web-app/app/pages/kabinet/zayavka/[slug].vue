<template>
  <main class="page frame cabinet">
    <p class="kicker"> Заявка </p>
    <p
      v-if="pending"
      class="muted"
    >
      Загружаем страницу.
    </p>
    <p
      v-else-if="error"
      class="error"
    >
      {{ error.message || 'Страница не найдена' }}
    </p>
    <template v-else-if="preview">
      <h1>{{ preview.venue.name }}</h1>
      <p
        v-if="preview.venue.address"
        class="muted"
      >
        {{ preview.venue.address }}
      </p>
      <p v-if="preview.membership">
        Вы уже можете править эту страницу.
        <UiLink :href="`/kabinet/zavedeniya/${preview.venue.id}`"> Открыть редактор </UiLink>
      </p>
      <section
        v-else
        class="card"
      >
        <h2>Это моё заведение</h2>
        <p class="muted"> Страница откроется для правок после проверки. Сами себя назначить владельцем нельзя. </p>
        <form @submit.prevent="submit">
          <fieldset>
            <legend>Как проверить</legend>
            <label>
              <input
                v-model="channel"
                type="radio"
                value="email"
                :disabled="!preview.channels.email.present || !preview.channels.email.transport"
              />
              Код на почту заведения
              <span v-if="preview.channels.email.mask">{{ preview.channels.email.mask }}</span>
              <span
                v-else-if="!preview.channels.email.present"
                class="muted"
                >почты в карточке нет</span
              >
              <span
                v-else
                class="muted"
                >отправка кода пока не подключена</span
              >
            </label>
            <label>
              <input
                v-model="channel"
                type="radio"
                value="phone"
                :disabled="!preview.channels.phone.present || !preview.channels.phone.transport"
              />
              Код на телефон заведения
              <span v-if="preview.channels.phone.mask">{{ preview.channels.phone.mask }}</span>
              <span
                v-else-if="!preview.channels.phone.present"
                class="muted"
                >телефона в карточке нет</span
              >
              <span
                v-else
                class="muted"
                >отправка кода пока не подключена</span
              >
            </label>
            <label>
              <input
                v-model="channel"
                type="radio"
                value="manual"
              />
              Проверка редакцией
            </label>
          </fieldset>
          <UiField
            v-if="channel === 'manual'"
            label="Чем подтвердить"
            hint="Сайт, договор, визитка, страница в соцсети. От 20 знаков."
            :count="evidence.trim().length"
            :max="2000"
          >
            <UiTextarea
              v-model="evidence"
              :rows="5"
            />
          </UiField>
          <p
            v-if="formError"
            class="error"
          >
            {{ formError }}
          </p>
          <UiButton
            type="submit"
            :disabled="busy"
          >
            Отправить
          </UiButton>
        </form>
        <form
          v-if="claim && claim.channel !== 'manual'"
          class="code"
          @submit.prevent="verify"
        >
          <h3>Код из письма или сообщения</h3>
          <UiField label="Шесть цифр">
            <UiInput
              v-model="code"
              inputmode="numeric"
            />
          </UiField>
          <div class="row">
            <UiButton type="submit"> Подтвердить </UiButton>
            <UiButton
              type="button"
              variant="line"
              @click="resend"
            >
              Прислать код ещё раз
            </UiButton>
          </div>
        </form>
        <p
          v-else-if="claim?.channel === 'manual'"
          class="muted"
        >
          Заявка у редакции. Когда её подтвердят, страница появится в кабинете.
        </p>
      </section>
    </template>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ middleware: ['user-only'] })

const route = useRoute()
const slug = computed(() => String(route.params.slug || ''))
useSeoMeta({ title: 'Заявка на заведение | K39', robots: 'noindex, nofollow' })

interface Preview {
  venue: { id: string; name: string; slug: string; address: string | null }
  channels: {
    email: { present: boolean; transport: boolean; mask: string | null }
    phone: { present: boolean; transport: boolean; mask: string | null }
  }
  membership: string | null
  claim: { id: string; status: string; channel: string; mask: string | null; expiresAt: string | null } | null
}

const {
  data: preview,
  pending,
  error,
  refresh,
} = await useFetch<Preview>('/api/cabinet/claim', {
  query: { slug },
})
const channel = ref<'email' | 'phone' | 'manual'>('manual')
const evidence = ref('')
const code = ref('')
const formError = ref('')
const busy = ref(false)
const claim = computed(() => preview.value?.claim ?? null)

watch(
  preview,
  (value) => {
    if (!value) {
      return
    }
    if (value.channels.email.present && value.channels.email.transport) {
      channel.value = 'email'
    } else if (value.channels.phone.present && value.channels.phone.transport) {
      channel.value = 'phone'
    } else {
      channel.value = 'manual'
    }
  },
  { immediate: true },
)

function problem(reason: unknown, fallback: string) {
  const item = reason as { data?: { message?: string; statusMessage?: string }; statusMessage?: string }
  return item.data?.statusMessage || item.data?.message || item.statusMessage || fallback
}

async function submit() {
  formError.value = ''
  busy.value = true
  try {
    await $fetch('/api/cabinet/claims', {
      method: 'POST',
      body: { slug: slug.value, channel: channel.value, evidence: evidence.value },
    })
    await refresh()
  } catch (reason) {
    formError.value = problem(reason, 'Не удалось отправить заявку')
  } finally {
    busy.value = false
  }
}

async function verify() {
  if (!claim.value) {
    return
  }
  formError.value = ''
  try {
    const result = await $fetch<{ venueId: string }>(`/api/cabinet/claims/${claim.value.id}/verify`, {
      method: 'POST',
      body: { code: code.value },
    })
    await navigateTo(`/kabinet/zavedeniya/${result.venueId}`)
  } catch (reason) {
    formError.value = problem(reason, 'Код не подошёл')
  }
}

async function resend() {
  if (!claim.value) {
    return
  }
  formError.value = ''
  try {
    await $fetch(`/api/cabinet/claims/${claim.value.id}/code`, { method: 'POST' })
    formError.value = 'Новый код отправлен.'
  } catch (reason) {
    formError.value = problem(reason, 'Не удалось отправить код')
  }
}
</script>

<style scoped>
.cabinet {
  padding-bottom: 3rem;
}
.kicker {
  margin: 0;
  color: var(--color-brick);
  font-family: var(--font-stamp);
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
h1 {
  margin: 0.3rem 0 0.4rem;
  font-size: clamp(2rem, 1.2rem + 2vw, 2.6rem);
}
.card {
  margin-top: 1rem;
  padding: 1rem;
  border: 1px solid var(--color-line);
  border-radius: 14px;
  background: var(--color-surface);
}
.card h2 {
  margin: 0 0 0.4rem;
  font-size: 1.25rem;
}
fieldset {
  margin: 0.8rem 0;
  padding: 0;
  border: 0;
}
label {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.6rem;
  align-items: center;
  margin: 0.45rem 0;
}
.muted {
  color: var(--muted);
}
.error {
  color: var(--color-danger, var(--color-brick));
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}
.code {
  margin-top: 1.2rem;
  padding-top: 1rem;
  border-top: 1px dashed var(--color-line);
}
</style>
