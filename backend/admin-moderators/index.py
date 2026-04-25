"""
Управление модераторами: создание, редактирование прав, блокировка.
Доступно только admin и superadmin (или moderator с can_manage_moderators).
"""
import json
import os
import hashlib
from datetime import datetime, timezone
import psycopg2

SCHEMA = "t_p17938825_taxi_navigation_app"


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
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

    is_full_admin = role in ("superadmin", "admin")
    can_manage = is_full_admin

    if role == "moderator":
        with conn.cursor() as cur:
            cur.execute(f"SELECT can_manage_moderators FROM {SCHEMA}.moderator_permissions WHERE admin_user_id = %s", (user_id,))
            p = cur.fetchone()
        can_manage = p and p[0]

    return {"id": user_id, "full_name": full_name, "role": role, "is_full_admin": is_full_admin, "can_manage": can_manage}


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers(), "body": ""}

    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    body = json.loads(event.get("body") or "{}")
    auth = event.get("headers", {}).get("X-Authorization", "")
    token = auth.replace("Bearer ", "").strip()

    conn = get_conn()
    try:
        user = get_user(token, conn)
        if not user:
            return json_resp({"error": "Не авторизован"}, 401)
        if not user["can_manage"]:
            return json_resp({"error": "Нет доступа"}, 403)

        # GET / — список модераторов
        if method == "GET":
            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT u.id, u.full_name, u.email, u.role, u.is_active,
                           u.created_at, u.last_login_at,
                           cr.full_name as created_by_name,
                           p.can_view_drivers, p.can_add_drivers, p.can_edit_drivers, p.can_block_drivers,
                           p.can_view_commission, p.can_edit_commission,
                           p.commission_rate_min, p.commission_rate_max,
                           p.can_view_controllers, p.can_manage_controllers,
                           p.can_view_transactions, p.can_export_reports, p.can_manage_moderators
                    FROM {SCHEMA}.admin_users u
                    LEFT JOIN {SCHEMA}.admin_users cr ON cr.id = u.created_by
                    LEFT JOIN {SCHEMA}.moderator_permissions p ON p.admin_user_id = u.id
                    WHERE u.id != %s
                    ORDER BY u.role, u.created_at DESC
                """, (user["id"],))
                rows = cur.fetchall()

            cols = ["id","full_name","email","role","is_active","created_at","last_login_at","created_by_name",
                    "can_view_drivers","can_add_drivers","can_edit_drivers","can_block_drivers",
                    "can_view_commission","can_edit_commission","commission_rate_min","commission_rate_max",
                    "can_view_controllers","can_manage_controllers",
                    "can_view_transactions","can_export_reports","can_manage_moderators"]
            result = [dict(zip(cols, r)) for r in rows]
            return json_resp({"users": result})

        # POST / — создать модератора/админа
        if method == "POST" and (path.endswith("/admin-moderators") or path.endswith("/admin-moderators/")):
            if not body.get("email") or not body.get("full_name") or not body.get("password"):
                return json_resp({"error": "Поля full_name, email, password обязательны"}, 400)

            role_new = body.get("role", "moderator")
            # superadmin не может создавать только superadmin сам себе подобных
            if role_new == "superadmin" and user["role"] != "superadmin":
                return json_resp({"error": "Недостаточно прав для создания superadmin"}, 403)

            pw_hash = hashlib.sha256(body["password"].encode()).hexdigest()

            with conn.cursor() as cur:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.admin_users (full_name, email, password_hash, role, created_by)
                    VALUES (%s, %s, %s, %s, %s) RETURNING id
                """, (body["full_name"], body["email"].lower(), pw_hash, role_new, user["id"]))
                new_id = cur.fetchone()[0]

                # Если модератор — создаём запись прав
                if role_new == "moderator":
                    p = body.get("permissions", {})
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.moderator_permissions
                            (admin_user_id, can_view_drivers, can_add_drivers, can_edit_drivers, can_block_drivers,
                             can_view_commission, can_edit_commission, commission_rate_min, commission_rate_max,
                             can_view_controllers, can_manage_controllers,
                             can_view_transactions, can_export_reports, can_manage_moderators, updated_by)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """, (
                        new_id,
                        p.get("can_view_drivers", True), p.get("can_add_drivers", False),
                        p.get("can_edit_drivers", False), p.get("can_block_drivers", False),
                        p.get("can_view_commission", True), p.get("can_edit_commission", False),
                        p.get("commission_rate_min", 0), p.get("commission_rate_max", 100),
                        p.get("can_view_controllers", False), p.get("can_manage_controllers", False),
                        p.get("can_view_transactions", True), p.get("can_export_reports", False),
                        p.get("can_manage_moderators", False), user["id"]
                    ))

            conn.commit()
            return json_resp({"id": new_id, "ok": True}, 201)

        # PUT /{id}/permissions — обновить права
        parts = path.rstrip("/").split("/")
        if method == "PUT" and len(parts) >= 2 and parts[-1] == "permissions":
            target_id = int(parts[-2])
            p = body.get("permissions", {})

            with conn.cursor() as cur:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.moderator_permissions
                        (admin_user_id, can_view_drivers, can_add_drivers, can_edit_drivers, can_block_drivers,
                         can_view_commission, can_edit_commission, commission_rate_min, commission_rate_max,
                         can_view_controllers, can_manage_controllers,
                         can_view_transactions, can_export_reports, can_manage_moderators,
                         updated_at, updated_by)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),%s)
                    ON CONFLICT (admin_user_id) DO UPDATE SET
                        can_view_drivers = EXCLUDED.can_view_drivers,
                        can_add_drivers = EXCLUDED.can_add_drivers,
                        can_edit_drivers = EXCLUDED.can_edit_drivers,
                        can_block_drivers = EXCLUDED.can_block_drivers,
                        can_view_commission = EXCLUDED.can_view_commission,
                        can_edit_commission = EXCLUDED.can_edit_commission,
                        commission_rate_min = EXCLUDED.commission_rate_min,
                        commission_rate_max = EXCLUDED.commission_rate_max,
                        can_view_controllers = EXCLUDED.can_view_controllers,
                        can_manage_controllers = EXCLUDED.can_manage_controllers,
                        can_view_transactions = EXCLUDED.can_view_transactions,
                        can_export_reports = EXCLUDED.can_export_reports,
                        can_manage_moderators = EXCLUDED.can_manage_moderators,
                        updated_at = NOW(),
                        updated_by = EXCLUDED.updated_by
                """, (
                    target_id,
                    p.get("can_view_drivers", True), p.get("can_add_drivers", False),
                    p.get("can_edit_drivers", False), p.get("can_block_drivers", False),
                    p.get("can_view_commission", True), p.get("can_edit_commission", False),
                    p.get("commission_rate_min", 0), p.get("commission_rate_max", 100),
                    p.get("can_view_controllers", False), p.get("can_manage_controllers", False),
                    p.get("can_view_transactions", True), p.get("can_export_reports", False),
                    p.get("can_manage_moderators", False), user["id"]
                ))
            conn.commit()
            return json_resp({"ok": True})

        # PUT /{id}/toggle — активировать/деактивировать
        if method == "PUT" and len(parts) >= 2 and parts[-1] == "toggle":
            target_id = int(parts[-2])
            if target_id == user["id"]:
                return json_resp({"error": "Нельзя деактивировать себя"}, 400)
            with conn.cursor() as cur:
                cur.execute(f"""
                    UPDATE {SCHEMA}.admin_users SET is_active = NOT is_active WHERE id = %s RETURNING is_active
                """, (target_id,))
                result = cur.fetchone()
            conn.commit()
            return json_resp({"is_active": result[0] if result else None})

        return json_resp({"error": "Not found"}, 404)

    finally:
        conn.close()
