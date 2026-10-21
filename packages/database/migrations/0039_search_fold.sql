-- Fold indexed text the same way as normalizeSearchQuery.
-- to_tsvector('russian') keeps a combining mark inside the lexeme, so a
-- decomposed title does not match the composed query. NFC composes й and ё.
-- Marks that do not compose (a stress accent) are deleted.
-- This server's regex rejects \p{M}, so the deleted set is the combining
-- diacritics block plus the Cyrillic combining marks.
CREATE OR REPLACE FUNCTION search_fold(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN input IS NULL THEN NULL
    ELSE translate(
      translate(lower(normalize(input, NFC)), U&'\0300\0301\0302\0303\0304\0305\0306\0307\0308\0309\030a\030b\030c\030d\030e\030f\0310\0311\0312\0313\0314\0315\0316\0317\0318\0319\031a\031b\031c\031d\031e\031f\0320\0321\0322\0323\0324\0325\0326\0327\0328\0329\032a\032b\032c\032d\032e\032f\0330\0331\0332\0333\0334\0335\0336\0337\0338\0339\033a\033b\033c\033d\033e\033f\0340\0341\0342\0343\0344\0345\0346\0347\0348\0349\034a\034b\034c\034d\034e\034f\0350\0351\0352\0353\0354\0355\0356\0357\0358\0359\035a\035b\035c\035d\035e\035f\0360\0361\0362\0363\0364\0365\0366\0367\0368\0369\036a\036b\036c\036d\036e\036f\0483\0484\0485\0486\0487\0488\0489', ''),
      'ёЁ',
      'еЕ'
    )
  END;
$$;
--> statement-breakpoint
-- Same columns as 0029. Only the tsvector inputs go through search_fold.
CREATE OR REPLACE VIEW "search_documents" AS
SELECT 'place'::text AS kind, p.id, '/' || p.slug AS path, p.title,
	coalesce(c.title, '') AS label, coalesce(r.short_title, r.title, '') AS region, p.summary AS snippet, 0::real AS boost,
	setweight(to_tsvector('russian', search_fold(p.title)), 'A')
	|| setweight(to_tsvector('russian', search_fold(concat_ws(' ', c.title, r.title, r.short_title))), 'B')
	|| setweight(to_tsvector('russian', search_fold(p.summary)), 'C')
	|| setweight(to_tsvector('russian', search_fold(left(p.body, 20000))), 'D') AS doc
FROM places p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN regions r ON r.id = p.region_id
WHERE p.publication_status = 'published' AND p.noindex = false
UNION ALL
SELECT 'route', ro.id, '/marshruty/' || ro.slug, ro.title, 'Маршрут', coalesce(r.short_title, r.title, ''), coalesce(ro.summary, ''), 0.1,
	setweight(to_tsvector('russian', search_fold(ro.title)), 'A')
	|| setweight(to_tsvector('russian', search_fold(concat_ws(' ', r.title, r.short_title))), 'B')
	|| setweight(to_tsvector('russian', search_fold(coalesce(ro.summary, ''))), 'C')
	|| setweight(to_tsvector('russian', search_fold(left(ro.body, 20000))), 'D')
FROM routes ro
LEFT JOIN regions r ON r.id = ro.region_id
WHERE ro.publication_status = 'published' AND ro.noindex = false
UNION ALL
SELECT 'collection', co.id, '/podborki/' || co.slug, co.title, 'Подборка', '', coalesce(co.summary, ''), 0.1,
	setweight(to_tsvector('russian', search_fold(co.title)), 'A')
	|| setweight(to_tsvector('russian', search_fold(coalesce(co.summary, ''))), 'C')
	|| setweight(to_tsvector('russian', search_fold(left(co.body, 20000))), 'D')
FROM collections co
WHERE co.publication_status = 'published' AND co.noindex = false
UNION ALL
SELECT 'quest', q.id, '/kvesty/' || q.slug, q.title, 'Квест', '', coalesce(q.summary, ''), 0,
	setweight(to_tsvector('russian', search_fold(q.title)), 'A')
	|| setweight(to_tsvector('russian', search_fold(coalesce(q.summary, ''))), 'C')
	|| setweight(to_tsvector('russian', search_fold(left(q.body, 20000))), 'D')
FROM quests q
WHERE q.publication_status = 'published' AND q.noindex = false
UNION ALL
SELECT 'venue', v.id, '/zavedeniya/' || v.slug, v.name,
	CASE v.kind WHEN 'cafe' THEN 'Кафе' WHEN 'restaurant' THEN 'Ресторан' WHEN 'coffee' THEN 'Кофейня' WHEN 'bar' THEN 'Бар'
		WHEN 'bakery' THEN 'Пекарня' WHEN 'market' THEN 'Рынок' WHEN 'fastfood' THEN 'Фастфуд' ELSE 'Заведение' END,
	coalesce(r.short_title, r.title, ''), v.description, 0,
	setweight(to_tsvector('russian', search_fold(v.name)), 'A')
	|| setweight(to_tsvector('russian', search_fold(concat_ws(' ',
		CASE v.kind WHEN 'cafe' THEN 'кафе' WHEN 'restaurant' THEN 'ресторан' WHEN 'coffee' THEN 'кофейня кофе' WHEN 'bar' THEN 'бар'
			WHEN 'bakery' THEN 'пекарня выпечка' WHEN 'market' THEN 'рынок' WHEN 'fastfood' THEN 'фастфуд' ELSE '' END,
		(SELECT string_agg(t, ' ') FROM jsonb_array_elements_text(v.cuisine_tags) t), r.title, r.short_title))), 'B')
	|| setweight(to_tsvector('russian', search_fold(v.description)), 'C')
	|| setweight(to_tsvector('russian', search_fold(concat_ws(' ', v.address,
		(SELECT string_agg(d->>'name', ' ') FROM jsonb_array_elements(v.signature_dishes) d),
		(SELECT string_agg(concat_ws(' ', d->>'name', d->>'description', d->>'note'), ' ')
			FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v.modules) = 'array' THEN v.modules ELSE '[]'::jsonb END) m
			CROSS JOIN LATERAL jsonb_array_elements(
				CASE WHEN m->>'type' = 'dishes' AND jsonb_typeof(m->'items') = 'array' THEN m->'items' ELSE '[]'::jsonb END
			) d)
	))), 'D')
FROM venues v
LEFT JOIN regions r ON r.id = v.region_id
WHERE v.status = 'published' AND v.noindex = false
UNION ALL
SELECT 'hub', c.id, '/' || c.slug, c.title, 'Раздел', '', c.description, 0.3,
	setweight(to_tsvector('russian', search_fold(c.title)), 'A')
	|| setweight(to_tsvector('russian', search_fold(c.description)), 'C')
	|| setweight(to_tsvector('russian', search_fold(left(c.body, 20000))), 'D')
FROM categories c
WHERE c.noindex = false
UNION ALL
SELECT 'city', r.id, '/gde-poest-seychas/' || r.slug, coalesce(r.short_title, r.title), 'Город', '', coalesce(r.description, ''), 0.2,
	setweight(to_tsvector('russian', search_fold(concat_ws(' ', r.short_title, r.title))), 'A')
	|| setweight(to_tsvector('russian', search_fold(coalesce(r.description, ''))), 'C')
FROM regions r
WHERE EXISTS (SELECT 1 FROM venues v WHERE v.region_id = r.id AND v.status = 'published' AND v.noindex = false);
