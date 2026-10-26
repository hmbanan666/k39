import type { TrustCounts } from './facts'
import type { PageKind } from './scoring'
import { writingAdvisoryMessage } from './writing'

// Client-safe score presentation. Fact hashes and score calculation stay in their modules.

export function trustText(trust: TrustCounts) {
  if (trust.verified) {
    return 'проверено'
  }
  const parts: string[] = []
  if (trust.staleFacts > 0) {
    parts.push(`${trust.staleFacts} ${trust.staleFacts === 1 ? 'устарел' : 'устарели'}`)
  }
  if (trust.unreviewed > 0) {
    parts.push(`${trust.unreviewed} ${sectionWord(trust.unreviewed)}`)
  }
  return parts.join(', ')
}

function sectionWord(count: number) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) {
    return 'раздел'
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return 'раздела'
  }
  return 'разделов'
}

export function issueLabel(check: string) {
  const rules: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/^no FAQ$/, () => 'Нет частых вопросов'],
    [/^FAQ (\d+), need 6$/, (match) => `Частых вопросов: ${match[1]}, нужно 6`],
    [/^no prices$/, () => 'Нет цен или режима'],
    [/^price text conflicts$/, () => 'Цена в тексте спорит с таблицей билетов'],
    [/^no Как добраться$/, () => 'Нет блока «Как добраться»'],
    [/^0 photos$/, () => 'Нет фотографий'],
    [/^(\d+) photos?, need (\d+)$/, (match) => `Фотографий: ${match[1]}, нужно ${match[2]}`],
    [/^stale facts$/, () => 'Устаревшие факты'],
    [/^schedule needs check$/, () => 'Режим работы требует проверки'],
    [/^facts need review$/, () => 'Факты требуют проверки'],
    [/^facts not checked$/, () => 'Факты не проверены'],
    [/^facts checked (\d+) days ago$/, (match) => `Факты проверены ${match[1]} дн. назад`],
    [/^passport empty$/, () => 'Паспорт пустой'],
    [/^no target queries$/, () => 'Нет целевых запросов'],
    [/^no audience$/, () => 'Нет аудитории'],
    [/^no action$/, () => 'Нет действия'],
    [/^no 30-day goal$/, () => 'Нет цели на 30 дней'],
    [/^no 90-day goal$/, () => 'Нет цели на 90 дней'],
    [/^orphan$/, () => 'Нет входящих ссылок'],
    [/^no inbound$/, () => 'Нет входящих ссылок'],
    [/^inbound (\d+)$/, (match) => `Входящих ссылок: ${match[1]}`],
    [/^no outbound$/, () => 'Нет исходящих ссылок'],
    [/^outbound (\d+)$/, (match) => `Исходящих ссылок: ${match[1]}`],
    [/^not in a route or collection$/, () => 'Нет в маршруте или подборке'],
    [/^no stops$/, () => 'Нет точек маршрута'],
    [/^few stops$/, () => 'Мало точек маршрута'],
    [/^no items$/, () => 'Нет мест в подборке'],
    [/^few items$/, () => 'Мало мест в подборке'],
    [/^description missing$/, () => 'Нет описания'],
    [/^description (\d+) chars, need 300-600$/, (match) => `Описание ${match[1]} знаков, нужно 300-600`],
    [/^no hours$/, () => 'Нет часов работы'],
    [/^no coordinates$/, () => 'Нет координат'],
    [/^no steps$/, () => 'Нет шагов квеста'],
    [/^few steps$/, () => 'Мало шагов квеста'],
    [/^empty hub$/, () => 'В разделе нет мест'],
    [/^not in sitemap$/, () => 'Нет в карте сайта'],
    [/^not 200$/, () => 'Страница не открывается'],
    [/^noindex$/, () => 'Закрыта от индекса'],
    [/^no [A-Za-z]+$/, (match) => `Нет JSON-LD: ${match[0].slice(3)}`],
    [/^title (\d+) chars$/, (match) => `Заголовок ${match[1]} знаков`],
    [/^description (\d+) chars$/, (match) => `Описание ${match[1]} знаков`],
    [/^no canonical$/, () => 'Нет канонического адреса'],
    [/^canonical (.+)$/, () => 'Канонический адрес не совпадает'],
    [/^not in Yandex$/, () => 'Нет в индексе Яндекса'],
    [/^not in Google$/, () => 'Нет в индексе Google'],
    [/^goal pending \((\d+) days\)$/, (match) => `Цель ещё не оценивается (${match[1]} дн.)`],
    [/^goal pending \(not indexable\)$/, () => 'Цель не оценивается: страница закрыта от индекса'],
    [/^goal pending \(unpublished\)$/, () => 'Цель не оценивается: страница не опубликована'],
    [
      /^status warning: closure may refer to another subject$/,
      () => 'Фраза про закрытие может относиться к другому месту',
    ],
    [
      /^status warning: appointment wording needs context review$/,
      () => 'Упомянута запись: проверьте контекст и условия посещения',
    ],
    [
      /^status warning: appointment instructions need editorial review$/,
      () => 'Проверьте, понятны ли условия записи в тексте',
    ],
    [/^writing advisory: (.+)$/, (match) => writingAdvisoryMessage({ match: match[1]! })],
    [/^organic 30d: (\d+), goal (\d+)$/, (match) => `Поиск за 30 дней: ${match[1]}, цель ${match[2]}`],
    [/^organic 90d: (\d+), goal (\d+)$/, (match) => `Поиск за 90 дней: ${match[1]}, цель ${match[2]}`],
    [/^no search queries$/, () => 'Нет поисковых запросов'],
    [/^scroll not tracked$/, () => 'Прокрутка не измеряется'],
    [/^scroll (\d+)$/, (match) => `Прокрутка ${match[1]}%`],
    [/^engaged time not tracked$/, () => 'Время на странице не измеряется'],
    [/^engaged (\d+)s$/, (match) => `Вовлечение ${match[1]} с`],
    [/^no clicks to the next page$/, () => 'Нет переходов дальше'],
    [/^body (\d+) chars, need (.+)$/, (match) => `Текст ${match[1]} знаков, нужно ${match[2]}`],
    [/^body (\d+) chars, above (\d+)$/, (match) => `Текст ${match[1]} знаков, больше ${match[2]}`],
    [/^length override ignored$/, () => 'Расширение длины не засчитано'],
    [/^length override: no impressions after 60 days$/, () => 'Расширенный текст без показов 60 дней'],
    [/^repeated section: (.+)$/, (match) => `Повтор раздела: ${match[1]}`],
    [/^repeated paragraph$/, () => 'Повтор абзаца'],
    [/^stop-list: (.+)$/, (match) => `Стоп-лист: ${match[1]}`],
  ]
  for (const [pattern, label] of rules) {
    const match = check.match(pattern)
    if (match) {
      return label(match)
    }
  }
  return check
}

const PAGE_TITLE: Record<PageKind, string> = {
  place: 'место',
  route: 'маршрут',
  collection: 'подборка',
  hub: 'раздел',
  quest: 'квест',
  venue: 'заведение',
}

export function pageKindLabel(kind: PageKind) {
  return PAGE_TITLE[kind]
}
