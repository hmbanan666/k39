<template>
  <ArticleShell
    h1="Политика конфиденциальности"
    :crumbs="crumbs"
  >
    <p>Последняя редакция: 12 октября 2026.</p>
    <p>Сайт k39.online рассказывает о местах Калининградской области. Оператор: индивидуальный предприниматель Косарев Николай Николаевич, ИНН 110111889708, адрес: г. Светлогорск, ул. Пригородная, д. 1, кв. 23, email: nick@kosarev.space.</p>
    <UiAccordion
      :default-value="['store', 'rights']"
      :items="sections"
    />
  </ArticleShell>
</template>

<script setup lang="ts">
import { breadcrumbNode, DEFAULT_OG_IMAGE, metaDescription, pageTitle } from '~~/shared/seo'

const sections = [
  {
    value: 'store',
    title: 'Что мы храним',
    html: '<ol><li>Если вы входите через Яндекс или ВКонтакте, мы сохраняем адрес почты и имя из профиля.</li><li>Просмотры страниц пишутся в нашу базу. IP-адрес не хранится. Если вы нажали «Разрешить», в браузере остаётся случайный cookie. Если нет, идентификатор на сутки считается из соли, IP и браузера и в базу попадает только этот хеш.</li><li>Технические cookie входа нужны, чтобы оставаться авторизованным.</li></ol>',
  },
  {
    value: 'rights',
    title: 'Ваши права',
    html: '<p>Напишите на nick@kosarev.space, если нужно показать, исправить или удалить данные. Кнопка «Не записывать» не ставит аналитический cookie. Суточный обезличенный счётчик при этом остаётся.</p>',
  },
]
const crumbs = [
  { name: 'Главная', href: '/' },
  { name: 'Политика конфиденциальности', href: '/legal/privacy-policy' },
]
const doc = {
  title: pageTitle('Политика конфиденциальности', 'данные сайта'),
  description: metaDescription('Как K39 обрабатывает данные аккаунта и обезличенные события.'),
  canonical: 'https://k39.online/legal/privacy-policy',
  robots: 'index, follow',
  h1: 'Политика конфиденциальности',
  crumbs,
  ogImage: DEFAULT_OG_IMAGE,
  jsonLd: [breadcrumbNode(crumbs)],
}
usePublicHead(doc)
</script>
