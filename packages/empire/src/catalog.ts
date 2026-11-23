/** Tap upgrade tiers, 5 integrated Empire Tycoon business sectors, and Forbes ranking catalog. */
import type { BusinessSectorDef, ForbesEntry, TapTier } from './types';

export const MAX_COMPANIES = 10;
export const HOLDING_MERGE_MIN_COMPANIES = 3;
export const HOLDING_MERGE_MIN_LEVEL = 3;
export const HOLDING_MERGE_COST_CENTS = 15_000_000n; // $150,000
export const TAP_BOOST_DURATION_MS = 20_000;
export const TAP_BOOST_COOLDOWN_MS = 60_000;
export const COMPANY_BOOST_DURATION_MS = 4 * 3_600_000;
export const MAX_OFFLINE_SECONDS = 8 * 3_600;

/** Starts at $1.00/tap; first bar fills at $500.00, then unlocks multiplying tap power tiers. */
export const TAP_TIERS: readonly TapTier[] = [
  { level: 1, perTapCents: 100n, upgradeCostCents: 50_000n },
  { level: 2, perTapCents: 200n, upgradeCostCents: 150_000n },
  { level: 3, perTapCents: 500n, upgradeCostCents: 400_000n },
  { level: 4, perTapCents: 1_500n, upgradeCostCents: 1_200_000n },
  { level: 5, perTapCents: 4_000n, upgradeCostCents: 3_500_000n },
  { level: 6, perTapCents: 12_000n, upgradeCostCents: 10_000_000n },
  { level: 7, perTapCents: 35_000n, upgradeCostCents: 30_000_000n },
  { level: 8, perTapCents: 100_000n, upgradeCostCents: 100_000_000n },
  { level: 9, perTapCents: 350_000n, upgradeCostCents: 400_000_000n },
  { level: 10, perTapCents: 1_000_000n, upgradeCostCents: null },
];

export const BUSINESS_SECTORS: readonly BusinessSectorDef[] = [
  {
    id: 'food',
    name: { ar: 'توزيع الأغذية', en: 'Food Distribution' },
    companyName: { ar: 'سنابل الوادي', en: 'Sanabel Distribution' },
    tagline: { ar: 'سلسلة توريد طازجة وعقود أسواق كبرى في وادي المرسى.', en: 'Fresh cold-chain supply and harbor market contracts.' },
    art: 'images/produce-terminal.webp',
    startupCostCents: 250_000n, // $2,500
    baseHourlyCents: 180_000n, // $1,800/hr
    upgradeBaseCents: 200_000n,
    deepSimulationHref: '?mode=mission',
    strategies: [
      {
        id: 'steady-retail',
        title: { ar: 'توريد تجزئة منتظم', en: 'Steady retail supply' },
        summary: { ar: 'تحصيل مستقر ومخاطر منخفضة للمستودع.', en: 'Predictable retail cashflow with low warehouse risk.' },
        incomeBps: 10_000,
      },
      {
        id: 'harbor-contracts',
        title: { ar: 'عقود الميناء الكبرى', en: 'Big harbor contracts' },
        summary: { ar: 'حجم توريد أعلى (+٢٠٪ دخل) مع انضباط تسليم صارم.', en: 'Higher volume (+20% income) with strict delivery windows.' },
        incomeBps: 12_000,
      },
    ],
  },
  {
    id: 'manufacturing',
    name: { ar: 'التصنيع الخفيف', en: 'Light Manufacturing' },
    companyName: { ar: 'مصنع الرفوف المتوسطي', en: 'Marsa Shelving Works' },
    tagline: { ar: 'خط إنتاج أخشاب ورفوف مع إدارة الموردين وصيانة الآلات.', en: 'Modular shelving workshop with supplier & maintenance trade-offs.' },
    art: 'images/light-factory.webp',
    startupCostCents: 1_000_000n, // $10,000
    baseHourlyCents: 680_000n, // $6,800/hr
    upgradeBaseCents: 850_000n,
    deepSimulationHref: '?industry=manufacturing',
    strategies: [
      {
        id: 'local-fast',
        title: { ar: 'مورد محلي سريع', en: 'Fast local supplier' },
        summary: { ar: 'توريد فوري للخشب دون تعطّل خط الإنتاج.', en: 'Immediate timber intake with zero idle shifts.' },
        incomeBps: 10_000,
      },
      {
        id: 'regional-serviced',
        title: { ar: 'مورد إقليمي + صيانة وقائية', en: 'Regional supplier + servicing' },
        summary: { ar: 'خفض تكلفة المواد ورفع صافي الهامش (+٢٥٪ دخل).', en: 'Lower unit cost and fewer rejects (+25% income).' },
        incomeBps: 12_500,
      },
    ],
  },
  {
    id: 'logistics',
    name: { ar: 'النقل واللوجستيات', en: 'Transport & Logistics' },
    companyName: { ar: 'شحن وادي المرسى', en: 'Harbor Freight Lines' },
    tagline: { ar: 'شحن حاويات بين الميناء والمدينة بموازنة السرعة والغرامة.', en: 'Port-to-city container freight balancing speed and penalties.' },
    art: 'images/port-logistics.webp',
    startupCostCents: 2_500_000n, // $25,000
    baseHourlyCents: 1_750_000n, // $17,500/hr
    upgradeBaseCents: 2_100_000n,
    deepSimulationHref: '?industry=logistics',
    strategies: [
      {
        id: 'consolidated',
        title: { ar: 'النقل المجمّع الاقتصادي', en: 'Consolidated freight' },
        summary: { ar: 'سعة أكبر وتكلفة أقل لكل حاوية.', en: 'Higher truck fill rate at lower operating cost.' },
        incomeBps: 10_000,
      },
      {
        id: 'express-port',
        title: { ar: 'المسار السريع المضمون', en: 'Guaranteed express lane' },
        summary: { ar: 'صفر غرامات تأخير وعقود شحن مميزة (+٢٢٪ دخل).', en: 'Zero late penalties with priority port contracts (+22% income).' },
        incomeBps: 12_200,
      },
    ],
  },
  {
    id: 'property',
    name: { ar: 'العقار التشغيلي', en: 'Operating Property' },
    companyName: { ar: 'مجمع مستودعات المرسى', en: 'Marsa Logistics Park' },
    tagline: { ar: 'تشغيل وتأجير بوابات مستودعات تجارية بإيراد مستقر.', en: 'Operating commercial warehouse bays with high occupancy yields.' },
    art: 'images/warehouse-property.svg',
    startupCostCents: 7_500_000n, // $75,000
    baseHourlyCents: 5_200_000n, // $52,000/hr
    upgradeBaseCents: 6_200_000n,
    deepSimulationHref: '?industry=property',
    strategies: [
      {
        id: 'lease-operator',
        title: { ar: 'تشغيل بالإيجار المرن', en: 'Flexible lease operation' },
        summary: { ar: 'التزامات دين أقل ومرونة عالية عند الشغور.', en: 'Lower debt load with resilient cashflow during vacancy.' },
        incomeBps: 10_000,
      },
      {
        id: 'owned-hub',
        title: { ar: 'امتلاك كامل للمجمع', en: 'Full hub ownership' },
        summary: { ar: 'إيراد إيجاري صافٍ أعلى وبناء أصل دائم (+٢٨٪ دخل).', en: 'Higher net rental margin and long-term asset equity (+28% income).' },
        incomeBps: 12_800,
      },
    ],
  },
  {
    id: 'ai',
    name: { ar: 'الذكاء الاصطناعي', en: 'AI Compute Company' },
    companyName: { ar: 'مختبر الحوسبة السيادية', en: 'Sovereign Compute AI' },
    tagline: { ar: 'بنية GPU وعقود واجهة API متخصصة بعوائد متسارعة.', en: 'Dedicated GPU capacity and enterprise API inference contracts.' },
    art: 'images/ai-datacenter.webp',
    startupCostCents: 25_000_000n, // $250,000
    baseHourlyCents: 19_500_000n, // $195,000/hr
    upgradeBaseCents: 20_000_000n,
    deepSimulationHref: '?industry=ai',
    strategies: [
      {
        id: 'specialized-api',
        title: { ar: 'واجهة API متخصصة', en: 'Specialized API' },
        summary: { ar: 'فوترة حسب الاستخدام وانطلاقة سريعة بحوسبة مُدارة.', en: 'Usage-billed inference with lean managed compute.' },
        incomeBps: 10_000,
      },
      {
        id: 'sovereign-cloud',
        title: { ar: 'سحابة سيادية وعقود مؤسسية', en: 'Enterprise sovereign cloud' },
        summary: { ar: 'عقود سعة مضمونة طويلة الأمد (+٣٥٪ دخل).', en: 'Long-term reserved enterprise contracts (+35% income).' },
        incomeBps: 13_500,
      },
    ],
  },
];

