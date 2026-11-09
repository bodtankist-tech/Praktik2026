-- ОКО: дашборд аналітика. Схема БД PostgreSQL.
-- Усі дані в базі синтетичні (навчальні). Скрипт перестворює таблиці з нуля.

DROP VIEW  IF EXISTS v_events;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS units;
DROP TABLE IF EXISTS frontline_points;
DROP TABLE IF EXISTS event_types;
DROP TABLE IF EXISTS directions;
DROP TABLE IF EXISTS regions;

-- Довідник: області (центр для підписів на карті).
CREATE TABLE regions (
    id         SERIAL PRIMARY KEY,
    name       TEXT UNIQUE NOT NULL,
    center_lat DOUBLE PRECISION NOT NULL,
    center_lon DOUBLE PRECISION NOT NULL
);

-- Довідник: умовні операційні напрямки.
CREATE TABLE directions (
    id   SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);

-- Довідник: типи подій і їхні категорії.
CREATE TABLE event_types (
    id       SERIAL PRIMARY KEY,
    name     TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('вогневе ураження', 'наземні дії', 'розвідка', 'РЕБ', 'інше'))
);

-- Підрозділи (свої та противника) з кодом умовного знака APP-6D (SIDC, 20 цифр).
CREATE TABLE units (
    id            SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    affiliation   TEXT NOT NULL CHECK (affiliation IN ('friend', 'hostile', 'neutral', 'unknown')),
    unit_type     TEXT NOT NULL,
    echelon       TEXT NOT NULL,
    sidc          CHAR(20) NOT NULL CHECK (sidc ~ '^[0-9]{20}$'),
    region_id     INT NOT NULL REFERENCES regions(id),
    direction_id  INT REFERENCES directions(id),
    lat           DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN 44 AND 53),
    lon           DOUBLE PRECISION NOT NULL CHECK (lon BETWEEN 22 AND 41),
    strength_pct  INT NOT NULL CHECK (strength_pct BETWEEN 0 AND 100),
    status        TEXT NOT NULL CHECK (status IN ('боєздатний', 'обмежено боєздатний', 'небоєздатний')),
    updated_at    TIMESTAMP NOT NULL
);

-- Події обстановки.
CREATE TABLE events (
    id            SERIAL PRIMARY KEY,
    occurred_at   TIMESTAMP NOT NULL,
    event_type_id INT NOT NULL REFERENCES event_types(id),
    region_id     INT NOT NULL REFERENCES regions(id),
    direction_id  INT REFERENCES directions(id),
    lat           DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN 44 AND 53),
    lon           DOUBLE PRECISION NOT NULL CHECK (lon BETWEEN 22 AND 41),
    intensity     INT NOT NULL CHECK (intensity BETWEEN 1 AND 10),
    unit_id       INT REFERENCES units(id),
    source        TEXT NOT NULL,
    reliability   CHAR(2) NOT NULL CHECK (reliability ~ '^[A-F][1-6]$'),  -- адміралтейська шкала
    summary       TEXT
);

-- Умовна (синтетична) лінія зіткнення для відображення на карті.
CREATE TABLE frontline_points (
    seq INT PRIMARY KEY,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL
);

CREATE INDEX idx_events_occurred_at ON events (occurred_at);
CREATE INDEX idx_events_type        ON events (event_type_id);
CREATE INDEX idx_events_region      ON events (region_id);
CREATE INDEX idx_events_direction   ON events (direction_id);
CREATE INDEX idx_units_affiliation  ON units (affiliation);

-- Плоске представлення подій для API (без JOIN у кожному запиті).
CREATE VIEW v_events AS
SELECT e.id, e.occurred_at, t.name AS event_type, t.category,
       r.name AS region, d.name AS direction,
       e.lat, e.lon, e.intensity, e.unit_id, u.name AS unit_name,
       e.source, e.reliability, e.summary
FROM events e
JOIN event_types t ON t.id = e.event_type_id
JOIN regions r     ON r.id = e.region_id
LEFT JOIN directions d ON d.id = e.direction_id
LEFT JOIN units u      ON u.id = e.unit_id;
