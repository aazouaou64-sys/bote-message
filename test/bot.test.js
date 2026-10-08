import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { config } from "../src/config.js";
import { createBot } from "../src/bot.js";
import { createServer } from "../src/server.js";
import { parseWebhook, splitMessage, verifySignature } from "../src/meta.js";
import * as store from "../src/store.js";
import { parseModelText } from "../src/claude.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function fakeDeps(replyFn) {
  const sent = [];
  const logs = [];
  return {
    sent,
    logs,
    deps: {
      debounceMs: 10,
      log: (l) => logs.push(l),
      sendTyping: async () => {},
      sendText: async (id, text, platform) => {
        sent.push({ id, text, platform });
        return [`m_bot_${sent.length}`];
      },
      generateReply: replyFn ?? (async () => ({ text: "مرحبا بيك خويا", handoff: false })),
    },
  };
}

function pageEvent(text, { sender = "U1", mid = crypto.randomUUID(), echo = false, appId } = {}) {
  return {
    object: "page",
    entry: [{ messaging: [{
      sender: { id: echo ? "PAGE" : sender },
      recipient: { id: echo ? sender : "PAGE" },
      message: { mid, text, ...(echo ? { is_echo: true, app_id: appId } : {}) },
    }] }],
  };
}

beforeEach(() => {
  store._resetForTests();
  config.dryRun = false;
  config.appId = "APP1";
});

test("replies to a customer message", async () => {
  const f = fakeDeps();
  const bot = createBot(f.deps);
  for (const ev of parseWebhook(pageEvent("سلام شحال السعر؟"))) bot.handleEvent(ev);
  await wait(40);
  assert.deepEqual(f.sent, [{ id: "U1", text: "مرحبا بيك خويا", platform: "facebook" }]);
});

test("groups a burst of messages into one reply with the full context", async () => {
  let seen;
  const f = fakeDeps(async (_p, history) => { seen = history; return { text: "ok", handoff: false }; });
  const bot = createBot(f.deps);
  for (const t of ["salam", "ch7al la robe noire?"]) for (const ev of parseWebhook(pageEvent(t))) bot.handleEvent(ev);
  await wait(40);
  assert.equal(f.sent.length, 1);
  assert.deepEqual(seen, [{ role: "user", content: "salam\nch7al la robe noire?" }]);
});

test("dry run sends nothing", async () => {
  config.dryRun = true;
  const f = fakeDeps();
  const bot = createBot(f.deps);
  for (const ev of parseWebhook(pageEvent("hello"))) bot.handleEvent(ev);
  await wait(40);
  assert.equal(f.sent.length, 0);
  assert.ok(f.logs.some((l) => l.startsWith("[dry-run]")));
});

test("stops answering after a handoff", async () => {
  const f = fakeDeps(async () => ({ text: "واحد من الفريق يجاوبك", handoff: true }));
  const bot = createBot(f.deps);
  for (const ev of parseWebhook(pageEvent("bghit nkalam m3a wahed"))) bot.handleEvent(ev);
  await wait(40);
  for (const ev of parseWebhook(pageEvent("allo?"))) bot.handleEvent(ev);
  await wait(40);
  assert.equal(f.sent.length, 1);
});

test("stays quiet when a person from the page answers", async () => {
  const f = fakeDeps();
  const bot = createBot(f.deps);
  for (const ev of parseWebhook(pageEvent("من الإنبوكس", { echo: true, appId: "OTHER" }))) bot.handleEvent(ev);
  for (const ev of parseWebhook(pageEvent("chokran"))) bot.handleEvent(ev);
  await wait(40);
  assert.equal(f.sent.length, 0);
});

test("ignores its own echoes and duplicate deliveries", async () => {
  const f = fakeDeps();
  const bot = createBot(f.deps);
  for (const ev of parseWebhook(pageEvent("bot msg", { echo: true, appId: "APP1" }))) bot.handleEvent(ev);
  const dup = pageEvent("salam", { mid: "same" });
  for (const ev of [...parseWebhook(dup), ...parseWebhook(dup)]) bot.handleEvent(ev);
  await wait(40);
  assert.equal(f.sent.length, 1);
});

test("handles Instagram and image-only messages", async () => {
  let seen;
  const f = fakeDeps(async (_p, h) => { seen = h; return { text: "ok", handoff: false }; });
  const bot = createBot(f.deps);
  const body = { object: "instagram", entry: [{ messaging: [{ sender: { id: "IG1" }, recipient: { id: "ME" },
    message: { mid: "x", attachments: [{ type: "image" }] } }] }] };
  for (const ev of parseWebhook(body)) bot.handleEvent(ev);
  await wait(40);
  assert.equal(f.sent[0].platform, "instagram");
  assert.match(seen[0].content, /image/);
});

test("splits long messages under platform limits", () => {
  const parts = splitMessage("كلمة ".repeat(500), "instagram");
  assert.ok(parts.length > 1 && parts.every((p) => p.length <= 1000));
});

test("server verifies the webhook and the signature", async () => {
  config.verifyToken = "tok";
  const handled = [];
  const server = createServer({ handleEvent: (e) => handled.push(e) }, "secret").listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    let r = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=tok&hub.challenge=42`);
    assert.equal(await r.text(), "42");
    r = await fetch(`${base}/webhook?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=42`);
    assert.equal(r.status, 403);

    const body = JSON.stringify(pageEvent("salam"));
    r = await fetch(`${base}/webhook`, { method: "POST", body, headers: { "x-hub-signature-256": "sha256=00" } });
    assert.equal(r.status, 401);
    const sig = "sha256=" + crypto.createHmac("sha256", "secret").update(body).digest("hex");
    r = await fetch(`${base}/webhook`, { method: "POST", body, headers: { "x-hub-signature-256": sig } });
    assert.equal(r.status, 200);
    await wait(20);
    assert.equal(handled.length, 1);
    assert.ok(verifySignature(Buffer.from(body), sig, "secret"));
  } finally {
    server.close();
  }
});

test("forwards a confirmed order to WhatsApp and keeps it out of the customer's message", async () => {
  const orders = [];
  const f = fakeDeps(async () => ({
    text: "شكرا أختي، الفريق يعيطلك باش يأكد",
    handoff: false,
    order: { name: "Sara", phone: "0555", wilaya: "Oran", delivery: "home", items: [{ product: "تريكو", size: "M", color: "أسود", quantity: 1 }], total: "3500 دج" },
  }));
  f.deps.sendOrder = async (t) => orders.push(t);
  const bot = createBot(f.deps);
  for (const ev of parseWebhook(pageEvent("ih nconfirmi"))) bot.handleEvent(ev);
  await wait(40);
  assert.equal(f.sent[0].text, "شكرا أختي، الفريق يعيطلك باش يأكد");
  assert.equal(orders.length, 1);
  assert.match(orders[0], /الاسم: Sara \| الهاتف: 0555/);
  assert.match(orders[0], /تريكو M أسود x1/);
  assert.doesNotMatch(orders[0], /\n/);
  assert.match(store.getHistory("facebook", "U1").at(-1).content, /<order>/);
});

test("parses the order block out of the model text", () => {
  const r = parseModelText('شكرا أختي\n<order>{"name":"A","items":[]}</order>');
  assert.equal(r.text, "شكرا أختي");
  assert.deepEqual(r.order, { name: "A", items: [] });
  assert.equal(parseModelText("سلام [HUMAN]").handoff, true);
});