export const FORBES_LIST: readonly ForbesEntry[] = [
  { id: 'f1', name: { ar: 'كريم المنصور', en: 'Karim Al-Mansour' }, industry: { ar: 'تجارة الأغذية', en: 'Food Trade' }, fortuneCents: 1_500_000n },
  { id: 'f2', name: { ar: 'ندى الشهابي', en: 'Nada Al-Shehabi' }, industry: { ar: 'التصنيع المتوسطي', en: 'Manufacturing' }, fortuneCents: 12_000_000n },
  { id: 'f3', name: { ar: 'طارق العلي', en: 'Tarek Al-Ali' }, industry: { ar: 'النقل البحري', en: 'Maritime Logistics' }, fortuneCents: 65_000_000n },
  { id: 'f4', name: { ar: 'ليلى فؤاد', en: 'Layla Fouad' }, industry: { ar: 'العقارات التجارية', en: 'Commercial Property' }, fortuneCents: 350_000_000n },
  { id: 'f5', name: { ar: 'سامي القاسمي', en: 'Sami Al-Qasimi' }, industry: { ar: 'التمويل والبنوك', en: 'Merchant Banking' }, fortuneCents: 1_800_000_000n },
  { id: 'f6', name: { ar: 'نور الهدى زيدان', en: 'Nour Zidan' }, industry: { ar: 'حوسبة الذكاء الاصطناعي', en: 'AI Infrastructure' }, fortuneCents: 9_500_000_000n },
  { id: 'f7', name: { ar: 'فيصل المرسى', en: 'Faisal Al-Marsa' }, industry: { ar: 'مجموعة قابضة عالمية', en: 'Global Holding' }, fortuneCents: 50_000_000_000n },
];

export function getTapTier(level: number): TapTier {
  return TAP_TIERS[Math.max(0, Math.min(TAP_TIERS.length - 1, level - 1))];
}

export function getSectorDef(id: BusinessSectorDef['id']): BusinessSectorDef {
  return BUSINESS_SECTORS.find((item) => item.id === id) ?? BUSINESS_SECTORS[0];
}
