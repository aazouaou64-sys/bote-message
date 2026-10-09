# الدليل: كيفاش تشعّل البوت تاعك

البوت يستقبل كل ميساج يجي للباجة تاع فيسبوك (Messenger) وللإنستغرام، ويجاوب بالـ Claude بنفس اللغة لي كتب بيها الكليان (دارجة، فرانسي، عربية، إنجليزية).

**واش يدير البوت:**
- يجاوب بأدب واحترافية، قصير وواضح، وغير من المعلومات لي تكتبها في `business.md` (ما يخترعش أسعار).
- كي الكليان يحب يكوموندي، يسقسيه على الاسم، التيليفون، الولاية... يعاود يقرالو الطلبية باش يأكد، ومن بعد يبعث الطلبية للواتساب تاع المحل ويقول للكليان الفريق يعيطلك.
- كي الكليان يحب يبدّل ولا يرجّع، يعطيه الرقم المخصص باش يتواصل معاه مباشرة.
- كي الكليان زعفان، ولا يحب يهدر مع عبد، ولا سؤال ما يعرفلوش: يقولّو واحد من الفريق يجاوبك، ويسكت في هاديك المحادثة 12 ساعة.
- كي تجاوب انت (ولا واحد من الفريق) من الإنبوكس، البوت يحبس وحدو في هاديك المحادثة 12 ساعة، باش ما تتلاقاوش.
- كي الكليان يبعث 3 ميساجات ورا بعض، البوت يستنى شوية ويجاوب مرة وحدة.

---

## 1. عمّر معلومات المشروع
حل الفيشي `business.md` وعمّر: واش تبيع، الأسعار، التوصيل، كيفاش يكوموندي الكليان، الأوقات... (ولا ابعثهملي في الثريد وأنا نعمّرو).

## 2. جيب مفتاح Claude (API key)
1. روح لـ https://platform.claude.com وافتح كونط.
2. **Billing** ← زيد شوية كريدي (مثلا 10$).
3. **API Keys** ← **Create Key** ← انسخو وخبيه عندك. **ما تبعثوش في الشات.**

> التكلفة التقريبية (تقدير): حوالي 1 حتى 2 دولار لكل 100 رد.

## 3. حط البوت على الإنترنت (Hosting)
البوت لازم يكون خدام 24/24 على سيرفر عندو رابط https. أسهل حل: **Render.com**.
1. حط الدوسي `bote-message` في ريبو GitHub (private).
2. في https://render.com ← **New** ← **Web Service** ← اختار الريبو.
3. **Build command:** `npm install` — **Start command:** `npm start`.
4. خير plan مدفوع صغير (Starter)؛ المجاني يرقد وما يجاوبش في الوقت.
5. في **Environment** زيد هادو (القيم تجي من المراحل 2 و 4):
   - `ANTHROPIC_API_KEY`
   - `META_APP_ID`
   - `META_APP_SECRET`
   - `META_PAGE_ACCESS_TOKEN`
   - `META_VERIFY_TOKEN` ← كلمة تختارها انت، مثلا `ahmed-bot-2026`
   - `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `ORDERS_WHATSAPP_TO` (المرحلة 7)
   - `DRY_RUN` = `true` (وضع التجربة: البوت يكتب الرد في الـ Logs برك وما يبعث والو)
6. كي يكمل تاخذ رابط كيما `https://bote-message.onrender.com`.

### 3 (ب). ولا على سيرفر تاعك (Ubuntu/Debian)
1. من الماك: افتح **Terminal** واكتب `ssh root@<IP تاع السيرفر>`.
2. اعمل مفتاح باش السيرفر يقرا الدوسي من GitHub:
   `ssh-keygen -t ed25519 -N "" -q -C bote-message -f /root/.ssh/bote_deploy && cat /root/.ssh/bote_deploy.pub`
   انسخ السطر لي يخرج، وحطو في GitHub ← الدوسي `bote-message` ← **Settings ← Deploy keys ← Add deploy key**.
3. حمّل البوت وشعّلو:
   `apt-get update -qq && apt-get install -y -qq git && GIT_SSH_COMMAND="ssh -i /root/.ssh/bote_deploy -o StrictHostKeyChecking=accept-new" git clone git@github.com:aazouaou64-sys/bote-message.git /opt/bote-message && bash /opt/bote-message/deploy/install.sh`
   يسقسيك على مفتاح Claude، ومن بعد يعطيك **Callback URL** و **Verify token** تاع المرحلة 4.
- باش تزيد إعداد (مثلا التوكن تاع Meta): `bash /opt/bote-message/deploy/set-env.sh META_PAGE_ACCESS_TOKEN`
- باش تجيب آخر نسخة من البوت: `bash /opt/bote-message/deploy/update.sh`
- باش تشوف واش راه يدير البوت: `journalctl -u bote-message -f`

