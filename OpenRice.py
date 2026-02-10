import pandas as pd
import requests, urllib.parse, time, random, re
from collections import Counter
from bs4 import BeautifulSoup

# ────────────────────────────────────────────────────────────────
# 1. LOAD SOURCE & CHOOSE ROWS
# ────────────────────────────────────────────────────────────────
INPUT_FILE  = "wonder_restaurant.csv"
OUTPUT_FILE = INPUT_FILE

df          = pd.read_csv(INPUT_FILE)
original_df = df.copy() 

def parse_ranges(s: str) -> list[int]:
    """Turn '1,3-5,8' into zero-based indices [0,2,3,4,7]."""
    idx = set()
    for part in s.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-")
            for i in range(int(a), int(b) + 1):
                idx.add(i - 1)
        elif part:
            idx.add(int(part) - 1)
    return sorted(i for i in idx if 0 <= i < len(df))

sel = input("Enter rows to scrape (e.g. 1-5,8; blank=all): ").strip()
if sel:
    rows_to_run = parse_ranges(sel)
else:
    rows_to_run = list(range(len(df)))

restaurant_names = df.iloc[rows_to_run, 0] \
                     .dropna().astype(str).str.strip()

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

BRACKET_TAIL = re.compile(r'\s*\([^)]*\)\s*$')

def scrape_openrice_names(query: str,
                          max_retries: int = 3,
                          max_hits: int = 4) -> list[str]:
    url = (
        "https://www.openrice.com/en/hongkong/restaurants"
        f"?whatwhere={urllib.parse.quote_plus(query)}"
    )
    for attempt in range(1, max_retries + 1):
        try:
            r = requests.get(url, headers=HEADERS, timeout=12)
            r.raise_for_status()
            soup = BeautifulSoup(r.text, "html.parser")
            hits = [t.get_text(strip=True)
                    for t in soup.select("div.poi-name.poi-list-cell-link")]
            return hits[:max_hits]
        except Exception as e:
            if attempt == max_retries:
                print(f"[{query}] failed → {e}")
                return []
            time.sleep(1.5 * attempt + random.random())

def chainstore_flag(hits: list[str]) -> str:
    if len(hits) <= 1:
        return "no"
    def base(s: str) -> str:
        return BRACKET_TAIL.sub("", s).strip().lower()
    norms = [base(h) for h in hits]
    return "yes" if any(c > 1 for c in Counter(norms).values()) else "no"

# ────────────────────────────────────────────────────────────────
# 4. RUN SCRAPE ON SELECTED ROWS
# ────────────────────────────────────────────────────────────────
records = []
for name in restaurant_names:
    m = scrape_openrice_names(name)
    records.append({
        "all_openrice_matches": m,
        "chainstore": chainstore_flag(m),
    })
    time.sleep(1.2 + random.random())

results_df = pd.DataFrame(records, index=rows_to_run)

# ────────────────────────────────────────────────────────────────
# 5. WRITE BACK & SAVE
# ────────────────────────────────────────────────────────────────
original_df.loc[rows_to_run, "all_openrice_matches"] = results_df["all_openrice_matches"]
original_df.loc[rows_to_run, "chainstore"]          = results_df["chainstore"]

original_df.to_csv(OUTPUT_FILE, index=False)
print(f"Updated {len(rows_to_run)} rows in '{OUTPUT_FILE}'")