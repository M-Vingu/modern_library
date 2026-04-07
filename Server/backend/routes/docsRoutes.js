const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const openapiPath = path.join(__dirname, '..', 'docs', 'openapi.json');

function loadOpenApi() {
  const raw = fs.readFileSync(openapiPath, 'utf8');
  return JSON.parse(raw);
}

router.get('/openapi.json', (_req, res) => {
  try {
    res.json(loadOpenApi());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', (_req, res) => {
  res.type('html').send(`
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Modern Library API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/api/docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true
      });
    </script>
  </body>
</html>
  `);
});

module.exports = router;
