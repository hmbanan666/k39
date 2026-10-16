<template>
  <main class="page frame cabinet">
    <p class="kicker">
      Кабинет
    </p>
    <h1>Ваш K39</h1>
    <p
      v-if="pending"
      class="muted"
    >
      Загружаем профиль.
    </p>
    <template v-else-if="me">
      <section class="card">
        <h2>Профиль</h2>
        <form @submit.prevent="saveName">
          <UiField label="Имя">
            <UiInput
              v-model="name"
              required
            />
          </UiField>
          <p class="muted">
            {{ me.user.email }}
          </p>
          <p
            v-if="profileError"
            class="error"
          >
            {{ profileError }}
          </p>
          <div class="row">
            <UiButton type="submit">
              Сохранить имя
            </UiButton>
            <UiButton
              href="/api/auth/logout"
              variant="line"
            >
              Выйти
            </UiButton>
          </div>
        </form>
        <p class="consent">
          <template v-if="me.consent.current && me.consent.consentedAt">
            Согласие на обработку персональных данных, версия {{ me.consent.version }}, дано {{ consentDate }}.
          </template>
          <template v-else>
            Актуальная версия согласия: {{ me.consent.version }}. При следующем входе его нужно подтвердить снова.
          </template>
          <UiLink href="/soglasie">
            Текст согласия
          </UiLink>
          и
          <UiLink href="/privacy">
            политика
          </UiLink>.
        </p>
      </section>

      <section class="card">
        <h2>Мои заведения</h2>
        <p
          v-if="!me.venues.length"
          class="muted"
        >
          Пока ни одного. Найдите страницу ниже или откройте её на сайте и нажмите «Это моё заведение».
        </p>
        <ul
          v-else
          class="list"
        >
          <li
            v-for="venue in me.venues"
            :key="venue.id"
          >
            <a :href="`/kabinet/zavedeniya/${venue.id}`">{{ venue.name }}</a>
            <span class="muted">{{ venue.role === 'owner' ? 'владелец' : 'редактор' }}</span>
          </li>
        </ul>
      </section>

      <section class="card">
        <h2>Мои сообщения</h2>
        <p
          v-if="!guestRows.length"
          class="muted"
        >
          Пока пусто. Отзыв, совет, фото или поправка отправляются со страницы места или заведения.
        </p>
        <ul
          v-else
          class="list"
        >
          <li
            v-for="item in guestRows"
            :key="item.id"
          >
            <span>
              <a
                v-if="item.subjectPath"
                :href="item.subjectPath"
              >{{ item.subjectTitle }}</a>
              <template v-else>{{ item.subjectTitle }}</template>
              · {{ guestKind(item.kind) }} · {{ guestStatus(item.status) }}
            </span>
            <button
              type="button"
              @click="removeGuest(item.id)"
            >
              Убрать
            </button>
            <p
              v-if="item.status === 'rejected' && item.decisionNote"
              class="muted"
            >
              {{ item.decisionNote }}
            </p>
          </li>
        </ul>
        <p
          v-if="guestError"
          class="error"
        >
          {{ guestError }}
        </p>
      </section>

      <section class="card">
        <h2>Найти страницу</h2>
        <form
          class="search"
          @submit.prevent="search"
        >
          <UiField label="Название">
            <UiInput
              v-model="query"
              placeholder="Кофейня у форта"
            />
          </UiField>
          <UiButton type="submit">
            Найти
          </UiButton>
        </form>
        <p
          v-if="searchError"
          class="error"
        >
          {{ searchError }}
        </p>
        <ul
          v-if="found.length"
          class="list"
        >
          <li
            v-for="venue in found"
            :key="venue.id"
          >
            <a :href="venueClaimPath(venue.slug)">{{ venue.name }}</a>
            <span class="muted">{{ venue.kindLabel }}<template v-if="venue.address">, {{ venue.address }}</template></span>
          </li>
        </ul>
      </section>
    </template>
  </main>
</template>

<script setup lang="ts">
import { venueClaimPath } from '~~/shared/cabinet'

