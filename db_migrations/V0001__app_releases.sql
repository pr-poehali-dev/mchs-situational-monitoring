CREATE TABLE IF NOT EXISTS app_releases (
    id SERIAL PRIMARY KEY,
    version TEXT NOT NULL UNIQUE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    sha256 TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    mandatory BOOLEAN NOT NULL DEFAULT FALSE,
    published BOOLEAN NOT NULL DEFAULT TRUE,
    downloads INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_releases_published ON app_releases(published, created_at DESC);
