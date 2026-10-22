<template>
  <form
    class="editor"
    @submit.prevent="save"
  >
    <UiField label="Название">
      <UiInput
        v-model="form.name"
        required
      />
    </UiField>
    <UiField
      label="Описание"
      hint="Для опубликованной страницы нужно 300–600 знаков."
      :count="form.description.trim().length"
      :max="600"
    >
      <UiTextarea
        v-model="form.description"
        :rows="8"
      />
    </UiField>
    <UiField
      label="Кухня"
      hint="Через запятую"
    >
      <UiInput v-model="form.cuisine" />
    </UiField>
    <UiField label="Адрес">
      <UiInput v-model="form.address" />
    </UiField>
    <div class="grid">
      <UiField label="Телефон">
        <UiInput v-model="form.phone" />
      </UiField>
      <UiField label="Сайт">
        <UiInput v-model="form.website" />
      </UiField>
    </div>
    <fieldset>
      <legend>Часы</legend>
      <p
        v-if="hours.editable"
        class="muted"
      >
        Изменённые часы отмечают расписание проверенным. День без часов считается выходным. Если часы дня пока неизвестны, выберите «часы уточняйте».
      </p>
      <VenueHoursTable
        v-model:days="form.days"
        :editable="hours.editable"
        :table="hours.table"
        :lines="hours.lines"
        owner
      />
      <p
        v-if="hours.editable && form.days.some((day) => day.openEnded)"
        class="muted"
      >
        Пустое закрытие: на сайте «закрытие уточняйте». Впишите время, когда оно известно.
      </p>
      <UiField
        v-if="hours.editable"
        label="Заметка к часам"
      >
        <UiInput
          v-model="form.hoursNote"
          :maxlength="HOURS_NOTE_MAX"
        />
      </UiField>
    </fieldset>
    <fieldset>
      <legend>Ссылки</legend>
      <UiField label="Бронь стола">
        <UiInput v-model="form.bookingUrl" />
      </UiField>
      <UiField label="Заказ навынос">
        <UiInput v-model="form.orderUrl" />
      </UiField>
      <UiField label="Доставка">
        <UiInput v-model="form.deliveryUrl" />
      </UiField>
      <UiField label="Меню">
        <UiInput v-model="form.menuUrl" />
      </UiField>
    </fieldset>
    <fieldset>
      <legend>Соцсети</legend>
      <div
        v-for="(social, index) in form.socials"
        :key="index"
        class="grid"
      >
        <UiField label="Сеть">
          <UiInput
            v-model="social.network"
            placeholder="vk"
          />
        </UiField>
        <UiField label="Ссылка">
          <UiInput
            v-model="social.url"
            placeholder="https://"
          />
        </UiField>
      </div>
      <UiButton
        v-if="form.socials.length < 8"
        type="button"
        variant="line"
        @click="form.socials.push({ network: '', url: '' })"
      >
        Ещё соцсеть
      </UiButton>
      <p
        v-if="metaContacts.length"
        class="socials"
      >
        <MetaLink
          v-for="(item, index) in metaContacts"
          :key="`${item.label}-${item.href}-${index}`"
          :href="item.href"
        >
          {{ item.label }}
        </MetaLink>
      </p>
    </fieldset>
    <fieldset>
      <legend>Цены</legend>
      <div class="grid">
        <UiField label="Уровень, 1–4">
          <UiInput v-model="form.priceLevel" />
        </UiField>
        <UiField label="Средний чек, ₽">
          <UiInput v-model="form.avgCheck" />
        </UiField>
      </div>
      <p class="muted">
        Ориентиры цен берутся из общего каталога. Источник всегда «от заведения».
      </p>
      <div
        v-for="(row, index) in form.prices"
        :key="index"
        class="grid"
      >
        <UiField label="Позиция">
          <select v-model="row.item">
            <option
              v-for="item in catalog"
              :key="item.slug"
              :value="item.slug"
            >
              {{ item.title }}
            </option>
          </select>
        </UiField>
        <UiField label="Вариант">
          <UiInput
            v-model="row.variant"
            :placeholder="variantHint(row.item)"
          />
        </UiField>
        <UiField label="₽">
          <UiInput v-model="row.priceRub" />
        </UiField>
        <UiButton
          type="button"
          variant="line"
          @click="form.prices.splice(index, 1)"
        >
          Убрать
        </UiButton>
      </div>
      <UiButton
        v-if="form.prices.length < 12 && catalog.length"
        type="button"
        variant="line"
        @click="form.prices.push({ item: catalog[0]?.slug || '', variant: '', priceRub: '' })"
      >
        Ещё ориентир
      </UiButton>
    </fieldset>
    <fieldset>
      <legend>Блоки страницы</legend>
      <p class="muted">
        Те же блоки, что у редакции: «О месте», «Кому подойдёт», «Полезно знать» и остальные.
      </p>
      <article
        v-for="(module, index) in form.modules"
        :key="index"
        class="module"
      >
        <header class="row">
          <strong>{{ moduleTitle(module.type) }}</strong>
          <UiButton
            type="button"
            variant="line"
            @click="moveModule(index, -1)"
          >
            Выше
          </UiButton>
          <UiButton
            type="button"
            variant="line"
            @click="moveModule(index, 1)"
          >
            Ниже
          </UiButton>
          <UiButton
            type="button"
            variant="line"
            @click="form.modules.splice(index, 1)"
          >
            Убрать
          </UiButton>
        </header>
        <UiField
          v-if="module.type !== 'how-to-get'"
          label="Заголовок"
        >
          <UiInput v-model="module.title" />
        </UiField>
        <UiField
          v-if="module.type === 'text'"
          label="Вид"
        >
          <select v-model="module.variant">
            <option value="plain">
              обычный
            </option>
            <option value="lead">
              лид
            </option>
          </select>
        </UiField>
        <UiField
          v-if="module.type === 'text' || module.type === 'best-time' || module.type === 'how-to-get'"
          label="Текст"
        >
          <UiTextarea
            v-model="module.text"
            :rows="4"
          />
        </UiField>
        <template v-if="module.type === 'dishes'">
          <p class="field-count">
            {{ dishCount(module) }} из {{ dishMax }}
          </p>
          <article
            v-for="(item, itemIndex) in module.dishes"
            :key="item.id"
            class="dish-edit"
          >
            <header class="row">
              <strong>Позиция {{ itemIndex + 1 }}</strong>
              <UiButton
                type="button"
                variant="line"
                @click="moveDish(module, itemIndex, -1)"
              >
                Выше
              </UiButton>
              <UiButton
                type="button"
                variant="line"
                @click="moveDish(module, itemIndex, 1)"
              >
                Ниже
              </UiButton>
              <UiButton
                type="button"
                variant="line"
                @click="module.dishes.splice(itemIndex, 1)"
              >
                Удалить
              </UiButton>
            </header>
            <div class="grid">
              <UiField label="Блюдо">
                <UiInput v-model="item.name" />
              </UiField>
              <UiField label="Цена, ₽">
                <UiInput v-model="item.priceRub" />
              </UiField>
              <UiField label="Коротко">
                <UiInput v-model="item.description" />
              </UiField>
            </div>
            <p
              v-if="stalePrice(item)"
              class="muted"
            >
              На сайте эта цена скрыта: ей больше года. Измените число или подтвердите, что она верна.
            </p>
            <p
              v-if="item.refreshPrice"
              class="muted"
            >
              Цена будет подтверждена при сохранении.
            </p>
            <UiButton
              v-if="stalePrice(item)"
              type="button"
              variant="line"
              @click="item.refreshPrice = true"
            >
              Подтвердить цену
            </UiButton>
            <div class="dish-photo">
              <img
                v-if="dishPhoto(item)"
                :src="dishPhoto(item)?.src"
                :alt="item.name || 'Фото блюда'"
                width="96"
                height="72"
              >
              <span
                v-else-if="item.mediaId"
                class="muted"
              >Фото не найдено</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                @change="onDishFile(item, $event)"
              >
              <label class="rights">
                <input
                  v-model="item.rights"
                  type="checkbox"
                >
                Права на фото мои, его можно опубликовать на K39. Происхождение: от заведения.
              </label>
              <div class="row">
                <UiButton
                  type="button"
                  variant="line"
                  :disabled="busy"
                  @click="uploadDish(item)"
                >
                  {{ item.mediaId ? 'Заменить фото' : 'Загрузить фото' }}
                </UiButton>
                <UiButton
                  v-if="item.mediaId"
                  type="button"
                  variant="line"
                  @click="item.mediaId = ''"
                >
                  Убрать фото
                </UiButton>
              </div>
              <p
                v-if="item.photoError"
                class="error"
              >
                {{ item.photoError }}
              </p>
            </div>
          </article>
          <UiButton
            v-if="module.dishes.length < dishMax"
            type="button"
            variant="line"
            @click="module.dishes.push(blankDish())"
          >
            Ещё блюдо
          </UiButton>
        </template>
        <template v-if="module.type === 'audience'">
          <div
            v-for="(item, itemIndex) in module.audience"
            :key="itemIndex"
            class="grid"
          >
            <UiField label="Кто">
              <UiInput v-model="item.who" />
            </UiField>
            <UiField label="Значок">
              <select v-model="item.icon">
                <option
                  v-for="icon in audienceIcons"
                  :key="icon"
                  :value="icon"
                >
                  {{ icon }}
                </option>
              </select>
            </UiField>
            <UiField label="Текст">
              <UiInput v-model="item.text" />
            </UiField>
          </div>
        </template>
        <template v-if="module.type === 'practical'">
          <div
            v-for="(item, itemIndex) in module.practical"
            :key="itemIndex"
            class="grid"
          >
            <UiField label="Тема">
              <select v-model="item.key">
                <option
                  v-for="key in practicalKeys"
                  :key="key"
                  :value="key"
                >
                  {{ key }}
                </option>
              </select>
            </UiField>
            <UiField label="Подпись">
              <UiInput v-model="item.label" />
            </UiField>
            <UiField label="Факт">
              <UiInput v-model="item.value" />
            </UiField>
          </div>
        </template>
        <template v-if="module.type === 'tips'">
          <UiField
            v-for="(tip, tipIndex) in module.tips"
            :key="tipIndex"
            label="Совет"
          >
            <UiInput v-model="tip.text" />
          </UiField>
        </template>
        <template v-if="module.type === 'faq'">
          <div
            v-for="(item, itemIndex) in module.faq"
            :key="itemIndex"
          >
            <UiField label="Вопрос">
              <UiInput v-model="item.question" />
            </UiField>
            <UiField label="Ответ">
              <UiTextarea
                v-model="item.answer"
                :rows="3"
              />
            </UiField>
          </div>
        </template>
        <p
          v-if="module.type === 'prices'"
          class="muted"
        >
          Строки этого блока задаются в «Ориентирах цен» выше.
        </p>
      </article>
      <div class="row">
        <select v-model="nextModule">
          <option
            v-for="type in moduleTypes"
            :key="type"
            :value="type"
          >
            {{ moduleTitle(type) }}
          </option>
        </select>
        <UiButton
          type="button"
          variant="line"
          @click="addModule"
        >
          Добавить блок
        </UiButton>
      </div>
    </fieldset>
    <fieldset>
      <legend>Короткий список</legend>
      <p class="muted">
        Показывается, только если на странице нет блока «Что заказать».
      </p>
      <div
        v-for="(dish, index) in form.dishes"
        :key="index"
        class="grid"
      >
        <UiField label="Блюдо">
          <UiInput v-model="dish.name" />
        </UiField>
        <UiField label="₽">
          <UiInput v-model="dish.priceRub" />
        </UiField>
        <UiField label="Заметка">
          <UiInput v-model="dish.note" />
        </UiField>
      </div>
      <UiButton
        v-if="form.dishes.length < 5"
        type="button"
        variant="line"
        @click="form.dishes.push({ name: '', priceRub: '', note: '' })"
      >
        Ещё блюдо
      </UiButton>
    </fieldset>
    <p
      v-if="error"
      class="error"
    >
      {{ error }}
    </p>
    <p
      v-if="saved"
      class="ok"
    >
      Сохранено. На сайте уже эта версия.
    </p>
    <UiButton
      type="submit"
      :disabled="busy"
    >
      Сохранить страницу
    </UiButton>
  </form>

  <section class="photos">
    <h2>Фото от заведения</h2>
    <ul
      v-if="photos.length"
      class="shots"
    >
      <li
        v-for="photo in photos"
        :key="photo.id"
      >
        <img
          :src="photo.src"
          :alt="photo.alt"
          width="160"
          height="120"
        >
        <span>{{ photo.alt }}</span>
        <button
          v-if="photo.origin === 'venue'"
          type="button"
          @click="remove(photo.id)"
        >
          Удалить
        </button>
        <span
          v-else
          class="muted"
        >фото редакции</span>
      </li>
    </ul>
    <form
      class="upload"
      @submit.prevent="upload"
    >
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        required
        @change="onFile"
      >
      <UiField label="Подпись">
        <UiInput
          v-model="photoForm.alt"
          required
        />
      </UiField>
      <UiField
        label="Автор"
        hint="Как подписать снимок"
      >
        <UiInput v-model="photoForm.author" />
      </UiField>
      <label class="rights">
        <input
          v-model="photoForm.rights"
          type="checkbox"
        >
        Права на фото мои, его можно опубликовать на K39. Происхождение: от заведения.
      </label>
      <p
        v-if="photoError"
        class="error"
      >
        {{ photoError }}
      </p>
      <UiButton
        type="submit"
        :disabled="busy"
      >
        Загрузить фото
      </UiButton>
    </form>
  </section>
  <MetaFootnote />
