CREATE TABLE t_p17938825_taxi_navigation_app.controllers (
    id              SERIAL PRIMARY KEY,
    full_name       VARCHAR(255) NOT NULL,
    phone           VARCHAR(20) UNIQUE,
    email           VARCHAR(255) UNIQUE,
    company_name    VARCHAR(255),
    platform_share  NUMERIC(5,2) DEFAULT 100.00 CHECK (platform_share >= 0 AND platform_share <= 100),
    status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE t_p17938825_taxi_navigation_app.drivers (
    id                  SERIAL PRIMARY KEY,
    full_name           VARCHAR(255) NOT NULL,
    phone               VARCHAR(20) NOT NULL UNIQUE,
    email               VARCHAR(255) UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    license_number      VARCHAR(50) NOT NULL UNIQUE,
    vehicle_make        VARCHAR(100),
    vehicle_model       VARCHAR(100),
    vehicle_year        SMALLINT,
    vehicle_plate       VARCHAR(20) UNIQUE,
    vehicle_color       VARCHAR(50),
    vehicle_class       VARCHAR(20) DEFAULT 'economy' CHECK (vehicle_class IN ('economy', 'comfort', 'business', 'minivan')),
    status              VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'blocked')),
    is_online           BOOLEAN DEFAULT FALSE,
    commission_rate     NUMERIC(5,2) NOT NULL DEFAULT 15.00 CHECK (commission_rate >= 0 AND commission_rate <= 100),
    commission_type     VARCHAR(20) DEFAULT 'percent' CHECK (commission_type IN ('percent', 'fixed_per_ride', 'mixed')),
    fixed_fee_per_ride  NUMERIC(10,2) DEFAULT 0.00,
    controller_id       INTEGER REFERENCES t_p17938825_taxi_navigation_app.controllers(id),
    controller_note     TEXT,
    balance             NUMERIC(12,2) DEFAULT 0.00,
    total_rides         INTEGER DEFAULT 0,
    total_earned        NUMERIC(12,2) DEFAULT 0.00,
    total_commission    NUMERIC(12,2) DEFAULT 0.00,
    rating              NUMERIC(3,2) DEFAULT 5.00 CHECK (rating >= 1 AND rating <= 5),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at        TIMESTAMPTZ
);

CREATE TABLE t_p17938825_taxi_navigation_app.commission_history (
    id              SERIAL PRIMARY KEY,
    driver_id       INTEGER NOT NULL REFERENCES t_p17938825_taxi_navigation_app.drivers(id),
    changed_by      INTEGER,
    old_rate        NUMERIC(5,2),
    new_rate        NUMERIC(5,2),
    old_type        VARCHAR(20),
    new_type        VARCHAR(20),
    reason          TEXT,
    changed_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE t_p17938825_taxi_navigation_app.ride_transactions (
    id              SERIAL PRIMARY KEY,
    driver_id       INTEGER NOT NULL REFERENCES t_p17938825_taxi_navigation_app.drivers(id),
    ride_amount     NUMERIC(10,2) NOT NULL,
    commission_rate NUMERIC(5,2) NOT NULL,
    commission_amt  NUMERIC(10,2) NOT NULL,
    driver_income   NUMERIC(10,2) NOT NULL,
    controller_id   INTEGER REFERENCES t_p17938825_taxi_navigation_app.controllers(id),
    status          VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled', 'disputed')),
    ride_date       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_drivers_status     ON t_p17938825_taxi_navigation_app.drivers(status);
CREATE INDEX idx_drivers_controller ON t_p17938825_taxi_navigation_app.drivers(controller_id);
CREATE INDEX idx_rides_driver       ON t_p17938825_taxi_navigation_app.ride_transactions(driver_id);
CREATE INDEX idx_rides_date         ON t_p17938825_taxi_navigation_app.ride_transactions(ride_date);
