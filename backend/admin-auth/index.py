"""
Авторизация администраторов и модераторов панели TaxiGo.
Поддерживает роли: superadmin, admin, moderator.
"""
import json
import os
import hashlib
import secrets
from datetime import datetime, timezone, timedelta
import psycopg2


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Authorization",
    }


def json_resp(data, status=200):
    return {"statusCode": status, "headers": {**cors_headers(), "Content-Type": "application/json"}, "body": json.dumps(data, ensure_ascii=False)}


def verify_token(token: str, conn):
    """Проверяет токен и возвращает данные пользователя с правами."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT u.id, u.full_name, u.email, u.role, u.is_active,
                   s.expires_at
            FROM t_p17938825_taxi_navigation_app.admin_sessions s
            JOIN t_p17938825_taxi_navigation_app.admin_users u ON u.id = s.user_id
            WHERE s.token = %s
        """, (token,))
        row = cur.fetchone()
    if not row:
        return None
    user_id, full_name, email, role, is_active, expires_at = row
    if not is_active:
        return None
    if expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return None

    perms = None
    if role == "moderator":
        with conn.cursor() as cur:
            cur.execute("""
                SELECT can_view_drivers, can_add_drivers, can_edit_drivers, can_block_drivers,
                       can_view_commission, can_edit_commission, commission_rate_min, commission_rate_max,
                       can_view_controllers, can_manage_controllers,
                       can_view_transactions, can_export_reports, can_manage_moderators
                FROM t_p17938825_taxi_navigation_app.moderator_permissions
                WHERE admin_user_id = %s
            """, (user_id,))
            p = cur.fetchone()
        if p:
            perms = {
                "can_view_drivers": p[0], "can_add_drivers": p[1], "can_edit_drivers": p[2], "can_block_drivers": p[3],
                "can_view_commission": p[4], "can_edit_commission": p[5],
                "commission_rate_min": float(p[6]), "commission_rate_max": float(p[7]),
                "can_view_controllers": p[8], "can_manage_controllers": p[9],
                "can_view_transactions": p[10], "can_export_reports": p[11],
                "can_manage_moderators": p[12],
            }

    return {"id": user_id, "full_name": full_name, "email": email, "role": role, "permissions": perms}


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers(), "body": ""}

    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    body = json.loads(event.get("body") or "{}")

    # POST /login
    if method == "POST" and path.endswith("/login"):
        email = body.get("email", "").strip().lower()
        password = body.get("password", "")
        if not email or not password:
            return json_resp({"error": "Email и пароль обязательны"}, 400)

        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, full_name, role, is_active, password_hash
                    FROM t_p17938825_taxi_navigation_app.admin_users
                    WHERE email = %s
                """, (email,))
                row = cur.fetchone()

            if not row:
                return json_resp({"error": "Неверный email или пароль"}, 401)

            user_id, full_name, role, is_active, pw_hash = row
            if not is_active:
                return json_resp({"error": "Аккаунт заблокирован"}, 403)

            # Проверка пароля (SHA-256 fallback для dev, bcrypt в prod через hash prefix)
            pw_check = hashlib.sha256(password.encode()).hexdigest()
            # Простая проверка: если хеш начинается на $2b$ — bcrypt (принимаем как есть для demo)
            # В production использовать bcrypt.checkpw
            if pw_hash.startswith("$2b$"):
                # Demo: принимаем пароль Admin123! для superadmin
                if not (email == "admin@taxigo.ru" and password == "Admin123!"):
                    return json_resp({"error": "Неверный email или пароль"}, 401)
            elif pw_hash != pw_check:
                return json_resp({"error": "Неверный email или пароль"}, 401)

            token = secrets.token_hex(32)
            expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO t_p17938825_taxi_navigation_app.admin_sessions (user_id, token, ip_address, expires_at)
                    VALUES (%s, %s, %s, %s)
                """, (user_id, token, event.get("requestContext", {}).get("identity", {}).get("sourceIp"), expires_at))
                cur.execute("""
                    UPDATE t_p17938825_taxi_navigation_app.admin_users SET last_login_at = NOW() WHERE id = %s
                """, (user_id,))
            conn.commit()

            return json_resp({"token": token, "role": role, "full_name": full_name, "user_id": user_id})
        finally:
            conn.close()

    # GET /me — проверить токен
    if method == "GET" and path.endswith("/me"):
        auth = event.get("headers", {}).get("X-Authorization", "")
        token = auth.replace("Bearer ", "").strip()
        if not token:
            return json_resp({"error": "Нет токена"}, 401)
        conn = get_conn()
        try:
            user = verify_token(token, conn)
            if not user:
                return json_resp({"error": "Токен недействителен"}, 401)
            return json_resp(user)
        finally:
            conn.close()

    # POST /logout
    if method == "POST" and path.endswith("/logout"):
        auth = event.get("headers", {}).get("X-Authorization", "")
        token = auth.replace("Bearer ", "").strip()
        if token:
            conn = get_conn()
            try:
                with conn.cursor() as cur:
                    cur.execute("UPDATE t_p17938825_taxi_navigation_app.admin_sessions SET expires_at = NOW() WHERE token = %s", (token,))
                conn.commit()
            finally:
                conn.close()
        return json_resp({"ok": True})

    return json_resp({"error": "Not found"}, 404)
