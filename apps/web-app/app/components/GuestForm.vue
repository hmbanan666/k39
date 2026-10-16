<template>
  <section
    class="guest-form"
    aria-labelledby="guest-form-title"
  >
    <h2 id="guest-form-title">
      Сообщение гостя
    </h2>
    <p class="lead">
      Отзыв, совет, фото или поправка. Редакция смотрит каждое сообщение до публикации. Поправка не меняет часы и цены на странице.
    </p>
    <div
      class="kinds"
      role="group"
      aria-label="Вид сообщения"
    >
      <button
        v-for="option in kinds"
        :key="option.value"
        type="button"
        class="kind"
        :class="{ on: kind === option.value }"
        :aria-pressed="kind === option.value"
        @click="kind = option.value"
      >
        {{ option.label }}
      </button>
    </div>

    <form @submit.prevent="send">
      <UiField
        v-if="kind === 'review' || kind === 'tip'"
        :label="kind === 'review' ? 'Отзыв' : 'Совет'"
        :count="text.length"
        :max="kind === 'review' ? 1200 : 400"
        :hint="kind === 'review' ? 'От 80 до 1200 знаков. Одна ссылка https.' : 'От 40 до 400 знаков. Одна ссылка https.'"
      >
        <UiTextarea
          v-model="text"
          :rows="kind === 'review' ? 6 : 4"
        />
      </UiField>

      <template v-if="kind === 'photo'">
        <UiField
          label="Подпись к фото"
          :count="alt.length"
          :max="140"
          hint="От 10 до 140 знаков. Что на снимке, без чужих контактов."
        >
          <UiInput v-model="alt" />
        </UiField>
        <UiField label="Файл JPEG, PNG или WebP">
          <input
            class="file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            @change="onFile"
          >
        </UiField>
        <label class="rights">
          <input
            v-model="rights"
            type="checkbox"
          >
          <span>Я снял это фото сам, это не копия, в кадре нет узнаваемого человека, и я разрешаю K39 показать его на сайте, пока не уберу.</span>
        </label>
      </template>

      <template v-if="kind === 'correction'">
        <UiField label="Что поправить">
          <UiSelect
            v-model="correctionKind"
            :options="correctionOptions"
          />
        </UiField>
        <UiField
          label="Как на самом деле"
          :count="correctionValue.length"
          :max="120"
        >
          <UiInput v-model="correctionValue" />
        </UiField>
        <UiField
          label="Пояснение"
          :count="note.length"
          :max="400"
          hint="Необязательно."
        >
          <UiTextarea
            v-model="note"
            :rows="3"
          />
        </UiField>
        <UiField
          label="Ссылка для редакции"
          hint="Необязательно. На странице её не будет."
        >
          <UiInput
            v-model="sourceUrl"
            type="url"
            placeholder="https://"
          />
        </UiField>
      </template>

      <p
        v-if="error"
        class="error"
        role="alert"
      >
        {{ error }}
      </p>
      <p
        v-if="done"
        class="done"
        role="status"
      >
        Сообщение ждёт решения редакции. Статус будет в кабинете.
      </p>

      <div class="actions">
        <UiButton
          v-if="signedIn"
          type="submit"
          :disabled="sending"
        >
          Отправить
        </UiButton>
        <UiButton
          v-else
          :href="signInHref"
        >
          Войти и отправить
        </UiButton>
      </div>
      <p class="consent">
        Кнопка «Отправить» записывает
        <a :href="consentPath">согласие на публикацию материалов гостя</a>.
        Отдельной галочки нет. Полное имя и почта на странице не появятся.
      </p>
    </form>
  </section>
</template>

<script setup lang="ts">
import { GUEST_CONSENT_PATH } from '~~/shared/consent'

const props = defineProps<{
  subjectType: 'place' | 'venue'
  subjectSlug: string
  subjectPath: string
}>()

const kinds = [
  { value: 'review', label: 'Отзыв' },
  { value: 'tip', label: 'Совет' },
  { value: 'photo', label: 'Фото' },
  { value: 'correction', label: 'Поправка' },
] as const

