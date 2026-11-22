# Empire Tycoon

محاكاة استراتيجية لإدارة الشركات وبناء مجموعة اقتصادية. تبدأ اللعبة من مشروع يواجه قرارات تسعير وتمويل وتشغيل حقيقية داخل اقتصاد خيالي، وتمتد إلى إدارة مجموعة واستثمارات وأسواق تنافسية. نستخدم TypeScript وتقنيات الويب، مع Capacitor لتغليف التطبيق للهواتف، من دون محرك ألعاب.

> **اكتملت مرحلة الأساس (A).** يفتح مدخل لعبة الأعمال نقطة مراجعة «الطلب الكبير» بواجهات الملخص والشركة والعقود والمالية من [ET-011](docs/production/tasks/ET-011.md). تُفتح معاينة التأسيس من شاشة الشركة أو بإضافة `?preview=1` إلى عنوان التطبيق. نموذج المقاطعات السابق متاح للتشغيل عبر مدخله المستقل.

| المسار | المرجع |
|---|---|
| الرؤية وحدود المنتج | [ميثاق اللعبة](docs/product/CHARTER.md) · [تصميم اللعب](docs/product/GAME_DESIGN.md) · [تحليل المرجع](docs/research/REFERENCE.md) |
| قطاع الذكاء الاصطناعي | [تأسيس الشركة وسلسلة الإمداد والمنافسة](docs/product/AI_INDUSTRY.md) · [مثال السعة والفواتير](docs/product/AI_INDUSTRY_FIXTURE.md) |
| العالم والأندية | [البلدان والتجارة والمنافسة](docs/product/WORLD_ECONOMY.md) · [إدارة الأندية الرياضية](docs/product/CLUB_MANAGEMENT.md) · [بيانات كرة القدم 2026/27](docs/research/FOOTBALL_2026_27.md) |
| قواعد المحاكاة | [مواصفات الاقتصاد](docs/product/ECONOMY.md) · [مثال مالي مرجعي](docs/product/ECONOMY_FIXTURE.md) |
| تجربة الاستخدام | [نظام التصميم والشاشات](docs/design/DESIGN_SYSTEM.md) |
| لغة اللعبة والأداء | [TypeScript وRust/WebAssembly](docs/architecture/ADR-0012.md) · [خطة قياس الأداء](docs/engineering/PERFORMANCE.md) |
| الهندسة والقرارات | [المعمارية](docs/architecture/ARCHITECTURE.md) · [سجل القرارات](docs/architecture/DECISIONS.md) · [معايير الجودة](docs/engineering/STANDARDS.md) |
| الأدوار والتسليم | [الفرق والصلاحيات](docs/organization/ORG.md) · [الخارطة](docs/production/ROADMAP.md) · [بنك المهام](docs/production/TASKS.md) |
| نقطة دخول الوكيل | [AGENTS.md](AGENTS.md) · [فهرس المهام المقروء آليًا](docs/production/tasks/index.json) · [ET-001](docs/production/tasks/ET-001.md) |

## التشغيل المحلي

يتطلب المشروع Node.js 22. شغّل `npm ci` من جذر المستودع، ثم اختر أمر التشغيل.

| الأمر | الهدف | مخرجات `npm run build` |
|---|---|---|
| `npm run dev:game` | نقطة دخول لعبة الأعمال في `apps/game` | `apps/game/dist/` |
| `npm run dev` | نموذج المقاطعات السابق في `src` | `dist/` |

يمكن تشغيل المدخلين معًا بتحديد منفذ مختلف لأحدهما، مثل `npm run dev:game -- --port 5174`.

## خريطة البناء والفحوص

- يجمع `apps/game/src/main.ts` واجهة المتصفح، وتبدأ المحاكاة المستقلة من `packages/simulation/src/index.ts`. تضيف المهام التالية قواعد المالية والتشغيل والمحتوى ضمن [خريطة الحزم](docs/architecture/ARCHITECTURE.md).
- يشغّل `npm run typecheck` فحص TypeScript للتطبيق والنموذج، ثم يفحص حزم المجال بإعداد مستقل يحمّل مكتبة ECMAScript فقط ويقيّد ملفات المصدر داخل `packages`.
- يشغّل `npm test` اختبارات النموذج وفحص حجم الملفات وحدود المجال. يبني `npm run build` المدخلين بعد فحص الأنواع.
- يشغّل `npm run check:file-size` فحص سقف 350 سطرًا من نسخة Git محلية. يفحص الملفات المتتبّعة والملفات الجديدة التي يسمح Git بتتبّعها، ويعرض مسار كل ملف مخالف وعدد أسطره. يستثني التوثيق، وملفات البيانات المعينة، وملفات القفل، والتبعيات، والملفات الثنائية، ومخرجات البناء والتغطية المعروفة. تُسجّل الاستثناءات في [أداة الفحص](tools/check-file-size.mjs).
- يشغّل [سير عمل CI](.github/workflows/ci.yml) التثبيت من ملف القفل والفحوص والبناء عند الدفع وطلبات الدمج.

تستهدف إعدادات Capacitor الحالية مخرجات النموذج السابق في `dist/`. تحقق Android وiOS مجدول في [ET-014](docs/production/tasks/ET-014.md).