</template>

<script setup lang="ts">
import type { HoursFormState } from '~~/shared/venue-hours-form'
import { HOURS_NOTE_MAX } from '@k39/database/hours-note'
import { metaProductFromHref } from '~~/shared/meta-links'
import { socialLabel } from '~~/shared/venue-actions'
import { hoursPayload } from '~~/shared/venue-hours-form'
import { AUDIENCE_ICONS, DISH_SHOWCASE_MAX, dishPriceIsFresh, isDishId, PRACTICAL_KEYS, VENUE_MODULE_TITLES } from '~~/shared/venue-modules'

const props = defineProps<{ venueId: string }>()

const requestFetch = useRequestFetch()

interface Photo {
  id: string
  alt: string
  src: string
  origin: string | null
}
interface DishDraft {
  id: string
  name: string
  description: string
  priceRub: string
  savedPrice: string
  mediaId: string
  updatedAt: string
  refreshPrice: boolean
  rights: boolean
  file: File | null
  photoError: string
}
interface ModuleDraft {
  type: string
  title: string
  variant: string
  text: string
  dishes: DishDraft[]
  audience: Array<{ who: string, icon: string, text: string }>
  practical: Array<{ key: string, label: string, value: string }>
  tips: Array<{ text: string }>
  faq: Array<{ question: string, answer: string }>
}
interface CatalogItem {
  slug: string
  title: string
  defaultVariant: string | null
}

