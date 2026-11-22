# Empire Tycoon

محاكاة استراتيجية لإدارة الشركات وبناء مجموعة اقتصادية. تبدأ اللعبة من مشروع يواجه قرارات تسعير وتمويل وتشغيل حقيقية داخل اقتصاد خيالي، وتمتد إلى إدارة مجموعة واستثمارات وأسواق تنافسية. نستخدم TypeScript وتقنيات الويب، مع Capacitor لتغليف التطبيق للهواتف، من دون محرك ألعاب.

> **المرحلة الحالية هي النقاش والتوثيق.** المسار التنفيذي معرّف ومربوط بملفات المهام، ويبدأ عند التكليف بالتنفيذ. الكود الموجود نموذج سابق لبناء المقاطعات؛ قواعده وشاشاته ليست مواصفات لعبة الأعمال.

| المسار | المرجع |
|---|---|
| الرؤية وحدود المنتج | [ميثاق اللعبة](docs/product/CHARTER.md) · [تصميم اللعب](docs/product/GAME_DESIGN.md) · [تحليل المرجع](docs/research/REFERENCE.md) |
| قواعد المحاكاة | [مواصفات الاقتصاد](docs/product/ECONOMY.md) · [مثال مالي مرجعي](docs/product/ECONOMY_FIXTURE.md) |
| تجربة الاستخدام | [نظام التصميم والشاشات](docs/design/DESIGN_SYSTEM.md) |
| الهندسة والقرارات | [المعمارية](docs/architecture/ARCHITECTURE.md) · [سجل القرارات](docs/architecture/DECISIONS.md) · [معايير الجودة](docs/engineering/STANDARDS.md) |
| الأدوار والتسليم | [الفرق والصلاحيات](docs/organization/ORG.md) · [الخارطة](docs/production/ROADMAP.md) · [بنك المهام](docs/production/TASKS.md) |
| نقطة دخول الوكيل | [AGENTS.md](AGENTS.md) · [فهرس المهام المقروء آليًا](docs/production/tasks/index.json) · [ET-001](docs/production/tasks/ET-001.md) |

## تشغيل النموذج الموجود

يتطلب Node.js 22. شغّل npm install ثم npm run dev. لفحص النموذج استخدم npm run typecheck وnpm test وnpm run build. اختبار النموذج الحالي لا يثبت جاهزية محاكاة الأعمال أو تثبيت Android وiOS.
