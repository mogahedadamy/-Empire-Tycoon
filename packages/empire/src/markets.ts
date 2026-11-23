/** Fictional investment markets (stocks, real estate with explicit ROI, digital assets) and luxury showroom catalog. */
import type { DigitalAssetDef, LuxuryItemDef, RealEstateDef, StockDef } from './types';

export const STOCKS_CATALOG: readonly StockDef[] = [
  { id: 'st-sunbul', ticker: 'SNBL', name: { ar: 'أسواق السنبل القابضة', en: 'Al-Sunbul Markets' }, sector: { ar: 'تجزئة أغذية', en: 'Food Retail' }, basePriceCents: 4_800n, dividendBpsPerHour: 18, totalShares: 500, volatilityBps: 450, phase: 0 },
  { id: 'st-harbor', ticker: 'HRBR', name: { ar: 'خطوط شحن المرسى', en: 'Marsa Shipping Co.' }, sector: { ar: 'لوجستيات', en: 'Logistics' }, basePriceCents: 11_500n, dividendBpsPerHour: 22, totalShares: 500, volatilityBps: 600, phase: 2 },
  { id: 'st-oak', ticker: 'OAKM', name: { ar: 'مصانع السنديان', en: 'Oakwood Industrial' }, sector: { ar: 'تصنيع', en: 'Manufacturing' }, basePriceCents: 24_000n, dividendBpsPerHour: 25, totalShares: 400, volatilityBps: 520, phase: 4 },
  { id: 'st-bay', ticker: 'BAYP', name: { ar: 'صندوق عقار الخليج', en: 'Bayfront REIT' }, sector: { ar: 'عقار تجاري', en: 'Real Estate' }, basePriceCents: 42_000n, dividendBpsPerHour: 32, totalShares: 400, volatilityBps: 350, phase: 1 },
  { id: 'st-volt', ticker: 'VOLT', name: { ar: 'طاقة الساحل النظيفة', en: 'Coastal Grid Power' }, sector: { ar: 'طاقة وبنية', en: 'Energy' }, basePriceCents: 78_000n, dividendBpsPerHour: 28, totalShares: 300, volatilityBps: 680, phase: 5 },
  { id: 'st-noor', ticker: 'NOOR', name: { ar: 'نور للحوسبة السحابية', en: 'Noor Cloud Compute' }, sector: { ar: 'ذكاء اصطناعي', en: 'AI Cloud' }, basePriceCents: 165_000n, dividendBpsPerHour: 30, totalShares: 250, volatilityBps: 900, phase: 3 },
];

export const REAL_ESTATE_CATALOG: readonly RealEstateDef[] = [
  { id: 're-studio', name: { ar: 'شقة استوديو الميناء', en: 'Harbor Studio Loft' }, location: { ar: 'حي المرسى القديم', en: 'Old Harbor Quarter' }, priceCents: 800_000n, hourlyRentCents: 42_000n, art: 'images/warehouse-property.svg' },
  { id: 're-shop', name: { ar: 'متجر شارع السنابل', en: 'Sanabel High-Street Shop' }, location: { ar: 'وسط وادي المرسى', en: 'Central Wadi Al-Marsa' }, priceCents: 2_800_000n, hourlyRentCents: 165_000n, art: 'images/produce-terminal.webp' },
  { id: 're-workshop', name: { ar: 'مبنى الورش الحرفية', en: 'Artisan Timber Hall' }, location: { ar: 'المنطقة الصناعية', en: 'Craft District' }, priceCents: 9_500_000n, hourlyRentCents: 610_000n, art: 'images/light-factory.webp' },
  { id: 're-depot', name: { ar: 'محطة تبريد وتخزين', en: 'Cold-Chain Logistics Hub' }, location: { ar: 'رصيف الشحن الغربي', en: 'West Freight Quay' }, priceCents: 32_000_000n, hourlyRentCents: 2_250_000n, art: 'images/port-logistics.webp' },
  { id: 're-campus', name: { ar: 'مجمع المكاتب الزجاجي', en: 'Marina Glass Campus' }, location: { ar: 'كورنيش المرسى', en: 'Marina Corniche' }, priceCents: 120_000_000n, hourlyRentCents: 9_200_000n, art: 'images/ai-datacenter.webp' },
  { id: 're-tower', name: { ar: 'برج المرسى المالي', en: 'Marsa Financial Tower' }, location: { ar: 'قلب الحي المالي', en: 'Financial Center' }, priceCents: 480_000_000n, hourlyRentCents: 41_000_000n, art: 'images/ai-datacenter.webp' },
];

export const DIGITAL_ASSETS_CATALOG: readonly DigitalAssetDef[] = [
  { id: 'da-mars', symbol: 'MARS', name: { ar: 'عملة المرسى الرقمية', en: 'Marsa Coin' }, basePriceCents: 12_000n, volatilityBps: 1_800, phase: 0, marketCapBillions: 48 },
  { id: 'da-ethr', symbol: 'ETHR', name: { ar: 'شبكة إيثيرا العقود', en: 'Ethera Chain' }, basePriceCents: 285_000n, volatilityBps: 1_450, phase: 2, marketCapBillions: 190 },
  { id: 'da-solx', symbol: 'SOLX', name: { ar: 'سولار إكس السريعة', en: 'SolarX Protocol' }, basePriceCents: 16_800n, volatilityBps: 2_100, phase: 4, marketCapBillions: 64 },
  { id: 'da-cptx', symbol: 'CPTX', name: { ar: 'رمز حوسبة الذكاء', en: 'ComputeX Token' }, basePriceCents: 6_400n, volatilityBps: 2_400, phase: 1, marketCapBillions: 29 },
  { id: 'da-gldx', symbol: 'GLDX', name: { ar: 'مؤشر الذهب الرقمي', en: 'Digital Gold Index' }, basePriceCents: 235_000n, volatilityBps: 620, phase: 3, marketCapBillions: 310 },
];

