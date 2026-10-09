# bote-message

Bot that answers every private message on ahmed's Facebook Page (Messenger) and Instagram for the shop **Knavaro (كنافارو)**, men's clothing in Algeria. Replies come from Claude, in the customer's own language (Darija in Arabic or Latin letters, French, Arabic). Code map: [README.md](README.md). Setup guide in Darija: [GUIDE.md](GUIDE.md).

## Working with ahmed
- ahmed writes in Algerian Darija. Answer in simple Darija, no technical words.
- One step at a time, click by click; wait for "كملت" before the next step. He works on a MacBook.
- Do the work yourself whenever you can; only ask him for what needs his hands (his accounts, his keys, a click in a website).
- Never ask him to paste a password, API key or token into the chat. Secrets go on the server with `deploy/set-env.sh` (it hides what he types).

## How the bot behaves (keep it this way)
- Business facts live only in `business.md`. A line marked "مازال" is unknown: the bot must not invent it.
- Confirmed orders: the model adds an `<order>{json}</order>` block, the bot strips it and sends a one-line summary to the shop's WhatsApp 0778396959 (`src/whatsapp.js`, WhatsApp Cloud API template `new_order`).
- Exchanges and returns: the bot gives the number 0778396959, it does not handle them.
- `[HUMAN]` in the model output = hand off: the bot stops answering that customer for 12 h. It also stops when someone from the page answers in the inbox.
- `DRY_RUN=true` (default) = replies only go to the logs. Switching to `false` sends real messages to customers: only when ahmed says so.
- Run `npm test` after any change.

## Server
- ahmed's own VPS (Hetzner): `root@2.28.195.233`, Debian/Ubuntu. Public address for Meta: `https://2-28-195-233.sslip.io` (Caddy gives it HTTPS).
- Login is by password for now. Before running remote commands, set up key login once: ask ahmed to run `ssh-copy-id root@2.28.195.233` himself in the terminal (he types the password there, not in the chat). After setup, remind him to change the root password with `passwd`.
- Install or reinstall: copy the repo to `/opt/bote-message` on the server, then `bash /opt/bote-message/deploy/install.sh`. It installs Node 22, the systemd service `bote-message` and Caddy, and prints the Webhook Callback URL and Verify token.
- Settings are in `/etc/bote-message.env` (root only). Set one: `bash /opt/bote-message/deploy/set-env.sh NAME`. Update code: `deploy/update.sh` (needs a git checkout) or copy the files again and `systemctl restart bote-message`.
- Logs: `journalctl -u bote-message -f`.

## Done so far
- Code written and tested; repo `aazouaou64-sys/bote-message` (private).
- ahmed has a Claude Console account with credit and an API key (he keeps it).
- `business.md` has the brand, cash on delivery, DHD delivery prices for every wilaya, the WhatsApp number, the exchange number and the tone.

## Still to do, in order
1. Install the bot on the server (above), then put ahmed's Claude key in with `set-env.sh ANTHROPIC_API_KEY`. If a Render service was created earlier, ahmed should delete it so he is not billed.
2. Meta app (GUIDE.md step 4): Business app, Messenger and Instagram products, Page access token, webhook with the Callback URL and Verify token, subscribe to `messages` and `message_echoes`. Put `META_APP_ID`, `META_APP_SECRET`, `META_PAGE_ACCESS_TOKEN` on the server with `set-env.sh`.
3. Test in DRY_RUN with ahmed's own account, then `DRY_RUN=false` when he agrees.
4. WhatsApp order forwarding (GUIDE.md step 7): sender number + `new_order` template, then `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID`.
5. Business verification and App Review (Advanced Access for `pages_messaging`, `instagram_manage_messages`) so the bot answers every customer.
6. Product list with prices, sizes and colours is still missing from `business.md` (the site kanavaro.netlify.app loads products with JavaScript). Ask ahmed or read the site.
7. Unconfirmed: price at the new DHD offices (assumed same as the wilaya office), and wilayas 50, 54, 56 (not in the price list).
