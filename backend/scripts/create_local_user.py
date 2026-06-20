from __future__ import annotations

import argparse
import json

from app.core.config import get_settings
from app.core.security import hash_password


def main() -> None:
    parser = argparse.ArgumentParser(description="Tao user fallback cho app mobile")
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--display-name", required=True)
    parser.add_argument("--landsoft-username", required=True)
    parser.add_argument("--landsoft-user-id", required=True, type=int)
    parser.add_argument("--department-id", type=int, default=0)
    parser.add_argument("--role-name", default="Landsoft Mobile User")
    args = parser.parse_args()

    settings = get_settings()
    path = settings.local_users_path
    if path.exists():
        users = json.loads(path.read_text(encoding="utf-8"))
    else:
        users = []

    users = [item for item in users if item.get("username") != args.username]
    users.append(
        {
            "username": args.username,
            "password_hash": hash_password(args.password),
            "display_name": args.display_name,
            "landsoft_username": args.landsoft_username,
            "landsoft_user_id": args.landsoft_user_id,
            "department_id": args.department_id,
            "role_name": args.role_name,
        }
    )
    path.write_text(json.dumps(users, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Da ghi user vao {path}")


if __name__ == "__main__":
    main()
