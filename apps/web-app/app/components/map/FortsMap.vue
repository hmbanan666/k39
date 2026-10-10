<template>
  <div
    ref="rootEl"
    class="forts-map"
  >
    <div
      ref="mapEl"
      class="map"
      :class="{ dragging }"
      aria-label="Иллюстрированная карта фортов Калининграда"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <svg
        :class="{ 'labels-off': labelsOff, 'gates-on': gatesOn, 'landmarks-on': landmarksOn }"
        role="img"
      >
        <defs>
          <pattern
            id="k39-grain"
            patternUnits="userSpaceOnUse"
            width="220"
            height="220"
          >
            <image
              v-if="grainUrl"
              :href="grainUrl"
              width="220"
              height="220"
            />
          </pattern>
          <pattern
            id="k39-hatch"
            patternUnits="userSpaceOnUse"
            width="7"
            height="7"
            patternTransform="rotate(-8)"
          >
            <line
              x1="0"
              y1="3.5"
              x2="7"
              y2="3.5"
              stroke="#58705f"
              stroke-width=".7"
              opacity=".45"
            />
          </pattern>
          <radialGradient
            id="k39-vign"
            cx="50%"
            cy="50%"
            r="72%"
          >
            <stop
              offset="60%"
              stop-color="#7a5a32"
              stop-opacity="0"
            />
            <stop
              offset="100%"
              stop-color="#7a5a32"
              stop-opacity=".22"
            />
          </radialGradient>
          <clipPath id="k39-clip">
            <rect
              x="0"
              y="0"
              :width="geo.W"
              :height="geo.H"
            />
          </clipPath>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="#e3d2ab"
        />
        <g :transform="viewportTransform">
          <g clip-path="url(#k39-clip)">
            <rect
              x="0"
              y="0"
              :width="geo.W"
              :height="geo.H"
              fill="#efe3c8"
            />
            <path
              :d="geo.city"
              fill="#e7d6b2"
            />
            <path
              :d="geo.city"
              fill="none"
              stroke="#8a6e4e"
              stroke-width="1.3"
              stroke-dasharray="6 3 1.5 3"
              vector-effect="non-scaling-stroke"
            />
            <path
              :d="geo.water"
              fill="#b9c7bd"
            />
            <path
              :d="geo.water"
              fill="url(#k39-hatch)"
            />
            <path
              :d="geo.water"
              fill="none"
              stroke="#3a2e24"
              stroke-width="1.4"
              vector-effect="non-scaling-stroke"
            />
            <path
              v-for="(island, index) in geo.islands"
              :key="`island-${index}`"
              :d="island"
              fill="#efe3c8"
              stroke="#3a2e24"
              stroke-width="1"
              vector-effect="non-scaling-stroke"
            />
            <path
              v-for="lake in geo.lakes"
              :key="lake.name"
              :d="lake.d"
              fill="#b9c7bd"
              stroke="#3a2e24"
              stroke-width="1.1"
              vector-effect="non-scaling-stroke"
            />
            <path
              v-for="(river, index) in geo.rivers"
              :key="`river-ink-${index}`"
              :d="river.d"
              fill="none"
              stroke="#3a2e24"
              stroke-width="6.4"
              stroke-linecap="round"
            />
            <path
              v-for="(river, index) in geo.rivers"
              :key="`river-water-${index}`"
              :d="river.d"
              fill="none"
              stroke="#b9c7bd"
              stroke-width="4.2"
              stroke-linecap="round"
            />
            <path
              :d="ringD"
              fill="none"
              stroke="#9b3d2a"
              stroke-width="7"
              opacity=".1"
            />
            <path
              id="k39-ring"
              :d="ringD"
              fill="none"
              stroke="#9b3d2a"
              stroke-width="1.6"
              stroke-dasharray="9 5"
              vector-effect="non-scaling-stroke"
            />
            <path
              :d="wallD"
              fill="none"
              stroke="#6b5a48"
              stroke-width="4"
              opacity=".12"
            />
            <path
              id="k39-wall"
              :d="wallD"
              fill="none"
              stroke="#6b5a48"
              stroke-width="1.3"
              stroke-dasharray="2 3"
              vector-effect="non-scaling-stroke"
            />
            <text
              v-for="label in labels"
              :key="label.text"
              class="lbl"
              :x="label.x"
              :y="label.y"
              :fill="label.fill"
              :font-size="label.size"
              :font-style="label.italic ? 'italic' : 'normal'"
              text-anchor="middle"
              :letter-spacing="label.ls"
              :transform="label.rot ? `rotate(${label.rot} ${label.x} ${label.y})` : undefined"
            >{{ label.text }}</text>
            <text
              class="lbl"
              font-size="11"
              fill="#9b3d2a"
              font-style="italic"
            >
              <textPath
                href="#k39-ring"
                startOffset="33%"
              >кольцо фортов «Ночная перина» (линия схематична)</textPath>
            </text>
            <text
              class="lbl"
              font-size="7.5"
              fill="#6b5a48"
              font-style="italic"
            >
              <textPath
                href="#k39-wall"
                startOffset="62%"
              >второй вал (схематично)</textPath>
            </text>
            <g v-show="questOn">
              <path
                :d="routeD"
                fill="none"
                stroke="#efe3c8"
                stroke-width="7"
                stroke-linecap="round"
                vector-effect="non-scaling-stroke"
              />
              <path
                :d="routeD"
                fill="none"
                stroke="#9b3d2a"
                stroke-width="3"
                stroke-dasharray="1 7"
                stroke-linecap="round"
                vector-effect="non-scaling-stroke"
              />
              <path
                v-for="(leg, index) in doneLegs"
                :key="`leg-${index}`"
                :d="leg"
                fill="none"
                stroke="#cf9a3a"
                stroke-width="4.5"
                stroke-linecap="round"
                vector-effect="non-scaling-stroke"
              />
            </g>
            <rect
              x="0"
              y="0"
              :width="geo.W"
              :height="geo.H"
              fill="url(#k39-grain)"
              opacity=".45"
              pointer-events="none"
            />
            <rect
              x="0"
              y="0"
              :width="geo.W"
              :height="geo.H"
              fill="url(#k39-vign)"
              pointer-events="none"
            />
          </g>
          <rect
            x="0"
            y="0"
            :width="geo.W"
            :height="geo.H"
            fill="none"
            stroke="#3a2e24"
            stroke-width="2.2"
            vector-effect="non-scaling-stroke"
          />
          <g
            v-for="object in objects"
            :key="object.id"
            class="mk"
            :class="{ hidden: !isVisible(object), dim: questOn && !questIdSet.has(object.id), sel: selectedId === object.id }"
            :data-id="object.id"
            :transform="`translate(${object.x.toFixed(1)} ${object.y.toFixed(1)}) scale(${iconScale.toFixed(4)})`"
          >
            <g class="halo"><circle
              r="16"
              fill="none"
              stroke="#9b3d2a"
              stroke-width="2"
            /></g>
            <circle
              class="hit"
              r="19"
            />
            <g v-if="object.type === 'fort'">
              <path
                :d="bastionPath((object.ring === 'main' ? 14 : 10.5) + 2.2)"
                fill="#efe3c8"
                stroke="#3a2e24"
                stroke-width=".8"
              />
              <path
                :d="bastionPath(object.ring === 'main' ? 14 : 10.5)"
                :fill="markerFill(object)"
                stroke="#3a2e24"
                stroke-width="1.4"
              />
              <circle
                :r="(object.ring === 'main' ? 14 : 10.5) * 0.5"
                fill="#efe3c8"
                stroke="#3a2e24"
                stroke-width=".8"
              />
              <text
                :y="(object.ring === 'main' ? 14 : 10.5) * 0.2"
                text-anchor="middle"
                :font-size="(object.num && object.num.length > 1 ? 7 : 8)"
                font-weight="700"
                fill="#3a2e24"
              >{{ object.num }}</text>
            </g>
            <path
              v-else-if="object.type === 'landmark'"
              :d="CHURCH_PATH"
              fill="#d9c39a"
              stroke="#3a2e24"
              stroke-width="1.3"
            />
            <path
              v-else
              :d="object.type === 'tower' ? TOWER_PATH : GATE_PATH"
              :fill="markerFill(object)"
              stroke="#3a2e24"
              stroke-width="1.2"
            />
            <text
              :class="labelClass(object)"
              :x="labelX(object)"
              :y="labelY(object)"
              :text-anchor="labelAnchor(object)"
            >{{ labelText(object) }}</text>
          </g>
          <g transform="translate(70 170)">
            <circle
              r="30"
              fill="none"
              stroke="#3a2e24"
              stroke-width=".8"
            />
            <path
              d="M0,-40 L6,0 L0,6 L-6,0Z"
              fill="#3a2e24"
            />
            <text
              y="-45"
              text-anchor="middle"
              font-size="13"
              font-weight="700"
              class="lbl"
            >С</text>
          </g>
          <g :transform="`translate(24 ${geo.H - 108})`">
            <rect
              width="300"
              height="86"
              fill="#efe3c8"
              stroke="#3a2e24"
              stroke-width="1.4"
            />
            <text
              x="150"
              y="26"
              text-anchor="middle"
              font-size="17"
              font-weight="700"
              fill="#3a2e24"
            >Кёнигсбергская крепость</text>
            <text
              x="150"
              y="43"
              text-anchor="middle"
              font-size="10.5"
              font-style="italic"
              fill="#6b5a48"
            >12 основных фортов, малые форты и городские ворота</text>
          </g>
        </g>
      </svg>
    </div>

    <div class="top">
      <div class="titlebar">
        <div class="brand">
          <h1><a href="/">Форты Кёнигсберга</a></h1>
          <small>Калининград, иллюстрированная схема, K39</small>
        </div>
        <div class="spacer" />
        <button
          type="button"
          class="btn quest"
          :class="{ on: questOn }"
          @click="toggleQuest"
        >
          {{ questOn ? 'Квест включён' : 'Квест: 5 фортов' }}
        </button>
      </div>
      <div class="chips">
        <button
          v-for="chip in chips"
          :key="chip.key"
          type="button"
          class="chip"
          :class="{ on: filters[chip.key] }"
          @click="filters[chip.key] = !filters[chip.key]"
        >
          <span class="dot" />{{ chip.label }}
        </button>
        <button
          type="button"
          class="chip"
          @click="modal = modal === 'legend' ? null : 'legend'"
        >
          Легенда
        </button>
      </div>
      <div
        class="questbar"
        :class="{ on: questOn }"
      >
        <div class="qhead">
          <b>Квест: 5 фортов</b>
          <span>{{ doneCount }} из {{ questIds.length }}</span>
          <button
            type="button"
            @click="resetArmed ? resetQuest() : (resetArmed = true)"
          >
            {{ resetArmed ? 'Нажмите ещё раз' : 'сбросить' }}
          </button>
        </div>
        <div class="progress">
          <i :style="{ width: `${questIds.length ? doneCount / questIds.length * 100 : 0}%` }" />
        </div>
        <div class="qsteps">
          <button
            v-for="(id, index) in questIds"
            :key="id"
            type="button"
            class="qstep"
            :class="{ done: visited[id] }"
            @click="openObject(id)"
          >
            {{ visited[id] ? '✓' : index + 1 }}. № {{ byId.get(id)?.num }}
          </button>
        </div>
        <div class="qnote">
          {{ questNote }}
        </div>
      </div>
    </div>

    <div class="zoom">
      <button
        type="button"
        aria-label="Приблизить"
        @click="zoomBy(1.7)"
      >
        +
      </button>
      <button
        type="button"
        aria-label="Отдалить"
        @click="zoomBy(1 / 1.7)"
      >
        -
      </button>
      <button
        type="button"
        aria-label="Вся карта"
        @click="reset(true)"
      >
        ⤢
      </button>
    </div>
    <div class="attrib">
      Контуры © <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener"
      >участники OpenStreetMap</a> (ODbL). Тексты: Википедия и сайты музеев.
      <button
        type="button"
        class="srcl"
        @click="modal = 'about'"
      >
        О карте
      </button>
    </div>

    <section
      class="sheet"
      :class="{ open: Boolean(selected) }"
    >
      <button
        type="button"
        class="x"
        aria-label="Закрыть"
        @click="closeSheet"
      >
        ×
      </button>
      <div
        v-if="selected"
        class="sc"
      >
        <div class="kicker">
          {{ kicker(selected) }}
        </div>
        <h2>{{ cardTitle(selected) }}</h2>
        <div
          v-if="selected.de"
          class="de"
        >
          {{ selected.de }}
        </div>
        <div
          v-if="selected.name_note"
          class="note"
        >
          {{ selected.name_note }}
        </div>
        <div class="badges">
          <span class="badge"><i :style="{ background: markerFill(selected) }" />{{ selected.status_text }}</span>
          <span
            v-if="selected.ruin"
            class="badge"
          >руины</span>
        </div>
        <p
          v-if="selected.status_src"
          class="srcl"
        >
          Статус: <a
            :href="selected.status_src[1]"
            target="_blank"
            rel="noopener"
          >{{ selected.status_src[0] }}</a>
        </p>
        <p>Часы работы: {{ selected.hours || 'уточнить' }}</p>
        <p
          v-if="selected.hours_note"
          class="srcl"
        >
          {{ selected.hours_note }}
        </p>
        <p class="desc">
          {{ selected.desc }}
        </p>
        <p class="srcl">
          Источник: <a
            :href="selected.src[1]"
            target="_blank"
            rel="noopener"
          >{{ selected.src[0] }}</a>
        </p>
        <h3>Как добраться</h3>
        <p>{{ selected.how }}</p>
        <div class="actions">
          <button
            v-if="questOn && questIdSet.has(selected.id)"
            type="button"
            class="here"
            :class="{ done: visited[selected.id] }"
            @click="markHere(selected.id)"
          >
            {{ visited[selected.id] ? 'Отмечено. Нажмите, чтобы снять' : 'Я здесь' }}
          </button>
          <a
            class="ya"
            :href="selected.yandex"
            target="_blank"
            rel="noopener"
          >Маршрут в Яндекс Картах</a>
          <a :href="`/place/${selected.slug}`">Страница места</a>
        </div>
        <div class="partner">
          <b>Бонус партнёра</b><br>
          Место для предложения кафе, гида или проката рядом. Партнёров пока нет.
        </div>
        <p class="srcl">
          Координаты: {{ selected.lat.toFixed(5) }}, {{ selected.lon.toFixed(5) }}
        </p>
      </div>
    </section>

    <div
      class="modal"
      :class="{ on: modal }"
      @click.self="modal = null"
    >
      <div
        v-if="modal === 'legend'"
        class="card"
      >
        <h2>Легенда</h2>
        <div
          v-for="item in statusLegend"
          :key="item.label"
          class="legend-row"
        >
          <i :style="{ background: item.color }" />{{ item.label }}
        </div>
        <p>Звезда: форт. Арка: городские ворота. Башня: укрепление второго вала. Пунктир показывает схему кольца, не историческую линию стен.</p>
        <button
          type="button"
          class="btn"
          @click="modal = null"
        >
          Понятно
        </button>
      </div>
      <div
        v-else-if="modal === 'about'"
        class="card"
      >
        <h2>О карте</h2>
        <p>Иллюстрированная схема K39. Берег, Преголя, пруды и граница города взяты из OpenStreetMap (© участники OpenStreetMap, ODbL), упрощены и перерисованы. Координаты объектов: Википедия, для фортов № 9 и № 10 OpenStreetMap.</p>
        <p>Статусы и часы указаны только там, где их подтверждает источник. Если подтверждения нет, стоит «уточнить». Кнопка «Я здесь» не проверяет геолокацию. Прогресс квеста хранится в этом браузере.</p>
        <button
          type="button"
          class="btn"
          @click="modal = null"
        >
          Закрыть
        </button>
      </div>
    </div>
    <div
      class="toast"
      :class="{ on: toastOn }"
    >
      {{ toast }}
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FortsGeo, MapObject } from '~/utils/forts-geometry'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import rawGeo from '~/data/forts/geo.json'
import rawObjects from '~/data/forts/objects.json'
import rawQuest from '~/data/forts/quest.json'
import { bastionPath, byAngle, catmull, centroid, CHURCH_PATH, FORT_STATUS, GATE_PATH, legPath, project, TOWER_PATH } from '~/utils/forts-geometry'

