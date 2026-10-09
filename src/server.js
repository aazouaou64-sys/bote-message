import http from "node:http";
import { config } from "./config.js";
import { verifySignature, parseWebhook, sendText, sendTyping } from "./meta.js";
import { generateReply } from "./claude.js";
import { createBot } from "./bot.js";
import { whatsappConfigured, sendOrderToWhatsapp } from "./whatsapp.js";

export function createServer(bot, appSecret = config.appSecret) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");

    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200).end("bote-message is running");
      return;
    }

    // Meta calls this once when you add the webhook URL in the app dashboard.
    if (req.method === "GET" && url.pathname === "/webhook") {
      const ok =
        url.searchParams.get("hub.mode") === "subscribe" &&
        config.verifyToken &&
        url.searchParams.get("hub.verify_token") === config.verifyToken;
      if (ok) res.writeHead(200).end(url.searchParams.get("hub.challenge"));
      else res.writeHead(403).end("Forbidden");
      return;
    }

    if (req.method === "POST" && url.pathname === "/webhook") {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const raw = Buffer.concat(chunks);
        if (!verifySignature(raw, req.headers["x-hub-signature-256"], appSecret)) {
          res.writeHead(401).end("Bad signature");
          return;
        }
        // Answer Meta right away; the reply is generated in the background.
        res.writeHead(200).end("EVENT_RECEIVED");
        let body;
        try {
          body = JSON.parse(raw.toString("utf8"));
        } catch {
          return;
        }
        for (const ev of parseWebhook(body)) bot.handleEvent(ev);
      });
      return;
    }

    res.writeHead(404).end("Not found");
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const missing = ["META_VERIFY_TOKEN", "META_APP_SECRET", "META_PAGE_ACCESS_TOKEN", "ANTHROPIC_API_KEY"].filter(
    (k) => !process.env[k],
  );
  if (missing.length) console.warn(`[warn] Missing settings: ${missing.join(", ")}`);
  console.log(`[mode] ${config.dryRun ? "DRY_RUN: replies are only written to the logs" : "LIVE: replies are sent to customers"}`);

  if (!whatsappConfigured()) console.warn("[warn] WhatsApp not set: orders will only appear in the logs");
  const bot = createBot({
    generateReply,
    sendText,
    sendTyping,
    sendOrder: whatsappConfigured() ? sendOrderToWhatsapp : undefined,
  });
  createServer(bot).listen(config.port, config.host, () =>
    console.log(`[ready] listening on ${config.host}:${config.port}`),
  );
}
