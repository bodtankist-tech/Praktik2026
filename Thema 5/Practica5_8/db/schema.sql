-- Рубіж-Монітор: схема БД (одна таблиця incidents).
-- Скрипт можна запускати повторно: наявні таблиця та індекси не перестворюються.

CREATE TABLE IF NOT EXISTS incidents (
    id          SERIAL PRIMARY KEY,
    occurred_at TIMESTAMP NOT NULL,
    sector      TEXT      NOT NULL,
    direction   TEXT      NOT NULL,
    event_type  TEXT      NOT NULL,
    intensity   INT       NOT NULL CHECK (intensity BETWEEN 1 AND 50),
    source      TEXT,
    summary     TEXT
);

CREATE INDEX IF NOT EXISTS idx_incidents_occurred_at ON incidents (occurred_at);
CREATE INDEX IF NOT EXISTS idx_incidents_sector      ON incidents (sector);
CREATE INDEX IF NOT EXISTS idx_incidents_direction   ON incidents (direction);
CREATE INDEX IF NOT EXISTS idx_incidents_event_type  ON incidents (event_type);