const geo = rawGeo as FortsGeo
const questIds = rawQuest.ids
const questNote = rawQuest.note
const questIdSet = new Set(questIds)
const { track } = useTrack()

const objects = (rawObjects as Array<Omit<MapObject, 'x' | 'y'>>).map((object) => {
  const point = project(geo, object.lon, object.lat)
  return { ...object, x: point.x, y: point.y }
})
const byId = new Map(objects.map((object) => [object.id, object]))
const forts = objects.filter((object) => object.type === 'fort')
const center = centroid(forts)
const ringD = catmull(byAngle(forts, center.x, center.y).map((object) => [object.x, object.y]), true)
const walls = objects.filter((object) => object.type === 'gate' || object.type === 'tower')
const wallCenter = centroid(walls)
const wallD = catmull(byAngle(walls, wallCenter.x, wallCenter.y).map((object) => [object.x, object.y]), true)
const questPoints = questIds.map((id) => byId.get(id)).filter((object): object is MapObject => Boolean(object))
const routeD = catmull(questPoints.map((object) => [object.x, object.y]), false)

const labelSpecs = [
  { text: 'Калининградский', lon: 20.372, lat: 54.668, size: 15, italic: true, fill: '#4a6352', rot: -58, ls: 2 },
  { text: 'залив', lon: 20.383, lat: 54.663, size: 15, italic: true, fill: '#4a6352', rot: -58, ls: 2 },
  { text: 'р. Преголя', lon: 20.452, lat: 54.6985, size: 13, italic: true, fill: '#3e5546', rot: 6, ls: 0 },
  { text: 'Старая Преголя', lon: 20.575, lat: 54.7085, size: 11, italic: true, fill: '#3e5546', rot: 8, ls: 0 },
  { text: 'Новая Преголя', lon: 20.57, lat: 54.691, size: 11, italic: true, fill: '#3e5546', rot: 14, ls: 0 },
  { text: 'КАЛИНИНГРАД', lon: 20.468, lat: 54.733, size: 22, italic: false, fill: '#6b5a48', rot: 0, ls: 9 },
  { text: 'Верхнее оз.', lon: 20.519, lat: 54.7345, size: 9.5, italic: true, fill: '#3e5546', rot: 0, ls: 0 },
  { text: 'о. Канта', lon: 20.512, lat: 54.7034, size: 9, italic: true, fill: '#3a2e24', rot: 0, ls: 0 },
]
const labels = labelSpecs.map((label) => {
  const point = project(geo, label.lon, label.lat)
  return { ...label, x: point.x, y: point.y }
})
const statusLegend = Object.values(FORT_STATUS)

