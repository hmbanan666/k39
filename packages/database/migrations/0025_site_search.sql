CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TABLE "search_events" (
	"id" varchar PRIMARY KEY NOT NULL,
	"occurred_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"search_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"visitor_key" varchar NOT NULL,
	"session_key" varchar,
	"is_bot" boolean DEFAULT false NOT NULL,
	"surface" varchar,
	"query" text,
	"normalized" text,
	"result_count" integer,
	"refined_from" varchar,
	"position" integer,
	"result_path" varchar,
	CONSTRAINT "search_events_type_check" CHECK ("event_type" in ('search', 'click'))
);--> statement-breakpoint
CREATE INDEX "search_events_occurred_idx" ON "search_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "search_events_search_idx" ON "search_events" USING btree ("search_id");--> statement-breakpoint
CREATE INDEX "search_events_session_idx" ON "search_events" USING btree ("session_key","occurred_at");--> statement-breakpoint
CREATE INDEX "search_events_normalized_idx" ON "search_events" USING btree ("normalized","occurred_at");--> statement-breakpoint
-- Public catalog for site search (ADR 0030). A view, so unpublishing a page
-- removes it from search with no sync job. Weights: A title, B taxonomy,
-- C summary, D body. Text is folded from ё to е to match normalized queries.
CREATE VIEW "search_documents" AS
SELECT 'place'::text AS kind, p.id, '/' || p.slug AS path, p.title,
	coalesce(c.title, '') AS label, coalesce(r.short_title, r.title, '') AS region, p.summary AS snippet, 0::real AS boost,
	setweight(to_tsvector('russian', translate(p.title, 'ёЁ', 'еЕ')), 'A')
	|| setweight(to_tsvector('russian', translate(concat_ws(' ', c.title, r.title, r.short_title), 'ёЁ', 'еЕ')), 'B')
	|| setweight(to_tsvector('russian', translate(p.summary, 'ёЁ', 'еЕ')), 'C')
	|| setweight(to_tsvector('russian', translate(left(p.body, 20000), 'ёЁ', 'еЕ')), 'D') AS doc
FROM places p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN regions r ON r.id = p.region_id
WHERE p.publication_status = 'published' AND p.noindex = false
UNION ALL
SELECT 'route', ro.id, '/marshruty/' || ro.slug, ro.title, 'Маршрут', coalesce(r.short_title, r.title, ''), coalesce(ro.summary, ''), 0.1,
	setweight(to_tsvector('russian', translate(ro.title, 'ёЁ', 'еЕ')), 'A')
	|| setweight(to_tsvector('russian', translate(concat_ws(' ', r.title, r.short_title), 'ёЁ', 'еЕ')), 'B')
	|| setweight(to_tsvector('russian', translate(coalesce(ro.summary, ''), 'ёЁ', 'еЕ')), 'C')
	|| setweight(to_tsvector('russian', translate(left(ro.body, 20000), 'ёЁ', 'еЕ')), 'D')
FROM routes ro
LEFT JOIN regions r ON r.id = ro.region_id
WHERE ro.publication_status = 'published' AND ro.noindex = false
UNION ALL
SELECT 'collection', co.id, '/podborki/' || co.slug, co.title, 'Подборка', '', coalesce(co.summary, ''), 0.1,
	setweight(to_tsvector('russian', translate(co.title, 'ёЁ', 'еЕ')), 'A')
	|| setweight(to_tsvector('russian', translate(coalesce(co.summary, ''), 'ёЁ', 'еЕ')), 'C')
	|| setweight(to_tsvector('russian', translate(left(co.body, 20000), 'ёЁ', 'еЕ')), 'D')
FROM collections co
WHERE co.publication_status = 'published' AND co.noindex = false
UNION ALL
SELECT 'quest', q.id, '/kvesty/' || q.slug, q.title, 'Квест', '', coalesce(q.summary, ''), 0,
	setweight(to_tsvector('russian', translate(q.title, 'ёЁ', 'еЕ')), 'A')
	|| setweight(to_tsvector('russian', translate(coalesce(q.summary, ''), 'ёЁ', 'еЕ')), 'C')
	|| setweight(to_tsvector('russian', translate(left(q.body, 20000), 'ёЁ', 'еЕ')), 'D')
FROM quests q
WHERE q.publication_status = 'published' AND q.noindex = false
UNION ALL
SELECT 'venue', v.id, '/zavedeniya/' || v.slug, v.name,
	CASE v.kind WHEN 'cafe' THEN 'Кафе' WHEN 'restaurant' THEN 'Ресторан' WHEN 'coffee' THEN 'Кофейня' WHEN 'bar' THEN 'Бар'
		WHEN 'bakery' THEN 'Пекарня' WHEN 'market' THEN 'Рынок' WHEN 'fastfood' THEN 'Фастфуд' ELSE 'Заведение' END,
	coalesce(r.short_title, r.title, ''), v.description, 0,
	setweight(to_tsvector('russian', translate(v.name, 'ёЁ', 'еЕ')), 'A')
	|| setweight(to_tsvector('russian', translate(concat_ws(' ',
		CASE v.kind WHEN 'cafe' THEN 'кафе' WHEN 'restaurant' THEN 'ресторан' WHEN 'coffee' THEN 'кофейня кофе' WHEN 'bar' THEN 'бар'
			WHEN 'bakery' THEN 'пекарня выпечка' WHEN 'market' THEN 'рынок' WHEN 'fastfood' THEN 'фастфуд' ELSE '' END,
		(SELECT string_agg(t, ' ') FROM jsonb_array_elements_text(v.cuisine_tags) t), r.title, r.short_title), 'ёЁ', 'еЕ')), 'B')
	|| setweight(to_tsvector('russian', translate(v.description, 'ёЁ', 'еЕ')), 'C')
	|| setweight(to_tsvector('russian', translate(concat_ws(' ', v.address,
		(SELECT string_agg(d->>'name', ' ') FROM jsonb_array_elements(v.signature_dishes) d)), 'ёЁ', 'еЕ')), 'D')
FROM venues v
LEFT JOIN regions r ON r.id = v.region_id
WHERE v.status = 'published' AND v.noindex = false
UNION ALL
SELECT 'hub', c.id, '/' || c.slug, c.title, 'Раздел', '', c.description, 0.3,
	setweight(to_tsvector('russian', translate(c.title, 'ёЁ', 'еЕ')), 'A')
	|| setweight(to_tsvector('russian', translate(c.description, 'ёЁ', 'еЕ')), 'C')
	|| setweight(to_tsvector('russian', translate(left(c.body, 20000), 'ёЁ', 'еЕ')), 'D')
FROM categories c
WHERE c.noindex = false
UNION ALL
SELECT 'city', r.id, '/gde-poest-seychas/' || r.slug, coalesce(r.short_title, r.title), 'Город', '', coalesce(r.description, ''), 0.2,
	setweight(to_tsvector('russian', translate(concat_ws(' ', r.short_title, r.title), 'ёЁ', 'еЕ')), 'A')
	|| setweight(to_tsvector('russian', translate(coalesce(r.description, ''), 'ёЁ', 'еЕ')), 'C')
FROM regions r
WHERE EXISTS (SELECT 1 FROM venues v WHERE v.region_id = r.id AND v.status = 'published' AND v.noindex = false);