const error = ref('')
const photoError = ref('')
const saved = ref(false)
const busy = ref(false)
const file = ref<File | null>(null)
const photos = ref<Photo[]>([])
const catalog = ref<CatalogItem[]>([])
const nextModule = ref('text')
const moduleTypes = Object.keys(VENUE_MODULE_TITLES)
const audienceIcons = AUDIENCE_ICONS
const practicalKeys = PRACTICAL_KEYS
const dishMax = DISH_SHOWCASE_MAX
const photoForm = reactive({ alt: '', author: '', rights: false })
const form = reactive({
  name: '',
  description: '',
  cuisine: '',
  address: '',
  phone: '',
  website: '',
  hoursNote: '',
  bookingUrl: '',
  orderUrl: '',
  deliveryUrl: '',
  menuUrl: '',
  priceLevel: '',
  avgCheck: '',
  socials: [] as Array<{ network: string, url: string }>,
  prices: [] as Array<{ item: string, variant: string, priceRub: string }>,
  modules: [] as ModuleDraft[],
  dishes: [] as Array<{ name: string, priceRub: string, note: string }>,
  days: [] as HoursFormState['days'],
})

const metaContacts = computed(() => {
  const items: Array<{ href: string, label: string }> = []
  const push = (href: string, label: string) => {
    const url = href.trim()
    if (!url || !metaProductFromHref(url)) {
      return
    }
    items.push({ href: url, label })
  }
  push(form.website, 'Сайт')
  push(form.bookingUrl, 'Бронь')
  push(form.orderUrl, 'Заказ')
  push(form.deliveryUrl, 'Доставка')
  push(form.menuUrl, 'Меню')
  for (const social of form.socials) {
    push(social.url, socialLabel(social.network.trim()) || 'Соцсеть')
  }
  return items
})

