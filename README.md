# bote-message

Auto-replies to Facebook Page (Messenger) and Instagram DMs with Claude, in the customer's language.
Setup guide (Darija): [GUIDE.md](GUIDE.md).

- `src/server.js` – HTTP server: `GET /webhook` (Meta verification), `POST /webhook` (signed events, `X-Hub-Signature-256`).
- `src/bot.js` – per-conversation logic: groups message bursts, dedupes deliveries, pauses after a handoff or when a human replies from the inbox (echo not sent by this app), `DRY_RUN` mode.
- `src/claude.js` – system prompt + Claude call (`claude-opus-5-5`, effort `low`, server-side fallback on refusal). `[HUMAN]` in the model output marks a handoff.
- `src/whatsapp.js` – forwards confirmed orders (`<order>` JSON block in the model output) to the shop's WhatsApp via a Cloud API template.
- `src/meta.js` – webhook parsing, Send API (`/me/messages` with the Page token, works for the linked Instagram account too), message splitting (2000 / 1000 chars).
- `business.md` – the only source of business facts for the bot.

Conversation state is in memory (resets on restart).

```
npm install
npm test          # offline tests, no keys needed
npm run chat      # talk to the bot in the terminal (needs ANTHROPIC_API_KEY)
npm start
```
