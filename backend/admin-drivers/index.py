"""
CRUD водителей с проверкой прав доступа (admin/moderator).
Поддерживает фильтрацию, изменение комиссии и статуса.
"""
import json
import os
import hashlib
import secrets
from datetime import datetime, timezone
import psycopg2


SCHEMA = "t_p17938825_taxi_navigation_app"


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
    }


def json_resp(data, status=200):
    return {"statusCode": status, "headers": {**cors_headers(), "Content-Type": "application/json"}, "body": json.dumps(data, ensure_ascii=False, default=str)}


def get_user(token: str, conn):
    if not token:
        return None
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT u.id, u.full_name, u.role, u.is_active, s.expires_at
            FROM {SCHEMA}.admin_sessions s
            JOIN {SCHEMA}.admin_users u ON u.id = s.user_id
            WHERE s.token = %s
        """, (token,))
        row = cur.fetchone()
    if not row:
        return None
    user_id, full_name, role, is_active, expires_at = row
    if not is_active or expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return None

    perms = {"full": True} if role in ("superadmin", "admin") else None
    if role == "moderator":
        with conn.cursor() as cur:
            cur.execute(f"""
                SELECT can_view_drivers, can_add_drivers, can_edit_drivers, can_block_drivers,
                       can_view_commission, can_edit_commission, commission_rate_min, commission_rate_max
                FROM {SCHEMA}.moderator_permissions WHERE admin_user_id = %s
            """, (user_id,))
            p = cur.fetchone()
        if p:
            perms = {
                "can_view_drivers": p[0], "can_add_drivers": p[1],
                "can_edit_drivers": p[2], "can_block_drivers": p[3],
                "can_view_commission": p[4], "can_edit_commission": p[5],
                "commission_rate_min": float(p[6]), "commission_rate_max": float(p[7]),
            }
    return {"id": user_id, "full_name": full_name, "role": role, "permissions": perms}


def can(user, perm):
    if not user:
        return False
    p = user.get("permissions") or {}
    if p.get("full"):
        return True
    return p.get(perm, False)


def audit(conn, user_id, action, entity, entity_id, details):
    with conn.cursor() as cur:
        cur.execute(f"""
            INSERT INTO {SCHEMA}.admin_audit_log (user_id, action, entity, entity_id, details)
            VALUES (%s, %s, %s, %s, %s)
        """, (user_id, action, entity, entity_id, details))


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers(), "body": ""}

    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    params = event.get("queryStringParameters") or {}
    body = json.loads(event.get("body") or "{}")
    auth = event.get("headers", {}).get("X-Authorization", "")
    token = auth.replace("Bearer ", "").strip()

    conn = get_conn()
    try:
        user = get_user(token, conn)
        if not user:
            return json_resp({"error": "Не авторизован"}, 401)

        # GET /  — список водителей
        if method == "GET" and (path.endswith("/admin-drivers") or path.endswith("/admin-drivers/")):
            if not can(user, "can_view_drivers"):
                return json_resp({"error": "Нет доступа"}, 403)

            status_filter = params.get("status", "")
            search = params.get("search", "")
            page = int(params.get("page", 1))
            per_page = 20
            offset = (page - 1) * per_page

            where = ["1=1"]
            args = []
            if status_filter:
                where.append("d.status = %s")
                args.append(status_filter)
            if search:
                where.append("(d.full_name ILIKE %s OR d.phone ILIKE %s OR d.vehicle_plate ILIKE %s)")
                args += [f"%{search}%", f"%{search}%", f"%{search}%"]

            where_sql = " AND ".join(where)

            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT COUNT(*) FROM {SCHEMA}.drivers d WHERE {where_sql}
                """, args)
                total = cur.fetchone()[0]

                cur.execute(f"""
                    SELECT d.id, d.full_name, d.phone, d.vehicle_class, d.vehicle_plate,
                           d.vehicle_make, d.vehicle_model, d.status, d.is_online,
                           d.commission_rate, d.commission_type, d.fixed_fee_per_ride,
                           d.balance, d.total_rides, d.total_earned, d.total_commission,
                           d.rating, d.created_at,
                           c.full_name as controller_name
                    FROM {SCHEMA}.drivers d
                    LEFT JOIN {SCHEMA}.controllers c ON c.id = d.controller_id
                    WHERE {where_sql}
                    ORDER BY d.created_at DESC
                    LIMIT %s OFFSET %s
                """, args + [per_page, offset])
                rows = cur.fetchall()

            cols = ["id","full_name","phone","vehicle_class","vehicle_plate","vehicle_make","vehicle_model",
                    "status","is_online","commission_rate","commission_type","fixed_fee_per_ride",
                    "balance","total_rides","total_earned","total_commission","rating","created_at","controller_name"]
            drivers = [dict(zip(cols, r)) for r in rows]

            return json_resp({"drivers": drivers, "total": total, "page": page, "per_page": per_page})

        # POST / — добавить водителя
        if method == "POST" and (path.endswith("/admin-drivers") or path.endswith("/admin-drivers/")):
            if not can(user, "can_add_drivers"):
                return json_resp({"error": "Нет доступа"}, 403)

            required = ["full_name", "phone", "license_number"]
            for f in required:
                if not body.get(f):
                    return json_resp({"error": f"Поле {f} обязательно"}, 400)

            pw_hash = hashlib.sha256(secrets.token_hex(16).encode()).hexdigest()
            rate = float(body.get("commission_rate", 15.0))
            c_type = body.get("commission_type", "percent")

            with conn.cursor() as cur:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.drivers
                        (full_name, phone, email, password_hash, license_number,
                         vehicle_make, vehicle_model, vehicle_year, vehicle_plate,
                         vehicle_color, vehicle_class, commission_rate, commission_type, controller_id)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    RETURNING id
                """, (
                    body["full_name"], body["phone"], body.get("email"),
                    pw_hash, body["license_number"],
                    body.get("vehicle_make"), body.get("vehicle_model"),
                    body.get("vehicle_year"), body.get("vehicle_plate"),
                    body.get("vehicle_color"), body.get("vehicle_class", "economy"),
                    rate, c_type, body.get("controller_id")
                ))
                new_id = cur.fetchone()[0]
            audit(conn, user["id"], "add_driver", "driver", new_id, f"Добавлен водитель {body['full_name']}")
            conn.commit()
            return json_resp({"id": new_id, "ok": True}, 201)

        # PUT /{id}/commission — изменить комиссию
        parts = path.rstrip("/").split("/")
        if method == "PUT" and len(parts) >= 2 and parts[-1] == "commission":
            if not can(user, "can_edit_commission"):
                return json_resp({"error": "Нет доступа"}, 403)

            driver_id = int(parts[-2])
            new_rate = float(body.get("commission_rate", 0))
            new_type = body.get("commission_type", "percent")
            reason = body.get("reason", "")

            # Проверка диапазона для модераторов
            p = user.get("permissions") or {}
            if not p.get("full"):
                mn = p.get("commission_rate_min", 0)
                mx = p.get("commission_rate_max", 100)
                if new_rate < mn or new_rate > mx:
                    return json_resp({"error": f"Допустимый диапазон: {mn}%–{mx}%"}, 403)

            with conn.cursor() as cur:
                cur.execute(f"SELECT commission_rate, commission_type FROM {SCHEMA}.drivers WHERE id = %s", (driver_id,))
                old = cur.fetchone()
                if not old:
                    return json_resp({"error": "Водитель не найден"}, 404)

                cur.execute(f"""
                    UPDATE {SCHEMA}.drivers
                    SET commission_rate = %s, commission_type = %s, updated_at = NOW()
                    WHERE id = %s
                """, (new_rate, new_type, driver_id))

                cur.execute(f"""
                    INSERT INTO {SCHEMA}.commission_history
                        (driver_id, changed_by, old_rate, new_rate, old_type, new_type, reason)
                    VALUES (%s,%s,%s,%s,%s,%s,%s)
                """, (driver_id, user["id"], old[0], new_rate, old[1], new_type, reason))

            audit(conn, user["id"], "edit_commission", "driver", driver_id, f"{old[0]}% -> {new_rate}%")
            conn.commit()
            return json_resp({"ok": True})

        # PUT /{id}/status — изменить статус (блокировка)
        if method == "PUT" and len(parts) >= 2 and parts[-1] == "status":
            if not can(user, "can_block_drivers"):
                return json_resp({"error": "Нет доступа"}, 403)

            driver_id = int(parts[-2])
            new_status = body.get("status", "active")
            if new_status not in ("active", "suspended", "blocked"):
                return json_resp({"error": "Недопустимый статус"}, 400)

            with conn.cursor() as cur:
                cur.execute(f"UPDATE {SCHEMA}.drivers SET status = %s, updated_at = NOW() WHERE id = %s", (new_status, driver_id))

            audit(conn, user["id"], "change_status", "driver", driver_id, f"Статус -> {new_status}")
            conn.commit()
            return json_resp({"ok": True})

        return json_resp({"error": "Not found"}, 404)

    finally:
        conn.close()
