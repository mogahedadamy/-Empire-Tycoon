/** Arabic and English founding terms shared by the chooser and receipt. */
import type { Locale } from '../../../../packages/ui/src';

const ar = {
  industry: 'الذكاء الاصطناعي', industryGoal: 'اختر ما تبيعه، وقارن تكلفة بدء الشركة والسعة التي تحتاجها قبل أول تحصيل.',
  intro: 'أمامك فرصة عقد حتى اليوم {day}. اختر ما ستبيعه ولمن، وراجع النقد المتبقي قبل التأسيس.',
  options: 'نماذج الأعمال', startup: 'تكلفة التأسيس اليوم',
  commitment: 'الالتزام المتوقع', daily: 'يوميًا لمدة', days: 'يومًا', collection: 'أول تحصيل متوقّع', day: 'اليوم',
  buyer: 'شريحة العملاء', business: 'طريقة الفوترة', supplier: 'المورد والمنطقة', dependency: 'التبعية الرئيسية',
  detail: 'تفاصيل السعة والترخيص', capacity: 'خطة السعة', hardware: 'عائلة العتاد', weights: 'أوزان النموذج',
  capital: 'رأس مال المؤسسين', cash: 'النقد بعد التأسيس', afterCommitment: 'النقد بعد الالتزام المتوقع',
  confirm: 'أسّس الشركة', receipt: 'تأسّست شركتك', saved: 'حُفظت شركتك على هذا الجهاز.',
  loading: 'جارٍ تحميل عروض التأسيس…', saving: 'جارٍ تأسيس شركتك…',
  error: 'تعذّر فتح السيناريو. أعد تحميل الصفحة للمحاولة مجددًا.',
  saveFailed: 'تعذّر حفظ الشركة. يمكنك إعادة المحاولة.', conflict: 'حُفظت شركة في نافذة أخرى. أعد فتح السيناريو لاستعادتها.',
  unit: '$', seats: 'مقاعد', usage: 'حسب الاستخدام', subscription: 'اشتراك', 'reserved-capacity': 'سعة مضمونة',
  managed: 'سعة مُدارة', reserved: 'حجز طويل', interruptible: 'ساعات متقطعة', 'on-demand': 'عند الطلب',
  open: 'مفتوحة', licensed: 'مرخّصة', owned: 'مملوكة',
  scope: 'قرار التأسيس الأول',
  nextTitle: 'الخطوة التالية',
  nextBody: 'حُفظ تأسيس شركتك والتزام السعة لليوم الأول. تتوسع جولات تشغيل الذكاء الاصطناعي في المرحلة التالية؛ يمكنك متابعة حملة توزيع الأغذية الكاملة أو تجربة مجال آخر.',
  continueFood: 'تابع الحملة الكاملة (توزيع الأغذية)',
  otherSectors: 'استعرض المجالات الأخرى',
};

const en: Record<keyof typeof ar, string> = {
  industry: 'AI company', industryGoal: 'Choose what to sell and compare the cost of starting and the capacity you need before your first payment.',
  intro: 'The contract opportunity stays open through Day {day}. Choose what to sell and to whom, then review the cash left after founding.',
  options: 'Business models', startup: 'Upfront founding cost',
  commitment: 'Estimated commitment', daily: 'per day for', days: 'days', collection: 'First expected payment', day: 'Day',
  buyer: 'Customer segment', business: 'Billing model', supplier: 'Supplier and region', dependency: 'Main dependency',
  detail: 'Capacity and licensing details', capacity: 'Capacity plan', hardware: 'Hardware family', weights: 'Model weights',
  capital: 'Founder capital', cash: 'Cash after founding', afterCommitment: 'Cash after estimated commitment',
  confirm: 'Found the company', receipt: 'Company founded', saved: 'Your company was saved on this device.',
  loading: 'Loading founding offers…', saving: 'Founding your company…',
  error: 'The scenario could not open. Reload the page to try again.',
  saveFailed: 'The company could not be saved. You can try again.', conflict: 'A company was saved in another window. Reopen the scenario to restore it.',
  unit: '$', seats: 'Seats', usage: 'Usage', subscription: 'Subscription', 'reserved-capacity': 'Reserved capacity',
  managed: 'Managed capacity', reserved: 'Long-term reservation', interruptible: 'Interruptible hours', 'on-demand': 'On demand',
  open: 'Open', licensed: 'Licensed', owned: 'Owned',
  scope: 'Opening founding decision',
  nextTitle: 'What comes next',
  nextBody: 'Your Day 1 founding decision and compute commitment are saved. Ongoing AI operating rounds arrive in the next milestone; continue the full Food Distribution campaign or explore another sector.',
  continueFood: 'Continue full campaign (Food distribution)',
  otherSectors: 'Browse other industries',
};

export const aiText = (locale: Locale) => locale === 'ar' ? ar : en;
