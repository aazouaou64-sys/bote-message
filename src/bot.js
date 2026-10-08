import { config } from "./config.js";
import * as store from "./store.js";
import { formatOrder } from "./whatsapp.js";

const pending = new Map(); // conversation key -> timer, used to group bursts of messages
const ourMessageIds = new Set();

function describeAttachments(attachments) {
  if (!attachments.length) return "";
  const kinds = attachments.map((a) => a.type || "file").join(", ");
  return `[The customer sent: ${kinds}. You cannot see or hear it; ask them kindly to describe what they need in text.]`;
}

/**
 * deps: { generateReply, sendText, sendTyping, sendOrder, log, debounceMs }
 * sendOrder(orderText) is optional; without it orders only go to the logs.
 */
export function createBot(deps) {
  const log = deps.log ?? console.log;
  const debounceMs = deps.debounceMs ?? 2500;

  async function respond(platform, userId) {
    pending.delete(`${platform}:${userId}`);
    if (store.isPaused(platform, userId)) return;
    const history = store.getHistory(platform, userId);
    if (!history.length || history[history.length - 1].role !== "user") return;

    await deps.sendTyping?.(userId);
    let reply;
    try {
      reply = await deps.generateReply(platform, history.map((t) => ({ ...t })));
    } catch (err) {
      log(`[error] Claude failed for ${platform}:${userId}: ${err.message}`);
      return;
    }

    if (reply.text) {
      // Keep the order block in the history so the model knows it was already sent.
      const remembered = reply.order ? `${reply.text}\n<order>${JSON.stringify(reply.order)}</order>` : reply.text;
      store.addTurn(platform, userId, "assistant", remembered, config.historyLimit);
      if (config.dryRun) {
        log(`[dry-run] ${platform}:${userId} <- ${reply.text}`);
      } else {
        try {
          const ids = await deps.sendText(userId, reply.text, platform);
          for (const id of [].concat(ids ?? [])) ourMessageIds.add(id);
          log(`[sent] ${platform}:${userId} <- ${reply.text}`);
        } catch (err) {
          log(`[error] send failed for ${platform}:${userId}: ${err.message}`);
        }
      }
    }

    if (reply.order) {
      const orderText = formatOrder(reply.order, platform, userId);
      log(`[order] ${orderText}`);
      if (deps.sendOrder) {
        try {
          await deps.sendOrder(orderText);
          log(`[order sent to WhatsApp] ${platform}:${userId}`);
        } catch (err) {
          log(`[error] WhatsApp order failed for ${platform}:${userId}: ${err.message}`);
        }
      }
    }

    if (reply.handoff) {
      store.pause(platform, userId, config.humanPauseHours);
      log(`[needs human] ${platform}:${userId} — bot paused ${config.humanPauseHours}h for this conversation`);
    }
  }

  function handleEvent(ev) {
    if (!ev.senderId || ev.isDeleted) return;
    if (store.alreadySeen(ev.mid)) return;

    if (ev.isEcho) {
      // A message sent from the page. If it was not sent by this bot, a person
      // from the team is answering: stay quiet in that conversation for a while.
      const ours = (config.appId && ev.appId === config.appId) || ourMessageIds.has(ev.mid);
      if (!ours) {
        const customerId = ev.recipientId;
        store.pause(ev.platform, customerId, config.humanPauseHours);
        if (ev.text) store.addTurn(ev.platform, customerId, "assistant", ev.text, config.historyLimit);
        log(`[human replied] ${ev.platform}:${customerId} — bot paused ${config.humanPauseHours}h`);
      }
      return;
    }

    const content = [ev.text, describeAttachments(ev.attachments)].filter(Boolean).join("\n");
    if (!content) return;

    log(`[in] ${ev.platform}:${ev.senderId} -> ${content}`);
    store.addTurn(ev.platform, ev.senderId, "user", content, config.historyLimit);
    if (store.isPaused(ev.platform, ev.senderId)) return;

    const k = `${ev.platform}:${ev.senderId}`;
    clearTimeout(pending.get(k));
    pending.set(
      k,
      setTimeout(() => {
        respond(ev.platform, ev.senderId).catch((err) => log(`[error] ${err.stack}`));
      }, debounceMs),
    );
  }

  return { handleEvent, respond };
}