const correctionOptions = [
  { value: 'hours', label: 'Часы' },
  { value: 'phone', label: 'Телефон' },
  { value: 'address', label: 'Адрес' },
  { value: 'status', label: 'Статус работы' },
  { value: 'price', label: 'Цена' },
  { value: 'other', label: 'Другое' },
]

type Kind = (typeof kinds)[number]['value']

const { loggedIn } = useUserSession()
const signedIn = computed(() => loggedIn.value)
const kind = ref<Kind>('review')
const text = ref('')
const alt = ref('')
const rights = ref(false)
const file = ref<File | null>(null)
const correctionKind = ref('hours')
const correctionValue = ref('')
const note = ref('')
const sourceUrl = ref('')
const error = ref('')
const done = ref(false)
const sending = ref(false)
const consentPath = GUEST_CONSENT_PATH
const signInHref = computed(() => `/sign-in?redirectTo=${encodeURIComponent(`${props.subjectPath}#gostyam`)}`)

function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  file.value = input.files?.[0] ?? null
}

function problem(reason: unknown) {
  const item = reason as { data?: { statusMessage?: string, message?: string }, statusMessage?: string }
  return item.data?.statusMessage || item.data?.message || item.statusMessage || 'Не удалось отправить.'
}

async function send() {
  error.value = ''
  done.value = false
  sending.value = true
  try {
    if (kind.value === 'photo') {
      if (!rights.value) {
        error.value = 'Подтвердите, что фото ваше и в кадре нет узнаваемого человека.'
        return
      }
      const body = new FormData()
      body.set('consent', '1')
      body.set('rights', '1')
      body.set('subjectType', props.subjectType)
      body.set('subjectSlug', props.subjectSlug)
      body.set('alt', alt.value)
      if (file.value) {
        body.set('file', file.value)
      }
      await $fetch('/api/guests/photo', { method: 'POST', body })
    } else if (kind.value === 'correction') {
      await $fetch('/api/guests', {
        method: 'POST',
        body: {
          consent: '1',
          subjectType: props.subjectType,
          subjectSlug: props.subjectSlug,
          kind: 'correction',
          correctionKind: correctionKind.value,
          correctionValue: correctionValue.value,
          note: note.value,
          sourceUrl: sourceUrl.value,
        },
      })
    } else {
      await $fetch('/api/guests', {
        method: 'POST',
        body: {
          consent: '1',
          subjectType: props.subjectType,
          subjectSlug: props.subjectSlug,
          kind: kind.value,
          body: text.value,
        },
      })
    }
    done.value = true
    text.value = ''
    alt.value = ''
    rights.value = false
    correctionValue.value = ''
    note.value = ''
    sourceUrl.value = ''
    file.value = null
  } catch (reason) {
    error.value = problem(reason)
  } finally {
    sending.value = false
  }
}
</script>

<style scoped>
.guest-form {
  margin-top: 2.2rem;
  padding-top: 1.4rem;
  border-top: 1px solid var(--color-line);
}
.guest-form h2 {
  margin: 0 0 0.45rem;
  font-size: var(--step-2);
}
.lead, .consent {
  max-width: 62ch;
  margin: 0 0 1rem;
  color: var(--muted);
  line-height: 1.5;
}
.kinds {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 1rem;
}
.kind {
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--color-line);
  border-radius: var(--radius-sm, 3px);
  background: var(--surface);
  color: var(--text);
  font: inherit;
  cursor: pointer;
}
.kind.on {
  border-color: var(--color-brick);
  background: var(--color-brick);
  color: var(--surface);
}
.file { font: inherit; }
.rights {
  display: flex;
  gap: 0.55rem;
  align-items: flex-start;
  max-width: 62ch;
  margin: 0.2rem 0 1rem;
  line-height: 1.45;
}
.error { color: var(--color-brick-dark); }
.done { color: var(--color-pine); }
.actions { margin: 0.4rem 0 0.7rem; }
.consent a { font-weight: 700; }
</style>
