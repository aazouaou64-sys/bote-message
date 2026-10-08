import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Load .env without an extra dependency. Real environment variables win.
const envFile = path.join(ROOT, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const env = process.env;

// "0778 39 69 59" -> "213778396959" (WhatsApp wants the country code, no + or spaces).
export function toInternational(phone) {
  const digits = phone.replace(/[^0-9]/g, "");
  return /^0[5-7]\d{8}$/.test(digits) ? `213${digits.slice(1)}` : digits;
}

export const config = {
  port: Number(env.PORT || 3000),

  // Meta
  verifyToken: env.META_VERIFY_TOKEN || "",
  appSecret: env.META_APP_SECRET || "",
  appId: env.META_APP_ID || "",
  pageAccessToken: env.META_PAGE_ACCESS_TOKEN || "",
  graphVersion: env.META_GRAPH_VERSION || "v23.0",

  // Claude
  model: env.CLAUDE_MODEL || "claude-opus-5-5",
  effort: env.CLAUDE_EFFORT || "low",

  // WhatsApp Cloud API, used to forward confirmed orders to the shop's own number.
  whatsappToken: env.WHATSAPP_TOKEN || "",
  whatsappPhoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || "",
  ordersWhatsappTo: toInternational(env.ORDERS_WHATSAPP_TO || "213778396959"),
  whatsappTemplate: env.WHATSAPP_TEMPLATE || "new_order",
  whatsappTemplateLang: env.WHATSAPP_TEMPLATE_LANG || "ar",

  // Behaviour
  // DRY_RUN=true: the bot writes the reply in the logs but sends nothing to customers.
  dryRun: (env.DRY_RUN ?? "true").toLowerCase() !== "false",
  // How long the bot stays quiet in a conversation after a human from the page answers it.
  humanPauseHours: Number(env.HUMAN_PAUSE_HOURS || 12),
  historyLimit: Number(env.HISTORY_LIMIT || 20),

  businessFile: path.join(ROOT, env.BUSINESS_FILE || "business.md"),
};

export function loadBusinessInfo() {
  return fs.readFileSync(config.businessFile, "utf8");
}