function moduleTitle(type: string) {
  return VENUE_MODULE_TITLES[type as keyof typeof VENUE_MODULE_TITLES] || type
}

function variantHint(slug: string) {
  return catalog.value.find((item) => item.slug === slug)?.defaultVariant || 'как в меню'
}

function blankDish(): DishDraft {
  return {
    id: crypto.randomUUID(),
    name: '',
    description: '',
    priceRub: '',
    savedPrice: '',
    mediaId: '',
    updatedAt: '',
    refreshPrice: false,
    rights: false,
    file: null,
    photoError: '',
  }
}

function dishFromStored(item: unknown): DishDraft {
  const row = item as { id?: string, name?: string, description?: string | null, note?: string | null, priceRub?: number | null, mediaId?: string | null, updatedAt?: string }
  const price = row.priceRub == null ? '' : String(row.priceRub)
  return {
    id: row.id && isDishId(row.id) ? row.id : crypto.randomUUID(),
    name: row.name || '',
    description: (row.description || row.note || ''),
    priceRub: price,
    savedPrice: price,
    mediaId: row.mediaId || '',
    updatedAt: row.updatedAt || '',
    refreshPrice: false,
    rights: false,
    file: null,
    photoError: '',
  }
}

function dishCount(module: ModuleDraft) {
  return module.dishes.length
}