const rootEl = ref<HTMLElement | null>(null)
const mapEl = ref<HTMLElement | null>(null)
const frame = reactive({ w: 1024, h: 800 })
const view = reactive({ s: 1, x: 0, y: 0 })
const dragging = ref(false)
const grainUrl = ref('')
const selectedId = ref<string | null>(null)
const modal = ref<'legend' | 'about' | null>(null)
const toast = ref('')
const toastOn = ref(false)
const questOn = ref(false)
const resetArmed = ref(false)
const visited = reactive<Record<string, number>>({})
const filters = reactive({ fort: true, gate: true, inside: false, ruin: false })
const chips = [
  { key: 'fort' as const, label: 'Форты' },
  { key: 'gate' as const, label: 'Ворота' },
  { key: 'inside' as const, label: 'Можно внутрь' },
  { key: 'ruin' as const, label: 'Руины' },
]

const selected = computed(() => selectedId.value ? byId.get(selectedId.value) ?? null : null)
const doneCount = computed(() => questIds.filter((id) => visited[id]).length)
const doneLegs = computed(() => {
  const points = questPoints.map((object) => [object.x, object.y] as [number, number])
  const legs: string[] = []
  questPoints.forEach((object, index) => {
    const next = questPoints[index + 1]
    if (next && visited[object.id] && visited[next.id]) {
      legs.push(legPath(points, index))
    }
  })
  return legs
})
const labelsOff = computed(() => view.s < 0.62)
const gatesOn = computed(() => view.s >= 1.5)
const landmarksOn = computed(() => view.s >= 1)
const iconScale = computed(() => {
  let scale = (view.s ** 0.35) / view.s * 1.05
  if (frame.w < 600) {
    scale *= 1.08
  }
  return scale
})
const viewportTransform = computed(() => `translate(${view.x.toFixed(2)} ${view.y.toFixed(2)}) scale(${view.s.toFixed(4)})`)

