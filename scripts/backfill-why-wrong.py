# scripts/backfill-why-wrong.py
# One-off: restores per-wrong-answer feedback from the original Excel onto
# the 120 general_quiz_questions rows seeded by migration 0011, using the
# why_wrong column added in migration 0012. Matches rows by exact
# question_text since there's no shared id between the Excel and the table.
import json
import os
import urllib.request
import urllib.parse
import openpyxl

EXCEL_PATH = r"C:\Users\Manyata Manocha\Downloads\Tech_AI_MCQ_Quiz_120Q.xlsx"

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

    wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True)
    ws = wb["All 120 Questions"]
    rows = list(ws.iter_rows(min_row=3, values_only=True))  # skip 2 title rows
    header = rows[0]
    assert header[2] == "Question" and header[7] == "Correct Answer", "unexpected header layout"

    matched, unmatched = 0, []
    for row in rows[1:]:
        if row[2] is None:
            continue
        question_text = row[2]
        option_a, option_b, option_c, option_d = row[3], row[4], row[5], row[6]
        correct_letter = row[7]
        why_a, why_b, why_c, why_d = row[9], row[10], row[11], row[12]

        options = {"A": option_a, "B": option_b, "C": option_c, "D": option_d}
        whys = {"A": why_a, "B": why_b, "C": why_c, "D": why_d}
        why_wrong = {
            options[letter]: whys[letter]
            for letter in ("A", "B", "C", "D")
            if letter != correct_letter and whys[letter]
        }
        if len(why_wrong) != 3:
            unmatched.append((question_text, "incomplete why_wrong in source row"))
            continue

        url = (
            f"{supabase_url}/rest/v1/general_quiz_questions"
            f"?question_text=eq.{urllib.parse.quote(question_text)}"
        )
        body = json.dumps({"why_wrong": why_wrong}).encode("utf-8")
        req = urllib.request.Request(url, data=body, method="PATCH", headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        })
        try:
            with urllib.request.urlopen(req) as resp:
                result = json.loads(resp.read())
                if result:
                    matched += 1
                else:
                    unmatched.append((question_text, "no matching row in DB"))
        except urllib.error.HTTPError as e:
            unmatched.append((question_text, f"HTTP {e.code}: {e.read().decode()}"))

    print(f"Matched and updated: {matched}")
    if unmatched:
        print(f"Unmatched ({len(unmatched)}) — left untouched, not silently skipped:")
        for text, reason in unmatched:
            print(f"  - {reason}: {text[:80]}")

if __name__ == "__main__":
    main()