function stalePrice(item: DishDraft) {
  return Boolean(item.priceRub.trim() && item.updatedAt && !dishPriceIsFresh(item.updatedAt) && item.priceRub.trim() === item.savedPrice && !item.refreshPrice)
}

function dishPhoto(item: DishDraft) {
  return photos.value.find((photo) => photo.id === item.mediaId) ?? null
}

function moveDish(module: ModuleDraft, index: number, step: number) {
  const next = index + step
  if (next < 0 || next >= module.dishes.length) {
    return
  }
  const [row] = module.dishes.splice(index, 1)
  if (row) {
    module.dishes.splice(next, 0, row)
  }
}

function onDishFile(item: DishDraft, event: Event) {
  item.file = (event.target as HTMLInputElement).files?.[0] ?? null
  item.photoError = ''
}

function blankModule(type: string): ModuleDraft {
  return {
    type,
    title: '',
    variant: 'plain',
    text: '',
    dishes: [],
    audience: [{ who: '', icon: 'group', text: '' }],
    practical: [{ key: 'other', label: '', value: '' }],
    tips: [{ text: '' }],
    faq: [{ question: '', answer: '' }],
  }
}

function moduleFromStored(raw: Record<string, unknown>): ModuleDraft {
  const draft = blankModule(String(raw.type || 'text'))
  draft.title = typeof raw.title === 'string' ? raw.title : ''
  draft.variant = raw.variant === 'lead' ? 'lead' : 'plain'
  draft.text = typeof raw.text === 'string' ? raw.text : ''
  if (Array.isArray(raw.items) && draft.type === 'dishes') {
    draft.dishes = raw.items.map((item) => dishFromStored(item))
  }
  if (Array.isArray(raw.items) && draft.type === 'audience') {
    draft.audience = raw.items.map((item) => {
      const row = item as { who?: string, icon?: string, text?: string }
      return { who: row.who || '', icon: row.icon || 'group', text: row.text || '' }
    })
  }
  if (Array.isArray(raw.items) && draft.type === 'practical') {
    draft.practical = raw.items.map((item) => {
      const row = item as { key?: string, label?: string, value?: string }
      return { key: row.key || 'other', label: row.label || '', value: row.value || '' }
    })
  }
  if (Array.isArray(raw.items) && draft.type === 'tips') {
    draft.tips = raw.items.map((item) => ({ text: String(item) }))
  }
  if (Array.isArray(raw.items) && draft.type === 'faq') {
    draft.faq = raw.items.map((item) => {
      const row = item as { question?: string, answer?: string }
      return { question: row.question || '', answer: row.answer || '' }
    })
  }
  return draft
}

