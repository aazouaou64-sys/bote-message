import { config } from "./config.js";

// One line of text: WhatsApp template parameters may not contain new lines or tabs.
export function formatOrder(order, platform, customerId) {
  const items = (order.items ?? [])
    .map((i) => [i.product, i.size, i.color, i.quantity && `x${i.quantity}`].filter(Boolean).join(" "))
    .join(" + ");
  const delivery = order.delivery === "desk" ? "مكتب" : order.delivery === "home" ? "الدار" : order.delivery;
  const fields = [
    ["الاسم", order.name],
    ["الهاتف", order.phone],
    ["الولاية", order.wilaya],
    ["العنوان", order.address],
    ["التوصيل", delivery],
    ["المنتجات", items],
    ["المجموع", order.total],
    ["ملاحظات", order.notes],
    ["من", `${platform === "instagram" ? "Instagram" : "Facebook"} (${customerId})`],
    ["", order.raw],
  ];
  return fields
    .filter(([, v]) => v)
    .map(([k, v]) => (k ? `${k}: ${v}` : String(v)))
    .join(" | ")
    .replace(/[\t\n\r]+/g, " ")
    .replace(/ {4,}/g, "   ");
}

export function whatsappConfigured() {
  return Boolean(config.whatsappToken && config.whatsappPhoneNumberId && config.ordersWhatsappTo);
}

// Sends the order to the shop's WhatsApp number with an approved template
// whose body has one variable, e.g. "طلبية جديدة 🛍️ {{1}}".
export async function sendOrderToWhatsapp(orderText) {
  const url = `https://graph.facebook.com/${config.graphVersion}/${config.whatsappPhoneNumberId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.whatsappToken}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: config.ordersWhatsappTo,
      type: "template",
      template: {
        name: config.whatsappTemplate,
        language: { code: config.whatsappTemplateLang },
        components: [{ type: "body", parameters: [{ type: "text", text: orderText.slice(0, 1000) }] }],
      },
    }),
  });
  if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${await res.text()}`);
  return res.json();
}
