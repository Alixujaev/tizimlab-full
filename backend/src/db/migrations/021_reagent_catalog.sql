-- 021_reagent_catalog.sql: reaktiv nomenklaturasi (katalog) — ND talablari va FEFO lotlari uchun kalit (DECISIONS.md D-174)
-- Har bir `reagents` qatori — katalog elementining LOTI (o'z miqdori, birligi, muddati, tasdiq holati).

-- O'lchov birligi oilasi. TS dagi `utils/units.ts#normalizeUnit` bilan bir xil ro'yxat (paritet testi bor).
CREATE OR REPLACE FUNCTION reagent_unit_family(u text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN k IN ('ml', 'мл', 'millilitr', 'milliliter', 'millilitre', 'l', 'л', 'litr', 'liter', 'litre',
               'mkl', 'мкл', 'µl', 'ul') THEN 'volume'
    WHEN k IN ('g', 'г', 'gr', 'gramm', 'gram', 'kg', 'кг', 'kilogramm', 'kilogram',
               'mg', 'мг', 'milligramm', 'milligram') THEN 'mass'
    WHEN k IN ('dona', 'ta', 'шт', 'pcs', 'pc', 'piece') THEN 'count'
    ELSE 'other:' || k
  END
  FROM (SELECT lower(regexp_replace(trim(coalesce(u, '')), '\.$', '')) AS k) s
$$;

-- Ko'rinadigan nom: chetdagi va takroriy probellarsiz.
CREATE OR REPLACE FUNCTION reagent_display_name(n text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(trim(coalesce(n, '')), '\s+', ' ', 'g')
$$;

-- Nom kaliti: kichik harf, chetdagi va takroriy probellarsiz.
CREATE OR REPLACE FUNCTION reagent_name_key(n text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(regexp_replace(trim(coalesce(n, '')), '\s+', ' ', 'g'))
$$;

CREATE TABLE reagent_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  name varchar(255) NOT NULL,
  name_key varchar(255) NOT NULL,
  cas_number varchar(50) NULL,
  unit_family varchar(40) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_reagent_items_company_key UNIQUE (company_id, name_key),
  CONSTRAINT reagent_items_name_check CHECK (length(trim(name)) > 0)
);

CREATE INDEX idx_reagent_items_company ON reagent_items(company_id);

ALTER TABLE reagents ADD COLUMN reagent_item_id uuid NULL REFERENCES reagent_items(id) ON DELETE RESTRICT;

-- Mavjud reaktivlardan katalog: (kompaniya, nom kaliti) bo'yicha bitta element; birinchi uchragan nom va CAS.
INSERT INTO reagent_items (company_id, name, name_key, cas_number, unit_family)
SELECT DISTINCT ON (company_id, reagent_name_key(name))
       company_id, reagent_display_name(name), reagent_name_key(name), cas_number, reagent_unit_family(unit)
FROM reagents
ORDER BY company_id, reagent_name_key(name), created_at;

UPDATE reagents r SET reagent_item_id = i.id
FROM reagent_items i
WHERE i.company_id = r.company_id AND i.name_key = reagent_name_key(r.name);

-- Ilova element berishi mumkin; bermasa (eski oqim, ETL) — nom bo'yicha topiladi yoki yaratiladi.
CREATE OR REPLACE FUNCTION reagents_assign_item() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.reagent_item_id IS NULL THEN
    INSERT INTO reagent_items (company_id, name, name_key, cas_number, unit_family)
    VALUES (NEW.company_id, reagent_display_name(NEW.name), reagent_name_key(NEW.name), NEW.cas_number,
            reagent_unit_family(NEW.unit))
    ON CONFLICT (company_id, name_key) DO NOTHING;
    SELECT id INTO NEW.reagent_item_id FROM reagent_items
    WHERE company_id = NEW.company_id AND name_key = reagent_name_key(NEW.name);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_reagents_assign_item BEFORE INSERT ON reagents
  FOR EACH ROW EXECUTE FUNCTION reagents_assign_item();

ALTER TABLE reagents ALTER COLUMN reagent_item_id SET NOT NULL;

-- FEFO: element bo'yicha muddat tartibida lotlar
CREATE INDEX idx_reagents_item_fefo ON reagents(reagent_item_id, expires_at NULLS LAST, created_at);
