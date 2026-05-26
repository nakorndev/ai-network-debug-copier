import { createServer } from "node:http";

const host = "127.0.0.1";
const port = 8787;

const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AI Network Debug Copier Manual Test</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 32px; line-height: 1.5; }
      button { margin: 6px 8px 6px 0; padding: 8px 10px; }
      pre { background: #f3f4f6; padding: 12px; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <h1>Manual test page</h1>
    <p>Open DevTools, open the AI Network panel, then click these buttons.</p>
    <button data-url="/api/search?q=debug&token=query-secret">GET query</button>
    <button data-url="/api/login" data-method="POST">POST JSON</button>
    <button data-url="/api/error/400">400</button>
    <button data-url="/api/error/401">401</button>
    <button data-url="/api/error/500">500</button>
    <button data-url="/api/text">Text</button>
    <button data-url="/api/empty">Empty</button>
    <button data-url="/api/large">Large</button>
    <pre id="output">No request yet.</pre>
    <script>
      const output = document.querySelector("#output");
      document.addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-url]");
        if (!button) return;
        const method = button.dataset.method || "GET";
        const response = await fetch(button.dataset.url, {
          method,
          headers: {
            "content-type": "application/json",
            "authorization": "Bearer manual-test-token"
          },
          body: method === "POST" ? JSON.stringify({
            email: "debug@example.com",
            password: "secret-password",
            nested: { token: "nested-token-value" }
          }) : undefined
        });
        output.textContent = await response.text();
      });
    </script>
  </body>
</html>`;

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);

  response.setHeader("Access-Control-Allow-Origin", "*");

  if (url.pathname === "/") {
    send(response, 200, "text/html", page);
    return;
  }

  if (url.pathname === "/api/search") {
    sendJson(response, 200, {
      ok: true,
      query: Object.fromEntries(url.searchParams.entries()),
      secret: "response-secret",
    });
    return;
  }

  if (url.pathname === "/api/login") {
    const body = await readBody(request);
    sendJson(response, 200, {
      ok: true,
      received: JSON.parse(body),
      access_token: "server-access-token",
    });
    return;
  }

  if (url.pathname.startsWith("/api/error/")) {
    const status = Number(url.pathname.split("/").pop());
    sendJson(response, status, {
      ok: false,
      status,
      message: `Manual ${status} response`,
      session: "server-session-secret",
    });
    return;
  }

  if (url.pathname === "/api/text") {
    send(
      response,
      200,
      "text/plain",
      "Plain text response with token=plain-text-secret",
    );
    return;
  }

  if (url.pathname === "/api/empty") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (url.pathname === "/api/large") {
    sendJson(response, 200, {
      ok: true,
      data: "x".repeat(260 * 1024),
      token: "large-body-secret",
    });
    return;
  }

  sendJson(response, 404, { ok: false, message: "Not found" });
});

server.listen(port, host, () => {
  console.log(`Manual test server: http://${host}:${port}`);
});

function sendJson(response, status, body) {
  send(response, status, "application/json", JSON.stringify(body, null, 2));
}

function send(response, status, contentType, body) {
  response.writeHead(status, { "content-type": contentType });
  response.end(body);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}
