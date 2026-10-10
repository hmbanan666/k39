<template>
  <ArticleShell
    h1="Политика конфиденциальности"
    :crumbs="crumbs"
  >
    <p>Последняя редакция: 10 октября 2026.</p>
    <p>Сайт k39.online рассказывает о местах Калининградской области. Оператор: индивидуальный предприниматель Косарев Николай Николаевич, ИНН 110111889708, адрес: г. Светлогорск, ул. Пригородная, д. 1, кв. 23, email: nick@kosarev.space.</p>
    <h2>Что мы храним</h2>
    <ol>
      <li>Если вы входите через Яндекс или ВКонтакте, мы сохраняем адрес почты и имя из профиля.</li>
      <li>Если вы разрешили аналитику, мы записываем тип действия, место или квест, время и случайный идентификатор сессии. IP-адрес в эту таблицу не пишется.</li>
      <li>Технические cookie входа нужны, чтобы оставаться авторизованным.</li>
    </ol>
    <h2>Ваши права</h2>
    <p>Напишите на nick@kosarev.space, если нужно показать, исправить или удалить данные. Кнопка «Не записывать» на баннере отключает события в этом браузере.</p>
  </ArticleShell>
</template>

<script setup lang="ts">
import { breadcrumbNode, metaDescription, pageTitle } from '~~/shared/seo'

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
  ogImage: { url: 'https://k39.online/favicon.png', width: 120, height: 120, alt: 'K39' },
  jsonLd: [breadcrumbNode(crumbs)],
}
usePublicHead(doc)
</script>
