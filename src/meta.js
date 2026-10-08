import crypto from "node:crypto";
import { config } from "./config.js";

// Checks that a webhook really comes from Meta (X-Hub-Signature-256 header).
export function verifySignature(rawBody, signatureHeader, appSecret = config.appSecret) {
  if (!appSecret || !signatureHeader?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const given = signatureHeader.slice("sha256=".length);
  if (given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"));
}

/**
 * Turns a webhook body into a flat list of events:
 * { platform, senderId, recipientId, mid, text, attachments, isEcho, appId }
 */
export function parseWebhook(body) {
  const platform = body?.object === "instagram" ? "instagram" : body?.object === "page" ? "facebook" : null;
  if (!platform) return [];
  const events = [];
  for (const entry of body.entry ?? []) {
    for (const ev of entry.messaging ?? []) {
      const msg = ev.message;
      if (!msg) continue; // reads, deliveries, reactions...
      events.push({
        platform,
        senderId: ev.sender?.id,
        recipientId: ev.recipient?.id,
        mid: msg.mid,
        text: msg.text ?? "",
        attachments: msg.attachments ?? [],
        isEcho: Boolean(msg.is_echo),
        appId: msg.app_id ? String(msg.app_id) : "",
        isDeleted: Boolean(msg.is_deleted),
      });
    }
  }
  return events;
}

// Messenger allows 2000 characters per message, Instagram 1000.
export function splitMessage(text, platform) {
  const max = platform === "instagram" ? 1000 : 2000;
  const parts = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max);
    if (cut < max / 2) cut = rest.lastIndexOf(" ", max);
    if (cut < max / 2) cut = max;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

async function callSendApi(payload) {
  const url = `https://graph.facebook.com/${config.graphVersion}/me/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.pageAccessToken}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Send API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// One Page access token sends on both Messenger and the Instagram account linked to the Page.
export async function sendText(recipientId, text, platform) {
  const ids = [];
  for (const part of splitMessage(text, platform)) {
    const res = await callSendApi({
      recipient: { id: recipientId },
      messaging_type: "RESPONSE",
      message: { text: part },
    });
    if (res.message_id) ids.push(res.message_id);
  }
  return ids;
}

export async function sendTyping(recipientId) {
  try {
    await callSendApi({ recipient: { id: recipientId }, sender_action: "typing_on" });
  } catch {
    // Typing indicator is cosmetic; ignore failures.
  }
}