export const LUXURY_ITEMS_CATALOG: readonly LuxuryItemDef[] = [
  { id: 'it-car-1', category: 'cars', name: { ar: 'كوبيه رياضية ساحلية', en: 'Coastal GT Coupe' }, detail: { ar: 'مرآب التنفيذيين · فئة أولى', en: 'Executive Garage · Entry GT' }, priceCents: 4_500_000n },
  { id: 'it-car-2', category: 'cars', name: { ar: 'ليموزين إمباير المصفّحة', en: 'Empire Sovereign Saloon' }, detail: { ar: 'مرآب التنفيذيين · رفاهية', en: 'Executive Garage · Chauffeur Flagship' }, priceCents: 18_500_000n },
  { id: 'it-car-3', category: 'cars', name: { ar: 'هايبركار المرسى النادرة', en: 'Marsa Carbon Hypercar' }, detail: { ar: 'إصدار محدود · 12 نسخة', en: 'Limited Edition · 12 Built' }, priceCents: 140_000_000n },
  { id: 'it-jet-1', category: 'aircraft', name: { ar: 'طائرة رجال أعمال خفيفة', en: 'Horizon Light Jet' }, detail: { ar: 'حظيرة الطائرات · مدى إقليمي', en: 'Private Hangar · Regional Range' }, priceCents: 85_000_000n },
  { id: 'it-jet-2', category: 'aircraft', name: { ar: 'جيت عابرة للقارات', en: 'Sovereign Intercontinental Jet' }, detail: { ar: 'حظيرة الطائرات · مدى عالمي', en: 'Private Hangar · Global Range' }, priceCents: 450_000_000n },
  { id: 'it-yacht-1', category: 'yachts', name: { ar: 'يخت الخليج السريع', en: 'Harbor Cruiser 65ft' }, detail: { ar: 'مرسى اليخوت · 4 كبائن', en: 'Private Marina · 4 Cabins' }, priceCents: 65_000_000n },
  { id: 'it-yacht-2', category: 'yachts', name: { ar: 'سوبر يخت المرسى الملكي', en: 'Royal Marsa Superyacht' }, detail: { ar: 'مرسى اليخوت · مهبط مروحية', en: 'Private Marina · Helipad' }, priceCents: 680_000_000n },
  { id: 'it-art-1', category: 'collections', name: { ar: 'مجموعة عملات تاريخية نادرة', en: 'Rare Maritime Coin Set' }, detail: { ar: 'خزنة المقتنيات · معتمدة', en: 'Vault Collection · Certified' }, priceCents: 12_000_000n },
  { id: 'it-art-2', category: 'collections', name: { ar: 'لوحة غروب الميناء الأصلية', en: 'Harbor Sunset Masterpiece' }, detail: { ar: 'معرض الفن الخاص', en: 'Private Fine Art Gallery' }, priceCents: 95_000_000n },
  { id: 'it-res-1', category: 'residence', name: { ar: 'فيلا تلة وادي المرسى', en: 'Wadi Al-Marsa Cliff Villa' }, detail: { ar: 'المقر السكني · إطلالة بحرية', en: 'Private Residence · Sea View' }, priceCents: 120_000_000n },
  { id: 'it-res-2', category: 'residence', name: { ar: 'جزيرة المرسى الخاصة', en: 'Private Marsa Island Estate' }, detail: { ar: 'المقر الملكي · مرسى ومطار', en: 'Sovereign Island · Runway & Pier' }, priceCents: 1_500_000_000n },
];

/** Deterministic multi-harmonic wave returning a price in exact USD cents for any market tick. */
export function quoteMarketPrice(baseCents: bigint, volatilityBps: number, phase: number, tick: number): bigint {
  const angle1 = (tick + phase * 3) * 0.55;
  const angle2 = (tick + phase * 7) * 0.19;
  const wave = Math.sin(angle1) * 0.65 + Math.cos(angle2) * 0.35;
  const deltaBps = Math.round(wave * volatilityBps);
  const factor = BigInt(Math.max(3_500, 10_000 + deltaBps));
  return (baseCents * factor) / 10_000n;
}

export function quoteDeltaBps(baseCents: bigint, volatilityBps: number, phase: number, tick: number): number {
  const now = quoteMarketPrice(baseCents, volatilityBps, phase, tick);
  const prev = quoteMarketPrice(baseCents, volatilityBps, phase, Math.max(0, tick - 1));
  if (prev <= 0n) return 0;
  return Number(((now - prev) * 10_000n) / prev);
}

/** Annualized hourly-yield ROI percentage in basis points for a real estate property. */
export function propertyHourlyYieldBps(item: RealEstateDef): number {
  if (item.priceCents <= 0n) return 0;
  return Number((item.hourlyRentCents * 10_000n) / item.priceCents);
}
