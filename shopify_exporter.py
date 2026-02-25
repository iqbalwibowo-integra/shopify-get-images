import requests
import csv
import os
from urllib.parse import urlparse

import os
from dotenv import load_dotenv

load_dotenv()

# ============================================
# DATA DIAMBIL DARI .env
SHOP = os.getenv("SHOP", "your-store.myshopify.com")
ACCESS_TOKEN = os.getenv("ACCESS_TOKEN")
OUTPUT_FILE = "shopify_files_list.csv"      # nama file output
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

def get_all_files():
    all_data = []
    cursor = None
    page = 1

    while True:
        print(f"Fetching page {page}...")
        variables = {"cursor": cursor} if cursor else {}
        try:
            response = requests.post(API_URL, json={"query": QUERY, "variables": variables}, headers=HEADERS)
            data = response.json()

            if "errors" in data:
                print("Error dari Shopify:", data["errors"])
                break

            files_data = data["data"]["files"]
            edges = files_data["edges"]

            for edge in edges:
                node = edge["node"]
                url = None
                if "image" in node and node["image"]:
                    url = node["image"]["url"]
                elif "url" in node and node["url"]:
                    url = node["url"]
                
                if url:
                    # Ambil nama file dari URL
                    filename = os.path.basename(urlparse(url).path)
                    all_data.append({"filename": filename, "url": url})

            print(f"  Terkumpul: {len(all_data)} file")

            page_info = files_data["pageInfo"]
            if page_info["hasNextPage"]:
                cursor = page_info["endCursor"]
                page += 1
            else:
                break
        except Exception as e:
            print(f"Terjadi kesalahan: {e}")
            break

    return all_data

def save_to_csv(data):
    if not data:
        print("Tidak ada data untuk disimpan.")
        return

    keys = data[0].keys()
    with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as f:
        dict_writer = csv.DictWriter(f, fieldnames=keys)
        dict_writer.writeheader()
        dict_writer.writerows(data)
    
    print(f"\nSelesai! {len(data)} data file telah disimpan ke '{OUTPUT_FILE}'")

if __name__ == "__main__":
    print("=== Shopify File URL Collector ===\n")
    print(f"Store: {SHOP}")
    
    files = get_all_files()
    save_to_csv(files)
