const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
app.use(express.static("public"));
app.use(express.json());

const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = process.env;
const SCOPES = "read_files";

// Step 1: Redirect ke Shopify OAuth
app.get("/auth", (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).send("Missing shop parameter");

  const authUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${CLIENT_ID}` +
    `&scope=${SCOPES}` +
    `&redirect_uri=${REDIRECT_URI}` +
    `&response_type=code`;

  res.redirect(authUrl);
});

// Step 2: Shopify redirect ke sini dengan code
app.get("/auth/callback", async (req, res) => {
  const { shop, code, hmac } = req.query;

  // Validasi HMAC
  const params = Object.entries(req.query)
    .filter(([k]) => k !== "hmac")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const digest = crypto
    .createHmac("sha256", CLIENT_SECRET)
    .update(params)
    .digest("hex");

  if (digest !== hmac) {
    return res.status(401).send("HMAC validation failed");
  }

  // Tukar code dengan access token
  try {
    const response = await axios.post(
      `https://${shop}/admin/oauth/access_token`,
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
      }
    );

    const accessToken = response.data.access_token;
    res.redirect(`/?shop=${shop}&token=${accessToken}`);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("Failed to get access token");
  }
});

// Step 3: Fetch semua files via GraphQL
app.post("/api/files", async (req, res) => {
  const { shop, token } = req.body;
  if (!shop || !token) return res.status(400).json({ error: "Missing shop or token" });

  const query = `
    query getFiles($cursor: String) {
      files(first: 250, after: $cursor) {
        edges {
          node {
            ... on MediaImage {
              image { url }
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
  `;

  let allFiles = [];
  let cursor = null;
  let hasNextPage = true;

  try {
    while (hasNextPage) {
      const response = await axios.post(
        `https://${shop}/admin/api/2026-01/graphql.json`,
        { query, variables: { cursor } },
        {
          headers: {
            "X-Shopify-Access-Token": token,
            "Content-Type": "application/json",
          },
        }
      );

      const data = response.data;
      if (data.errors) {
        return res.status(400).json({ error: data.errors });
      }

      const edges = data.data.files.edges;
      edges.forEach(({ node }) => {
        let url = null;
        if (node.image?.url) url = node.image.url;
        else if (node.url) url = node.url;

        if (url) {
          const filename = url.split("/").pop().split("?")[0];
          allFiles.push({ filename, url });
        }
      });

      hasNextPage = data.data.files.pageInfo.hasNextPage;
      cursor = data.data.files.pageInfo.endCursor;
    }

    res.json({ files: allFiles, total: allFiles.length });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch files" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
