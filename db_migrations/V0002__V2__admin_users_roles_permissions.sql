CREATE TABLE t_p17938825_taxi_navigation_app.admin_users (
    id              SERIAL PRIMARY KEY,
    full_name       VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'moderator' CHECK (role IN ('superadmin', 'admin', 'moderator')),
    is_active       BOOLEAN DEFAULT TRUE,
    created_by      INTEGER REFERENCES t_p17938825_taxi_navigation_app.admin_users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ
);

CREATE TABLE t_p17938825_taxi_navigation_app.moderator_permissions (
    id                      SERIAL PRIMARY KEY,
    admin_user_id           INTEGER NOT NULL REFERENCES t_p17938825_taxi_navigation_app.admin_users(id),
    can_view_drivers        BOOLEAN DEFAULT TRUE,
    can_add_drivers         BOOLEAN DEFAULT FALSE,
    can_edit_drivers        BOOLEAN DEFAULT FALSE,
    can_block_drivers       BOOLEAN DEFAULT FALSE,
    can_view_commission     BOOLEAN DEFAULT TRUE,
    can_edit_commission     BOOLEAN DEFAULT FALSE,
    commission_rate_min     NUMERIC(5,2) DEFAULT 0.00,
    commission_rate_max     NUMERIC(5,2) DEFAULT 100.00,
    can_view_controllers    BOOLEAN DEFAULT FALSE,
    can_manage_controllers  BOOLEAN DEFAULT FALSE,
    can_view_transactions   BOOLEAN DEFAULT TRUE,
    can_export_reports      BOOLEAN DEFAULT FALSE,
    can_manage_moderators   BOOLEAN DEFAULT FALSE,
    updated_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_by              INTEGER REFERENCES t_p17938825_taxi_navigation_app.admin_users(id),
    UNIQUE(admin_user_id)
);

CREATE TABLE t_p17938825_taxi_navigation_app.admin_sessions (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES t_p17938825_taxi_navigation_app.admin_users(id),
    token       VARCHAR(255) NOT NULL UNIQUE,
    ip_address  VARCHAR(45),
    user_agent  TEXT,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE t_p17938825_taxi_navigation_app.admin_audit_log (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES t_p17938825_taxi_navigation_app.admin_users(id),
    action      VARCHAR(100) NOT NULL,
    entity      VARCHAR(50),
    entity_id   INTEGER,
    details     TEXT,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO t_p17938825_taxi_navigation_app.admin_users (full_name, email, password_hash, role)
VALUES ('Главный администратор', 'admin@taxigo.ru', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMaVSmEjPZVHFwFhbvVaVe4T5y', 'superadmin');

CREATE INDEX idx_admin_sessions_token ON t_p17938825_taxi_navigation_app.admin_sessions(token);
CREATE INDEX idx_admin_sessions_user  ON t_p17938825_taxi_navigation_app.admin_sessions(user_id);
CREATE INDEX idx_audit_log_user       ON t_p17938825_taxi_navigation_app.admin_audit_log(user_id);
CREATE INDEX idx_audit_log_created    ON t_p17938825_taxi_navigation_app.admin_audit_log(created_at);
