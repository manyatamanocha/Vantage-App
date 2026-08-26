# One-off: assigns app_metadata.role = "admin" to the single account named by
# ADMIN_EMAIL in .env.local. app_metadata (not user_metadata) is deliberate —
# it can only be written via the service-role key, never by the user's own
# client SDK, so a normal user has no way to grant themselves this role.
# Safe to re-run: it's an idempotent PATCH of the same value, not an append.
import json
import urllib.parse
import urllib.request


def load_env(path=".env.local"):
    env = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip()
    return env


def main():
    env = load_env()
    supabase_url = env["NEXT_PUBLIC_SUPABASE_URL"]
    service_key = env["SUPABASE_SERVICE_ROLE_KEY"]
    admin_email = env["ADMIN_EMAIL"]

    lookup_url = f"{supabase_url}/auth/v1/admin/users?email={urllib.parse.quote(admin_email)}"
    req = urllib.request.Request(lookup_url, headers={
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
    })
    with urllib.request.urlopen(req) as resp:
        users = json.loads(resp.read())["users"]

    # Exact match only — a substring match on email risks assigning admin to
    # a similarly-named account (a real duplicate exists in this project:
    # "manyata126@gmail.co", missing the final "m").
    matches = [u for u in users if u["email"] == admin_email]
    if len(matches) != 1:
        raise SystemExit(
            f"Expected exactly one user with email {admin_email!r}, found {len(matches)}. "
            "Refusing to guess which account to promote."
        )
    user = matches[0]
    user_id = user["id"]

    update_url = f"{supabase_url}/auth/v1/admin/users/{user_id}"
    body = json.dumps({"app_metadata": {"role": "admin"}}).encode("utf-8")
    req = urllib.request.Request(update_url, data=body, method="PUT", headers={
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    })
    with urllib.request.urlopen(req) as resp:
        updated = json.loads(resp.read())

    print(f"Assigned role=admin to {admin_email} (id: {user_id})")
    print(f"app_metadata now: {updated.get('app_metadata')}")


if __name__ == "__main__":
    main()