let fitS = 1
let minS = 0.3
const maxS = 9
let anim = 0
let toastTimer = 0
const pointers = new Map<number, { x: number, y: number }>()
let gesture: { type: 'pan' | 'pinch', sx: number, sy: number, vx: number, vy: number, moved: number, target: EventTarget | null, d?: number, mx?: number, my?: number, s?: number } | null = null

function size() {
  frame.w = mapEl.value?.clientWidth || frame.w
  frame.h = mapEl.value?.clientHeight || frame.h
}

function clamp() {
  const margin = 80
  const width = geo.W * view.s
  const height = geo.H * view.s
  view.x = Math.min(frame.w - margin, Math.max(margin - width, view.x))
  view.y = Math.min(frame.h - margin, Math.max(margin - height, view.y))
}

function fitTarget() {
  size()
  const top = rootEl.value?.querySelector('.top')?.getBoundingClientRect().height ?? 88
  const bottom = 20
  const width = frame.w
  const height = Math.max(100, frame.h - top - bottom)
  let x0 = 60
  let x1 = 930
  let y0 = 120
  let y1 = 880
  if (width > 900) {
    x0 = 0
    x1 = geo.W
    y0 = 0
    y1 = geo.H
  }
  const scale = Math.min(width / (x1 - x0), height / (y1 - y0))
  return {
    s: scale,
    x: (width - (x1 - x0) * scale) / 2 - x0 * scale,
    y: top + (height - (y1 - y0) * scale) / 2 - y0 * scale,
  }
}

