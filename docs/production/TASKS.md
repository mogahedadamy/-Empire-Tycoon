# بنك مهام التنفيذ

المرحلة الحالية توثيق. عند التكليف ببدء التنفيذ، المهمة الأولى هي [ET-001](tasks/ET-001.md). بعدها يقرأ الوكيل [الفهرس](tasks/index.json) ويختار أول مهمة جاهزة تكتمل تبعياتها، أو يقرأ مباشرة بطاقة المعرف المذكور في الطلب. تحدد البطاقة المالك وملفات التوجيه والمواصفات والمسارات والقبول. يراجع الوكيل حالات التبعيات المكتملة وسجل نتائجها قبل تفعيل المهمة التابعة.

حالات الفهرس هي planned وready وin_progress وdone وblocked. تعني ready جاهزية التعليمات عند التكليف؛ ولا تعني أن التنفيذ بدأ. يمكن تنفيذ مهام مستقلة بعد اكتمال مقدماتها. يحفظ الفهرس مسارات من جذر المستودع. عند إضافة مهمة جديدة تُحدَّث البطاقة والفهرس والجدول.

| المرحلة | المهمة | المالك | التبعيات |
|---|---|---|---|
| A | [ET-001 · تهيئة المستودع ومرجع العمل](tasks/ET-001.md) | Platform Lead | — |
| A | [ET-002 · عقود المحاكاة والوقت](tasks/ET-002.md) | Principal Simulation Engineer | [ET-001](tasks/ET-001.md) |
| A | [ET-003 · دفتر الأستاذ والمال والقوائم](tasks/ET-003.md) | Finance Lead | [ET-001](tasks/ET-001.md) |
| A | [ET-004 · قالب السيناريو والشركة الأولى](tasks/ET-004.md) | Game Director | [ET-001](tasks/ET-001.md) |
| A | [ET-005 · اتجاه UX والأساس المشترك](tasks/ET-005.md) | UX Lead | [ET-001](tasks/ET-001.md) |
| B | [ET-006 · توريد ومخزون وتكاليف](tasks/ET-006.md) | Operations Lead | [ET-002](tasks/ET-002.md)، [ET-003](tasks/ET-003.md)، [ET-004](tasks/ET-004.md) |
| B | [ET-007 · عمالة وطاقة وأجور](tasks/ET-007.md) | Operations Lead | [ET-002](tasks/ET-002.md)، [ET-003](tasks/ET-003.md)، [ET-004](tasks/ET-004.md) |
| B | [ET-008 · عقود وتسليم وفوترة وتحصيل](tasks/ET-008.md) | Operations Lead | [ET-006](tasks/ET-006.md)، [ET-007](tasks/ET-007.md) |
| B | [ET-009 · تمويل وضرائب واستحقاقات](tasks/ET-009.md) | Finance Lead | [ET-002](tasks/ET-002.md)، [ET-003](tasks/ET-003.md)، [ET-004](tasks/ET-004.md) |
| B | [ET-010 · توقع السيولة والتعثر](tasks/ET-010.md) | Finance Lead | [ET-008](tasks/ET-008.md)، [ET-009](tasks/ET-009.md) |
| B | [ET-011 · واجهات إدارة الشركة والمراجعة المالية](tasks/ET-011.md) | UX Lead | [ET-005](tasks/ET-005.md)، [ET-008](tasks/ET-008.md)، [ET-010](tasks/ET-010.md) |
| B | [ET-012 · حفظ وترحيل واستعادة اللعب الفردي](tasks/ET-012.md) | Platform Lead | [ET-002](tasks/ET-002.md)، [ET-008](tasks/ET-008.md) |
| B | [ET-013 · رحلة الطلب الكبير](tasks/ET-013.md) | Game Director | [ET-011](tasks/ET-011.md)، [ET-012](tasks/ET-012.md) |
| B | [ET-014 · Capacitor ومصفوفة الأداء](tasks/ET-014.md) | Platform Lead | [ET-005](tasks/ET-005.md)، [ET-012](tasks/ET-012.md) |
| B | [ET-015 · التحقق من الشريحة ومراجعة UX](tasks/ET-015.md) | Quality Lead | [ET-013](tasks/ET-013.md)، [ET-014](tasks/ET-014.md) |
| C | [ET-016 · طلب ومنافسون وصدمات السوق](tasks/ET-016.md) | Economy Lead | [ET-015](tasks/ET-015.md) |
| C | [ET-017 · التصنيع واللوجستيات والعقار](tasks/ET-017.md) | Operations Lead | [ET-015](tasks/ET-015.md) |
| C | [ET-018 · تأليف محتوى وحملة وتوازن](tasks/ET-018.md) | Content Lead | [ET-016](tasks/ET-016.md)، [ET-017](tasks/ET-017.md) |
| D | [ET-019 · أساس الخدمة المتصلة](tasks/ET-019.md) | Online Lead | [ET-015](tasks/ET-015.md) |
| D | [ET-020 · قواعد موسم وتجربة التنافس](tasks/ET-020.md) | Game Director | [ET-016](tasks/ET-016.md)، [ET-019](tasks/ET-019.md) |
| E | [ET-021 · اختبارات الإطلاق والمراقبة](tasks/ET-021.md) | Quality Lead | [ET-018](tasks/ET-018.md)، [ET-020](tasks/ET-020.md) |
| F | [ET-022 · المجموعة والاستحواذ وإعادة الهيكلة](tasks/ET-022.md) | Finance Lead | [ET-018](tasks/ET-018.md)، [ET-021](tasks/ET-021.md) |
| F | [ET-023 · أوراق مالية وأصول استثمارية خيالية](tasks/ET-023.md) | Economy Lead | [ET-022](tasks/ET-022.md) |
| F | [ET-024 · قرارات التوسعات والإيراد والتعاون](tasks/ET-024.md) | Executive Producer | [ET-020](tasks/ET-020.md)، [ET-021](tasks/ET-021.md) |
