INSERT INTO "regions" ("id", "slug", "title", "description")
VALUES
  ('region-gvardeysk', 'gvardeysk', 'Гвардейск', 'Город Гвардейск (Тапиау) и окрестности.'),
  ('region-guryevsk', 'guryevsk', 'Гурьевск', 'Гурьевск (Нойхаузен), Вальдау и Шаакен.'),
  ('region-bagrationovsk', 'bagrationovsk', 'Багратионовск', 'Багратионовск (Прейсиш-Эйлау) и Балга.'),
  ('region-neman', 'neman', 'Неман', 'Город Неман (Рагнит).'),
  ('region-chernyakhovsk', 'chernyakhovsk', 'Черняховск', 'Город Черняховск (Инстербург).')
ON CONFLICT ("slug") DO NOTHING;

UPDATE "places" AS place
SET "region_id" = region.id, "updated_at" = now()
FROM "regions" AS region
WHERE place.slug = 'zamok-tapiau' AND region.slug = 'gvardeysk';

UPDATE "places" AS place
SET "region_id" = region.id, "updated_at" = now()
FROM "regions" AS region
WHERE place.slug IN ('zamok-shaaken', 'zamok-noihauzen', 'zamok-valdau') AND region.slug = 'guryevsk';

UPDATE "places" AS place
SET "region_id" = region.id, "updated_at" = now()
FROM "regions" AS region
WHERE place.slug IN ('zamok-balga', 'zamok-preisish-eilau') AND region.slug = 'bagrationovsk';

UPDATE "places" AS place
SET "region_id" = region.id, "updated_at" = now()
FROM "regions" AS region
WHERE place.slug = 'zamok-ragnit' AND region.slug = 'neman';

UPDATE "places" AS place
SET "region_id" = region.id, "updated_at" = now()
FROM "regions" AS region
WHERE place.slug = 'zamok-insterburg' AND region.slug = 'chernyakhovsk';