function animateTo(target: { s: number, x: number, y: number }, ms = 380) {
  cancelAnimationFrame(anim)
  const start = { s: view.s, x: view.x, y: view.y }
  const t0 = performance.now()
  const step = (now: number) => {
    const progress = Math.min(1, (now - t0) / ms)
    const eased = 1 - (1 - progress) ** 3
    const scale = Math.exp(Math.log(start.s) + (Math.log(target.s) - Math.log(start.s)) * eased)
    const blend = Math.abs(target.s - start.s) < 1e-6 ? eased : (scale - start.s) / (target.s - start.s)
    view.s = scale
    view.x = start.x + (target.x - start.x) * blend
    view.y = start.y + (target.y - start.y) * blend
    if (progress < 1) {
      anim = requestAnimationFrame(step)
    }
  }
  anim = requestAnimationFrame(step)
}

function reset(animated: boolean) {
  const next = fitTarget()
  fitS = next.s
  minS = next.s * 0.6
  if (animated) {
    animateTo(next)
    return
  }
  view.s = next.s
  view.x = next.x
  view.y = next.y
}

function zoomBy(factor: number) {
  size()
  const nextScale = Math.max(minS, Math.min(maxS, view.s * factor))
  const applied = nextScale / view.s
  const sx = frame.w / 2
  const sy = frame.h / 2
  animateTo({
    s: nextScale,
    x: sx - (sx - view.x) * applied,
    y: sy - (sy - view.y) * applied,
  }, 260)
}