definePageMeta({ middleware: ['user-only'] })
useSeoMeta({ title: 'Кабинет | K39', robots: 'noindex, nofollow' })

interface Me {
  user: { id: string, name: string, email: string }
  consent: { version: string, consentedAt: string | null, current: boolean }
  venues: Array<{ id: string, name: string, slug: string, role: string, status: string }>
}

const { data: me, pending } = await useFetch<Me>('/api/cabinet/me')
interface GuestRow {
  id: string
  kind: string
  status: string
  decisionNote: string | null
  subjectTitle: string
  subjectPath: string
}
const { data: guestData, refresh: refreshGuests } = await useFetch<{ submissions: GuestRow[] }>('/api/cabinet/guests')
const guestRows = computed(() => guestData.value?.submissions ?? [])
const guestError = ref('')
const name = ref(me.value?.user.name ?? '')
watch(me, (value) => {
  if (value) {
    name.value = value.user.name
  }
})
const profileError = ref('')
const query = ref('')
const searchError = ref('')
const found = ref<Array<{ id: string, slug: string, name: string, address: string | null, kindLabel: string }>>([])

const consentDate = computed(() => {
  const raw = me.value?.consent.consentedAt
  if (!raw) {
    return ''
  }
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(raw))
})

function problem(reason: unknown, fallback: string) {
  const error = reason as { data?: { message?: string, statusMessage?: string }, statusMessage?: string }
  return error.data?.statusMessage || error.data?.message || error.statusMessage || fallback
}

async function saveName() {
  profileError.value = ''
  try {
    await $fetch('/api/cabinet/profile', { method: 'PATCH', body: { name: name.value } })
  } catch (reason) {
    profileError.value = problem(reason, 'Не удалось сохранить имя')
  }
}

function guestKind(kind: string) {
  if (kind === 'review') {
    return 'отзыв'
  }
  if (kind === 'tip') {
    return 'совет'
  }
  if (kind === 'photo') {
    return 'фото'
  }
  return 'поправка'
}

function guestStatus(status: string) {
  if (status === 'accepted') {
    return 'опубликовано'
  }
  if (status === 'rejected') {
    return 'отклонено'
  }
  return 'ждёт решения'
}

async function removeGuest(id: string) {
  guestError.value = ''
  try {
    await $fetch(`/api/cabinet/guests/${id}/remove`, { method: 'POST' })
    await refreshGuests()
  } catch (reason) {
    guestError.value = problem(reason, 'Не удалось убрать сообщение')
  }
}

async function search() {
  searchError.value = ''
  found.value = []
  try {
    const result = await $fetch<{ venues: typeof found.value }>(`/api/cabinet/venues/search?q=${encodeURIComponent(query.value)}`)
    found.value = result.venues
    if (!result.venues.length) {
      searchError.value = 'Ничего не нашли среди опубликованных страниц.'
    }
  } catch (reason) {
    searchError.value = problem(reason, 'Поиск не удался')
  }
}
</script>

<style scoped>
.cabinet { padding-bottom: 3rem; }
.kicker {
  margin: 0;
  color: var(--color-brick);
  font-family: var(--font-stamp);
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
h1 { margin: 0.3rem 0 1rem; font-size: clamp(2rem, 1.2rem + 2vw, 2.8rem); }
.card {
  margin: 0 0 1rem;
  padding: 1rem 1rem 1.1rem;
  border: 1px solid var(--color-line);
  border-radius: 14px;
  background: var(--color-surface);
}
.card h2 { margin: 0 0 0.8rem; font-size: 1.25rem; }
.muted { color: var(--muted); }
.error { color: var(--color-danger, var(--color-brick)); }
.row, .search { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: end; }
.search { margin-bottom: 0.6rem; }
.list { margin: 0.6rem 0 0; padding: 0; list-style: none; }
.list li {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.8rem;
  justify-content: space-between;
  padding: 0.65rem 0;
  border-top: 1px dashed var(--color-line);
}
.consent { margin: 1rem 0 0; color: var(--muted); font-size: 0.92rem; line-height: 1.45; }
</style>
