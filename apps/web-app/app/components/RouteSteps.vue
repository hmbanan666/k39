<template>
  <section
    v-if="steps.length"
    class="route"
    :class="variant"
  >
    <div
      v-if="variant === 'feature' && art"
      class="art"
    >
      <img
        :src="art"
        alt=""
        width="640"
        height="400"
      >
    </div>
    <div class="txt">
      <p
        v-if="kicker"
        class="kicker"
      >
        {{ kicker }}
      </p>
      <h2>
        <a
          v-if="href"
          :href="href"
        >{{ title }}</a>
        <template v-else>
          {{ title }}
        </template>
      </h2>
      <p
        v-if="summary"
        class="sub"
      >
        {{ summary }}
      </p>
      <ol class="steps">
        <li
          v-for="(step, index) in steps"
          :key="`${step.href}-${index}`"
          :class="{ cur: step.current }"
        >
          <span class="n">{{ index + 1 }}</span>
          <span class="label">
            <a :href="step.href">{{ step.text }}</a>
            <span
              v-if="step.note"
              class="note"
            >{{ step.note }}</span>
          </span>
        </li>
      </ol>
      <p
        v-if="next || (href && action)"
        class="actions"
      >
        <UiButton
          :href="next ? next.href : href"
          variant="amber"
        >
          {{ next ? 'Следующий шаг' : action }}
        </UiButton>
        <span v-if="next">{{ next.text }}</span>
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  steps: Array<{ href: string, text: string, note?: string | null, current?: boolean }>
  summary?: string
  kicker?: string
  href?: string
  action?: string
  art?: string
  variant?: 'track' | 'feature'
  next?: { href: string, text: string } | null
}>(), {
  summary: '',
  kicker: '',
  href: '',
  action: '',
  art: '',
  variant: 'track',
  next: null,
})
</script>

<style scoped>
.route {
  position: relative;
  margin-top: 3.2rem;
  overflow: hidden;
  padding: 1.6rem 1.15rem 1.4rem;
  border-radius: 18px;
  background-color: var(--color-sea);
  background-image: var(--noise);
  color: #eef2f2;
}
.route::after {
  content: "";
  position: absolute;
  top: -4rem;
  right: -4rem;
  width: 14rem;
  height: 14rem;
  border: 2px dashed rgb(220 229 232 / 25%);
  border-radius: 50%;
  pointer-events: none;
}
.kicker {
  margin: 0 0 0.35rem;
  color: var(--color-amber-soft);
  font-family: var(--font-stamp);
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
h2 {
  margin: 0.35rem 0 0.45rem;
  color: #fff;
  font-size: clamp(1.7rem, 1.2rem + 1.4vw, 2.5rem);
}
h2 a { color: inherit; text-decoration: none; }
h2 a:hover { color: var(--color-amber-soft); }
.sub { max-width: 56ch; margin: 0; color: #c9d6db; }
.steps { position: relative; z-index: 1; margin: 1.4rem 0 0; padding: 0; list-style: none; }
.label { display: block; min-width: 0; }
.steps a {
  display: block;
  color: #fff;
  font-family: var(--font-display);
  font-size: 0.98rem;
  font-weight: 600;
  line-height: 1.3;
  text-decoration: none;
  overflow-wrap: break-word;
}
.note {
  display: block;
  margin-top: 0.15rem;
  color: #c9d6db;
  font-size: 0.82rem;
  line-height: 1.35;
  overflow-wrap: break-word;
}
.n {
  display: grid;
  place-items: center;
  border: 2px solid var(--color-amber-soft);
  border-radius: 50%;
  background: var(--color-sea);
  color: var(--color-amber-soft);
  font-family: var(--font-display);
  font-weight: 700;
}
.cur .n {
  border-color: var(--color-amber);
  background: var(--color-amber);
  color: var(--color-ink);
  box-shadow: 0 0 0 6px rgb(214 138 34 / 25%);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem 1rem;
  align-items: center;
  margin: 1.4rem 0 0;
}
.actions span { color: #c9d6db; font-size: 0.9rem; }
.track .steps {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 9.5rem), 1fr));
  column-gap: 0;
  row-gap: 1.15rem;
}
.track li {
  position: relative;
  min-width: 0;
  padding: 0 0.45rem;
  text-align: center;
}
.track li::before {
  content: "";
  position: absolute;
  z-index: 0;
  top: 21px;
  right: 0;
  left: 0;
  border-top: 2px dashed rgb(246 226 190 / 55%);
}
.track .n {
  position: relative;
  z-index: 1;
  width: 44px;
  height: 44px;
  margin: 0 auto 0.7rem;
  font-size: 1.05rem;
}
.feature {
  display: grid;
  padding: 0;
}
.feature .art {
  position: relative;
  min-height: 14rem;
}
.feature .art img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.feature .txt { padding: 1.5rem 1.2rem 1.4rem; }
.feature .steps { display: grid; gap: 0.7rem; margin-top: 1.1rem; }
.feature li {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  min-width: 0;
}
.feature .label { flex: 1; }
.feature .n {
  flex: none;
  width: 30px;
  height: 30px;
  font-size: 0.9rem;
}
@media (max-width: 720px) {
  .track .steps {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }
  .track .steps::before {
    content: "";
    position: absolute;
    top: 0.4rem;
    right: auto;
    bottom: 0.4rem;
    left: 21px;
    border-top: 0;
    border-left: 2px dashed rgb(246 226 190 / 55%);
  }
  .track li::before { content: none; }
  .track li {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 0.15rem 0.75rem;
    align-items: center;
    padding: 0;
    text-align: left;
  }
  .track .n { margin: 0; }
  .route { border-radius: 14px; }
}
@media (min-width: 800px) {
  .track { padding: 2.4rem 2.6rem; }
}
@media (min-width: 900px) {
  .feature { grid-template-columns: 1.05fr 1fr; }
  .feature .art { min-height: 100%; }
  .feature .txt { padding: 2.6rem 2.4rem; }
}
</style>