function isVisible(object: MapObject) {
  if (object.type === 'landmark') {
    return true
  }
  if (object.type === 'fort' && !filters.fort) {
    return false
  }
  if ((object.type === 'gate' || object.type === 'tower') && !filters.gate) {
    return false
  }
  if (filters.inside || filters.ruin) {
    return (filters.inside && object.inside) || (filters.ruin && object.ruin)
  }
  return true
}

function markerFill(object: MapObject) {
  if (questOn.value && visited[object.id]) {
    return '#cf9a3a'
  }
  return FORT_STATUS[object.status]?.color ?? '#a69d8e'
}

function labelText(object: MapObject) {
  if (object.type === 'fort') {
    return object.name
  }
  if (object.type === 'landmark') {
    return 'Кафедральный собор'
  }
  return object.name.replace(' ворота', '').replace('Бастион ', 'бастион ').replace('Башня ', 'башня ')
}

function labelX(object: MapObject) {
  if (object.type !== 'fort') {
    return 0
  }
  const radius = object.ring === 'main' ? 14 : 10.5
  return (object.x < center.x ? -1 : 1) * (radius + 5)
}

function labelY(object: MapObject) {
  if (object.type === 'fort') {
    return (object.ring === 'main' ? 14 : 10.5) * 0.35
  }
  return object.type === 'landmark' ? 19 : 17
}

