// Talk to the bot in the terminal, without Facebook or Instagram:
//   npm run chat            (as a Facebook customer)
//   npm run chat instagram  (as an Instagram customer)
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { generateReply } from "../src/claude.js";

const platform = process.argv[2] === "instagram" ? "instagram" : "facebook";
const history = [];
const rl = readline.createInterface({ input, output });
console.log(`Kteb kima client (${platform}). Ctrl+C bach tokhrej.\n`);

while (true) {
  const text = await rl.question("Client: ");
  if (!text.trim()) continue;
  history.push({ role: "user", content: text });
  const { text: reply, handoff, order } = await generateReply(platform, history);
  history.push({ role: "assistant", content: reply || "..." });
  console.log(`Bot: ${reply}${handoff ? "\n   (→ hna l bot ywaqef w ykhalli wahed mn l équipe ykammel)" : ""}`);
  if (order) console.log(`   (→ commande raha trouh l WhatsApp: ${JSON.stringify(order)})`);
  console.log();
}
