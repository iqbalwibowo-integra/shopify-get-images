import requests
import os
import re
from urllib.parse import urlparse

import os
from dotenv import load_dotenv

load_dotenv()

# ============================================
# DATA DIAMBIL DARI .env
SHOP = os.getenv("SHOP", "your-store.myshopify.com")
ACCESS_TOKEN = os.getenv("ACCESS_TOKEN")
DOWNLOAD_FOLDER = "D:\Downloads"        # folder tempat simpan file
# ============================================

API_URL = f"https://{SHOP}/admin/api/2026-01/graphql.json"
HEADERS = {
    "X-Shopify-Access-Token": ACCESS_TOKEN,
    "Content-Type": "application/json"
}

QUERY = """
query getFiles($cursor: String) {
  files(first: 250, after: $cursor) {
    edges {
      node {
        ... on MediaImage {
          image {
            url
          }
        }
        ... on GenericFile {
          url
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
"""

def get_all_file_urls():
    urls = []
    cursor = None
    page = 1

    while True:
        print(f"Fetching page {page}...")
        variables = {"cursor": cursor} if cursor else {}
        response = requests.post(API_URL, json={"query": QUERY, "variables": variables}, headers=HEADERS)
        data = response.json()

        if "errors" in data:
            print("Error:", data["errors"])
            break

        files = data["data"]["files"]
        edges = files["edges"]

        for edge in edges:
            node = edge["node"]
            url = None
            if "image" in node and node["image"]:
                url = node["image"]["url"]
            elif "url" in node and node["url"]:
                url = node["url"]
            if url:
                urls.append(url)

        print(f"  Terkumpul: {len(urls)} file")

        page_info = files["pageInfo"]
        if page_info["hasNextPage"]:
            cursor = page_info["endCursor"]
            page += 1
        else:
            break

    return urls

def sanitize_filename(url):
    parsed = urlparse(url)
    filename = os.path.basename(parsed.path)
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    return filename or "unknown_file"

def download_files(urls):
    os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)
    total = len(urls)

    for i, url in enumerate(urls, 1):
        filename = sanitize_filename(url)
        filepath = os.path.join(DOWNLOAD_FOLDER, filename)

        # Skip kalau sudah ada
        if os.path.exists(filepath):
            print(f"[{i}/{total}] Skip (sudah ada): {filename}")
            continue

        try:
            print(f"[{i}/{total}] Downloading: {filename}")
            r = requests.get(url, timeout=30)
            r.raise_for_status()
            with open(filepath, "wb") as f:
                f.write(r.content)
        except Exception as e:
            print(f"  ERROR: {e}")

    print(f"\nSelesai! {total} file disimpan di folder '{DOWNLOAD_FOLDER}'")

if __name__ == "__main__":
    print("=== Shopify File Downloader ===\n")
    print("Mengambil semua URL file...")
    urls = get_all_file_urls()
    print(f"\nTotal file ditemukan: {len(urls)}")
    print("Mulai download...\n")
    download_files(urls)