function labelAnchor(object: MapObject) {
  if (object.type !== 'fort') {
    return 'middle'
  }
  return object.x < center.x ? 'end' : 'start'
}

function labelClass(object: MapObject) {
  if (object.type === 'fort') {
    return 'lbl lbl-obj lbl-fort'
  }
  if (object.type === 'landmark') {
    return 'lbl lbl-obj lbl-landmark'
  }
  return 'lbl lbl-obj lbl-gate'
}

function cardTitle(object: MapObject) {
  return object.type === 'fort' ? `Форт № ${object.num} «${object.name}»` : object.name
}

function kicker(object: MapObject) {
  const typeLabel = object.type === 'fort'
    ? 'Форт'
    : object.type === 'gate'
      ? 'Городские ворота'
      : object.type === 'tower'
        ? 'Укрепление второго вала'
        : 'Достопримечательность'
  const parts = [typeLabel]
  if (object.ring === 'small') {
    parts.push('малый (промежуточный)')
  }
  const questIndex = questIds.indexOf(object.id)
  if (questIndex >= 0) {
    parts.push(`точка квеста ${questIndex + 1}/5`)
  }
  return parts.join(', ')
}

function showToast(message: string) {
  toast.value = message
  toastOn.value = true
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toastOn.value = false
  }, 1700)
}

function saveQuest() {
  localStorage.setItem('k39.forts.quest.v1', JSON.stringify({ on: questOn.value, visited: { ...visited } }))
}

function toggleQuest() {
  questOn.value = !questOn.value
  saveQuest()
  if (questOn.value) {
    showToast(`Маршрут: ${questPoints.map((object) => `№ ${object.num}`).join(' → ')}`)
    reset(true)
    track('quest_open', { questSlug: 'five-forts' })
  }
}

function resetQuest() {
  for (const key of Object.keys(visited)) {
    delete visited[key]
  }
  resetArmed.value = false
  saveQuest()
}

function markHere(id: string) {
  const object = byId.get(id)
  if (visited[id]) {
    delete visited[id]
  } else {
    visited[id] = Date.now()
    const done = questIds.filter((item) => visited[item]).length
    showToast(done === questIds.length ? 'Квест пройден' : `Форт отмечен: ${done} из ${questIds.length}`)
    track('quest_mark', { placeSlug: object?.slug, questSlug: 'five-forts' })
  }
  saveQuest()
}