function modulesPayload(): unknown[] {
  return form.modules.flatMap((module): unknown[] => {
    const title = module.title.trim() || undefined
    if (module.type === 'text' && module.text.trim()) {
      return [{ type: 'text', title, variant: module.variant === 'lead' ? 'lead' : 'plain', text: module.text.trim() }]
    }
    if (module.type === 'best-time' && module.text.trim()) {
      return [{ type: 'best-time', title, text: module.text.trim() }]
    }
    if (module.type === 'how-to-get' && module.text.trim()) {
      return [{ type: 'how-to-get', text: module.text.trim() }]
    }
    if (module.type === 'prices') {
      return [{ type: 'prices', title }]
    }
    if (module.type === 'dishes') {
      const items = module.dishes.flatMap((row) => {
        if (!row.name.trim()) {
          return []
        }
        return [{
          id: row.id,
          name: row.name.trim(),
          description: row.description.trim().slice(0, 200) || null,
          priceRub: intOrNull(row.priceRub),
          mediaId: row.mediaId || null,
          refreshPrice: row.refreshPrice || undefined,
        }]
      })
      return items.length ? [{ type: 'dishes', title, items }] : []
    }
    if (module.type === 'audience') {
      const items = module.audience.flatMap((row) => row.who.trim() && row.text.trim() ? [{ who: row.who.trim(), icon: row.icon, text: row.text.trim() }] : [])
      return items.length ? [{ type: 'audience', title, items }] : []
    }
    if (module.type === 'practical') {
      const items = module.practical.flatMap((row) => row.label.trim() && row.value.trim() ? [{ key: row.key, label: row.label.trim(), value: row.value.trim() }] : [])
      return items.length ? [{ type: 'practical', title, items }] : []
    }
    if (module.type === 'tips') {
      const items = module.tips.map((tip) => tip.text.trim()).filter(Boolean)
      return items.length ? [{ type: 'tips', title, items }] : []
    }
    if (module.type === 'faq') {
      const items = module.faq.flatMap((row) => row.question.trim() && row.answer.trim() ? [{ question: row.question.trim(), answer: row.answer.trim() }] : [])
      return items.length ? [{ type: 'faq', title, items }] : []
    }
    return []
  })
}

function addModule() {
  const single = ['prices', 'dishes', 'audience', 'practical', 'best-time', 'how-to-get', 'faq']
  if (single.includes(nextModule.value) && form.modules.some((item) => item.type === nextModule.value)) {
    return
  }
  form.modules.push(blankModule(nextModule.value))
}

function moveModule(index: number, step: number) {
  const next = index + step
  if (next < 0 || next >= form.modules.length) {
    return
  }
  const [row] = form.modules.splice(index, 1)
  if (row) {
    form.modules.splice(next, 0, row)
  }
}

function problem(reason: unknown, fallback: string) {
  const item = reason as { data?: { message?: string, statusMessage?: string }, statusMessage?: string }
  return item.data?.statusMessage || item.data?.message || item.statusMessage || fallback
}

function intOrNull(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  const number = Number(trimmed.replace(',', '.'))
  return Number.isFinite(number) ? Math.round(number) : null
}

const loaded = await requestFetch<{
  venue: {
    name: string
    description: string
    cuisineTags: string[]
    address: string | null
    phone: string | null
    website: string | null
    socials: Array<{ network: string, url: string }>
    bookingUrl: string | null
    orderUrl: string | null
    deliveryUrl: string | null
    menuUrl: string | null
    priceLevel: number | null
    avgCheck: number | null
    modules: unknown[]
    signatureDishes: Array<{ name: string, note?: string | null, priceRub?: number | null }>
  }
  hours: HoursFormState
  prices: Array<{ item: string, variant: string, priceRub: number }>
  catalog: CatalogItem[]
  photos: Photo[]
}>(`/api/cabinet/venues/${props.venueId}`)