## 4. اصنع تطبيق Meta
**قبل كلش:** الإنستغرام لازم يكون **Professional (Business)** ومربوط بالباجة تاع فيسبوك. وفي الإنستغرام: **Settings ← Messages ← Connected tools ← Allow access to messages** = ON.

1. روح لـ https://developers.facebook.com ← **My Apps** ← **Create App** ← النوع **Business**.
2. **App settings ← Basic**: انسخ **App ID** و **App Secret** (حطهم في Render).
3. زيد المنتج **Messenger**:
   - **Access Tokens** ← زيد الباجة تاعك ← **Generate token** ← هذا هو `META_PAGE_ACCESS_TOKEN`.
   - **Webhooks** ← **Callback URL** = `https://<الرابط تاعك>/webhook` و **Verify token** = نفس الكلمة لي حطيتها في `META_VERIFY_TOKEN` ← **Verify and save**.
   - اشترك (Subscribe) الباجة في: `messages` و `message_echoes`.
4. زيد المنتج **Instagram** (Instagram API with Facebook Login):
   - **Webhooks** ← نفس الـ Callback URL ونفس الـ Verify token.
   - اشترك في `messages`.
   - نفس التوكن تاع الباجة يخدم للإنستغرام.

> نصيحة: التوكن لي يتعمل من الداشبورد يقدر يخلص. باش تاخذ توكن ما يخلصش: **Business Settings ← System users** ← اعمل system user، اعطيه الباجة، و **Generate token** بالصلاحيات `pages_messaging`, `pages_manage_metadata`, `instagram_basic`, `instagram_manage_messages`.

## 5. جرّب
- التطبيق مازال في **Development mode**: غير الناس لي عندهم دور في التطبيق (انت) يقدرو يجربو.
- ابعث ميساج للباجة من كونطك، وشوف في Render ← **Logs** سطر `[dry-run]` فيه الرد لي كان راح يبعث.
- كي يعجبك الرد: بدّل `DRY_RUN` إلى `false` ← البوت يبدا يبعث بصح. **قولي قبل ما تديرها.**

## 6. باش يجاوب كاع الناس (App Review)
باش البوت يجاوب أي كليان (ماشي غير انت)، Meta تطلب:
1. **Business Verification** (التحقق من البيزنس) في Business Settings.
2. **App Review** ← اطلب **Advanced Access** لـ `pages_messaging` و `instagram_manage_messages` (فيديو قصير يبين البوت يجاوب).
3. كي يقبلو ← حط التطبيق **Live**.

هادي أطول مرحلة (أيام حتى أسابيع حسب Meta).

## 7. الكوموندات للواتساب
البوت يبعث كل طلبية مأكدة لرقم الواتساب تاع المحل، في ميساج واحد فيه: الاسم، الهاتف، الولاية، العنوان، المنتجات، المجموع.
باش يبعث، يلزم **WhatsApp Cloud API** (نفس تطبيق Meta):
1. في التطبيق ← **Add product** ← **WhatsApp**.
2. Meta تعطيك رقم تجربة (Test number). ولا تزيد رقم جديد خاص بالبوت (رقم ما يكونش مسجل في تطبيق واتساب).
   - انسخ **Phone number ID** ← هذا `WHATSAPP_PHONE_NUMBER_ID`.
3. **To** ← زيد رقم الواتساب لي تحب توصلك فيه الكوموندات (مع رقم التجربة لازم تزيدو في القائمة وتأكدو بالكود).
   - الرقم تاع الكوموندات `0778396959` راهو محطوط في البوت (`213778396959`). باش تبدلو، حط رقم آخر في `ORDERS_WHATSAPP_TO`.
4. **WhatsApp Manager ← Message templates ← Create template**:
   - الاسم: `new_order` — النوع: **Utility** — اللغة: **Arabic**
   - النص: `طلبية جديدة 🛍️ {{1}}`
   - ابعثو للموافقة (عادة دقايق).
5. التوكن: نفس الـ System user تاع المرحلة 4، زيدلو صلاحية `whatsapp_business_messaging` ← هذا `WHATSAPP_TOKEN`.

> إذا ما عمرتش هادو، البوت يخدم عادي والكوموندات تبان غير في الـ Logs (سطر `[order]`).

---

## تجربة بلا فيسبوك (اختياري، للي عندو Node.js)
```
npm install
cp .env.example .env     # وحط ANTHROPIC_API_KEY
npm run chat             # تكتب كيما كليان والبوت يجاوبك
npm run chat instagram
```

## إعدادات إضافية
| المتغير | واش يدير | الافتراضي |
|---|---|---|
| `DRY_RUN` | `true` = تجربة، `false` = يبعث للكليان | `true` |
| `HUMAN_PAUSE_HOURS` | قداه يسكت البوت كي يجاوب عبد من الفريق | `12` |
| `CLAUDE_MODEL` | الموديل (مثلا `claude-sonnet-5-5` أرخص) | `claude-opus-5-5` |
| `CLAUDE_EFFORT` | قداه يخمم قبل ما يجاوب (`low` سريع) | `low` |