function openObject(id: string, keepView = false) {
  const object = byId.get(id)
  if (!object) {
    return
  }
  selectedId.value = id
  if (keepView) {
    return
  }
  size()
  const desk = frame.w >= 900
  const scale = Math.max(view.s, fitS * (desk ? 1.6 : 1.5))
  const tx = desk ? (frame.w - 440) / 2 : frame.w / 2
  const ty = desk ? frame.h / 2 : frame.h * 0.34
  animateTo({ s: scale, x: tx - object.x * scale, y: ty - object.y * scale })
}

function closeSheet() {
  selectedId.value = null
}

function onPointerDown(event: PointerEvent) {
  mapEl.value?.setPointerCapture(event.pointerId)
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  cancelAnimationFrame(anim)
  if (pointers.size === 1) {
    gesture = { type: 'pan', sx: event.clientX, sy: event.clientY, vx: view.x, vy: view.y, moved: 0, target: event.target }
  }
}

function onPointerMove(event: PointerEvent) {
  if (!pointers.has(event.pointerId) || !gesture) {
    return
  }
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (gesture.type === 'pan' && pointers.size === 1) {
    const dx = event.clientX - gesture.sx
    const dy = event.clientY - gesture.sy
    gesture.moved = Math.max(gesture.moved, Math.hypot(dx, dy))
    dragging.value = gesture.moved > 4
    view.x = gesture.vx + dx
    view.y = gesture.vy + dy
    clamp()
  }
}

function onPointerUp(event: PointerEvent) {
  if (!pointers.has(event.pointerId)) {
    return
  }
  pointers.delete(event.pointerId)
  dragging.value = false
  if (gesture?.type === 'pan' && gesture.moved < 7 && event.type === 'pointerup') {
    const target = event.target
    const id = target instanceof Element ? target.closest('.mk')?.getAttribute('data-id') : null
    if (id) {
      openObject(id)
    } else {
      closeSheet()
    }
  }
  if (pointers.size === 0) {
    gesture = null
  }
}

function onWheel(event: WheelEvent) {
  event.preventDefault()
  size()
  const rect = mapEl.value?.getBoundingClientRect()
  const sx = event.clientX - (rect?.left ?? 0)
  const sy = event.clientY - (rect?.top ?? 0)
  const nextScale = Math.max(minS, Math.min(maxS, view.s * Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0018))))
  const applied = nextScale / view.s
  view.s = nextScale
  view.x = sx - (sx - view.x) * applied
  view.y = sy - (sy - view.y) * applied
  clamp()
}

function makeGrain() {
  const size = 220
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) {
    return ''
  }
  const image = context.createImageData(size, size)
  let seed = 11
  const rnd = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < image.data.length; i += 4) {
    const value = rnd()
    const ink = value < 0.5 ? 70 : 255
    image.data[i] = ink
    image.data[i + 1] = ink
    image.data[i + 2] = ink
    image.data[i + 3] = Math.floor(Math.abs(value - 0.5) * 2 * 34)
  }
  context.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}

let removeWheel: (() => void) | null = null

onMounted(() => {
  grainUrl.value = makeGrain()
  try {
    const saved = JSON.parse(localStorage.getItem('k39.forts.quest.v1') || 'null') as { on?: boolean, visited?: Record<string, number> } | null
    if (saved) {
      questOn.value = Boolean(saved.on)
      Object.assign(visited, saved.visited ?? {})
    }
  } catch {
    // Ignore a broken local quest record.
  }
  reset(false)
  const hash = window.location.hash.replace('#', '')
  if (byId.has(hash)) {
    window.setTimeout(() => openObject(hash), 280)
  }
  track('map_open', { routeSlug: 'kaliningrad' })
  const el = mapEl.value
  if (!el) {
    return
  }
  el.addEventListener('wheel', onWheel, { passive: false })
  const onResize = () => reset(false)
  window.addEventListener('resize', onResize)
  removeWheel = () => {
    el.removeEventListener('wheel', onWheel)
    window.removeEventListener('resize', onResize)
  }
})

onBeforeUnmount(() => {
  removeWheel?.()
  cancelAnimationFrame(anim)
  window.clearTimeout(toastTimer)
})
</script>