form.name = loaded.venue.name
form.description = loaded.venue.description
form.cuisine = loaded.venue.cuisineTags.join(', ')
form.address = loaded.venue.address || ''
form.phone = loaded.venue.phone || ''
form.website = loaded.venue.website || ''
form.bookingUrl = loaded.venue.bookingUrl || ''
form.orderUrl = loaded.venue.orderUrl || ''
form.deliveryUrl = loaded.venue.deliveryUrl || ''
form.menuUrl = loaded.venue.menuUrl || ''
form.priceLevel = loaded.venue.priceLevel == null ? '' : String(loaded.venue.priceLevel)
form.avgCheck = loaded.venue.avgCheck == null ? '' : String(loaded.venue.avgCheck)
const hours = loaded.hours
form.hoursNote = hours.note
form.socials = loaded.venue.socials.length ? loaded.venue.socials.map((row) => ({ ...row })) : [{ network: '', url: '' }]
catalog.value = loaded.catalog
form.prices = loaded.prices.map((row) => ({
  item: row.item,
  variant: row.variant,
  priceRub: String(row.priceRub),
}))
form.modules = (Array.isArray(loaded.venue.modules) ? loaded.venue.modules : []).flatMap((item) => {
  if (!item || typeof item !== 'object') {
    return []
  }
  return [moduleFromStored(item as Record<string, unknown>)]
})
form.dishes = loaded.venue.signatureDishes.map((row) => ({
  name: row.name,
  priceRub: row.priceRub == null ? '' : String(row.priceRub),
  note: row.note || '',
}))
form.days = hours.days
photos.value = loaded.photos
// The hours as loaded. A save sends `hours` only when the table or the note differs,
// so a description save does not mark the schedule checked.
let savedHours = JSON.stringify(hoursField())

function hoursField() {
  return hoursPayload(form.days, form.hoursNote, { openEnded: false })
}

function changedHours() {
  const next = hoursField()
  return hours.editable && JSON.stringify(next) !== savedHours ? next : undefined
}

function payload() {
  return {
    name: form.name,
    description: form.description,
    cuisineTags: form.cuisine.split(',').map((item) => item.trim()).filter(Boolean),
    address: form.address || null,
    phone: form.phone || null,
    website: form.website || null,
    bookingUrl: form.bookingUrl || null,
    orderUrl: form.orderUrl || null,
    deliveryUrl: form.deliveryUrl || null,
    menuUrl: form.menuUrl || null,
    priceLevel: intOrNull(form.priceLevel),
    avgCheck: intOrNull(form.avgCheck),
    socials: form.socials.filter((row) => row.network.trim() && row.url.trim()),
    modules: modulesPayload(),
    prices: form.prices.flatMap((row) => {
      const priceRub = intOrNull(row.priceRub)
      if (!row.item || priceRub == null || priceRub < 1) {
        return []
      }
      return [{
        item: row.item,
        variant: row.variant.trim() || null,
        priceRub,
        checkedAt: new Date().toISOString().slice(0, 10),
        sourceKind: 'owner',
        sourceTitle: 'Сообщено заведением',
        sourceUrl: null,
      }]
    }),
    signatureDishes: form.dishes.flatMap((row) => {
      if (!row.name.trim()) {
        return []
      }
      return [{ name: row.name.trim(), priceRub: intOrNull(row.priceRub), note: row.note.trim() || null }]
    }),
    hours: changedHours(),
  }
}

async function save() {
  error.value = ''
  saved.value = false
  busy.value = true
  try {
    // Typed routes resolve this template to the [id] GET handler only, so widen it to reach [id].patch.ts.
    const url: string = `/api/cabinet/venues/${props.venueId}`
    await $fetch(url, { method: 'PATCH', body: payload() })
    savedHours = JSON.stringify(hoursField())
    saved.value = true
  } catch (reason) {
    error.value = problem(reason, 'Не удалось сохранить')
  } finally {
    busy.value = false
  }
}

