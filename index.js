const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.static("public"));
app.use(express.json());

const { SHOP, ACCESS_TOKEN, PORT = 3000 } = process.env;

// API untuk ambil list files menggunakan token dari .env
app.get("/api/files", async (req, res) => {
  if (!SHOP || !ACCESS_TOKEN) {
    return res.status(500).json({ error: "SHOP atau ACCESS_TOKEN belum diatur di Environment Variables" });
  }

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
        `https://${SHOP}/admin/api/2026-01/graphql.json`,
        { query, variables: { cursor } },
        {
          headers: {
            "X-Shopify-Access-Token": ACCESS_TOKEN,
            "Content-Type": "application/json",
          },
        }
      );

      const data = response.data;
      if (data.errors) {
        return res.status(400).json({ error: data.errors });
      }

      const filesData = data.data.files;
      if (filesData && filesData.edges) {
        filesData.edges.forEach(({ node }) => {
          let url = null;
          if (node.image?.url) url = node.image.url;
          else if (node.url) url = node.url;

          if (url) {
            const filename = url.split("/").pop().split("?")[0];
            allFiles.push({ filename, url });
          }
        });

        hasNextPage = filesData.pageInfo.hasNextPage;
        cursor = filesData.pageInfo.endCursor;
      } else {
        hasNextPage = False;
      }
    }

    res.json({ files: allFiles, total: allFiles.length });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Gagal mengambil data dari Shopify API" });
  }
});

const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Error: Port ${PORT} sudah digunakan.`);
  } else {
    console.error(e);
  }
});
