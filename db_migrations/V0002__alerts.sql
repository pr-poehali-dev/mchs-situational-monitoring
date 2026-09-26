-- Оповещение личного состава при авариях

CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    accident_type TEXT NOT NULL,
    accident_label TEXT NOT NULL,
    opo TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    started_at TEXT NOT NULL DEFAULT '',
    declared_by TEXT NOT NULL DEFAULT '',
    channels TEXT NOT NULL DEFAULT '',
    total_recipients INTEGER NOT NULL DEFAULT 0,
    confirmed_count INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS alert_recipients (
    id SERIAL PRIMARY KEY,
    alert_id INTEGER NOT NULL REFERENCES alerts(id),
    person_id TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    rank TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    token TEXT NOT NULL,
    sms_status TEXT NOT NULL DEFAULT 'pending',
    sms_error TEXT NOT NULL DEFAULT '',
    call_status TEXT NOT NULL DEFAULT 'pending',
    call_error TEXT NOT NULL DEFAULT '',
    confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    confirmed_at TIMESTAMPTZ,
    confirmed_via TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_recipients_token ON alert_recipients(token);
CREATE INDEX IF NOT EXISTS idx_alert_recipients_alert ON alert_recipients(alert_id);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(active, created_at DESC);