function onFile(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

async function upload() {
  photoError.value = ''
  if (!file.value) {
    return
  }
  if (!photoForm.rights) {
    photoError.value = 'Нужна отметка, что права на фото ваши.'
    return
  }
  busy.value = true
  const body = new FormData()
  body.set('file', file.value)
  body.set('alt', photoForm.alt)
  body.set('author', photoForm.author)
  body.set('rights', '1')
  try {
    await $fetch(`/api/cabinet/venues/${props.venueId}/media`, { method: 'POST', body })
    const again = await $fetch<{ photos: Photo[] }>(`/api/cabinet/venues/${props.venueId}`)
    photos.value = again.photos
    photoForm.alt = ''
    photoForm.rights = false
    file.value = null
  } catch (reason) {
    photoError.value = problem(reason, 'Не удалось загрузить фото')
  } finally {
    busy.value = false
  }
}

async function uploadDish(item: DishDraft) {
  item.photoError = ''
  if (!item.file) {
    item.photoError = 'Выберите файл.'
    return
  }
  if (!item.rights) {
    item.photoError = 'Нужна отметка, что права на фото ваши.'
    return
  }
  busy.value = true
  const body = new FormData()
  body.set('file', item.file)
  body.set('alt', item.name.trim() || 'Блюдо')
  body.set('rights', '1')
  body.set('placement', 'dish')
  try {
    const saved = await $fetch<{ id: string }>(`/api/cabinet/venues/${props.venueId}/media`, { method: 'POST', body })
    item.mediaId = saved.id
    item.rights = false
    item.file = null
    const again = await $fetch<{ photos: Photo[] }>(`/api/cabinet/venues/${props.venueId}`)
    photos.value = again.photos
  } catch (reason) {
    item.photoError = problem(reason, 'Не удалось загрузить фото')
  } finally {
    busy.value = false
  }
}

async function remove(id: string) {
  photoError.value = ''
  try {
    await $fetch(`/api/cabinet/venues/${props.venueId}/media/${id}`, { method: 'DELETE' })
    photos.value = photos.value.filter((item) => item.id !== id)
    for (const module of form.modules) {
      for (const dish of module.dishes) {
        if (dish.mediaId === id) {
          dish.mediaId = ''
        }
      }
    }
  } catch (reason) {
    photoError.value = problem(reason, 'Не удалось удалить фото')
  }
}
</script>

<style scoped>
.editor, .upload { display: grid; gap: 0.75rem; }
.row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.module { display: grid; gap: 0.55rem; margin: 0.8rem 0; padding-top: 0.6rem; border-top: 1px dashed var(--color-line); }
.dish-edit { display: grid; gap: 0.55rem; margin: 0.6rem 0; padding: 0.7rem 0; border-top: 1px solid var(--color-line); }
.dish-photo { display: grid; gap: 0.45rem; }
.dish-photo img { width: 96px; height: 72px; object-fit: cover; border-radius: 8px; }
select { font: inherit; padding: 0.45rem 0.55rem; }
fieldset {
  margin: 0;
  padding: 0.8rem 0 0;
  border: 0;
  border-top: 1px dashed var(--color-line);
}
legend { padding: 0; font-weight: 700; }
.grid { display: grid; gap: 0.6rem; }
.muted { margin: 0.2rem 0 0.4rem; color: var(--muted); font-size: 0.92rem; }
.socials { display: flex; flex-wrap: wrap; gap: 0.3rem 0.8rem; margin: 0.4rem 0 0; }
.error { color: var(--color-danger, var(--color-brick)); }
.ok { color: var(--color-sea-dark, var(--color-ink)); }
.photos { margin-top: 2rem; }
.shots { display: grid; gap: 0.8rem; margin: 0; padding: 0; list-style: none; }
.shots li { display: grid; grid-template-columns: 96px 1fr auto; gap: 0.6rem; align-items: center; }
.shots img { width: 96px; height: 72px; object-fit: cover; border-radius: 8px; }
.rights { display: flex; gap: 0.5rem; align-items: flex-start; }
@media (min-width: 720px) {
  .grid { grid-template-columns: 1fr 1fr; }
}
</style>
