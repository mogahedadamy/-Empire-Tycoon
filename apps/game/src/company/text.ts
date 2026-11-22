/** Bilingual company workflow, ledger and forecast labels. */
import type { Locale } from '../../../../packages/ui/src';
import { copy as shared } from '../copy';

const ar = {
  overview: 'الملخص', business: 'الشركة', contracts: 'العقود', finance: 'المالية',
  overviewTitle: 'لوحة قيادة الشركة', businessTitle: 'إدارة الشركة', contractsTitle: 'العقود والفواتير',
  financeTitle: 'المراجعة المالية', day: 'اليوم', checkpoint: 'نقطة مراجعة التسليم',
  nextDay: 'تقديم يوم التسليم', cash: 'النقد الدفتري', receivables: 'ذمم العملاء',
  profit: 'صافي الربح إلى اليوم', cashSource: 'تتبّع قيود النقد', openInvoices: 'عرض الفواتير',
  analysis: 'توقع السيولة · 30 يومًا', predicted: 'متوقع', confirmed: 'مؤكد',
  baseline: 'الأساسي', optimistic: 'المتفائل', pessimistic: 'المتشائم', forecastData: 'جدول قيم التوقع',
  nextDates: 'الاستحقاقات القادمة', noDates: 'لا توجد استحقاقات في نافذة التوقع.',
  payroll: 'الأجور', rent: 'الإيجار', utilities: 'المرافق', principal: 'أصل القرض', interest: 'الفائدة',
  tax: 'الضريبة', purchase: 'شراء المخزون', invoice: 'فاتورة عميل', credit: 'ائتمان',
  supplier: 'المورد', warehouse: 'مستودع التوزيع', stock: 'المخزون', onHand: 'الموجود بالمستودع', availableStock: 'متاح دون حجز',
  reserved: 'محجوز', bookValue: 'القيمة الدفترية', dispatch: 'الطاقة المتبقية اليوم',
  labor: 'العمالة', equipment: 'المعدات', materials: 'المخزون', shipping: 'الشحن',
  companySetup: 'معاينة التأسيس', contractTerms: 'الطلب الكبير', customer: 'العميل',
  rate: 'سعر الصندوق', ordered: 'المطلوب', fulfilled: 'المسلّم', remaining: 'المتبقي',
  payDue: 'موعد التحصيل', deliveryWindow: 'نافذة التسليم', numberOfBoxes: 'الكمية',
  preview: 'معاينة التسليم', confirm: 'تأكيد التسليم', review: 'راجع التغييرات',
  requested: 'الكمية المختارة', maximum: 'الحد المتاح', invoiceAmount: 'قيمة الفاتورة المتوقعة',
  previewChanged: 'تغيّرت حالة الشركة منذ المعاينة. راجع الفرق ثم أكّد من جديد.',
  before: 'قبل', after: 'الآن', invalidQuantity: 'اختر كمية صحيحة ضمن الحد المتاح.',
  pending: 'جارٍ استلام الإقرار…', accepted: 'أُقر التسليم وصدرت الفاتورة',
  rejected: 'تعذّر التسليم. حدّث المعاينة وراجع الكمية.',
  completed: 'اكتمل تسليم هذا العقد.', invoices: 'الفواتير المصدرة', amount: 'المبلغ',
  issued: 'تاريخ الإصدار', source: 'المصدر', salesEntry: 'قيد المبيعات', stockEntry: 'قيد تكلفة المخزون',
  paymentEntry: 'قيد التحصيل', open: 'مفتوحة', overdue: 'متأخرة', paid: 'محصّلة',
  income: 'الأرباح والخسائر', balance: 'الميزانية', flow: 'التدفق النقدي', ledger: 'دفتر الأستاذ',
  account: 'الحساب', entry: 'القيد', side: 'الطرف', debit: 'مدين', creditSide: 'دائن',
  close: 'إغلاق', viewEntry: 'عرض القيد', allEntries: 'كل القيود', cashEntries: 'قيود النقد',
  noEntries: 'لا توجد قيود لهذا الحساب في الفترة.', netIncome: 'صافي الربح', assets: 'الأصول',
  liabilities: 'الخصوم', equity: 'حقوق الملكية', operating: 'التشغيل', investing: 'الاستثمار', financing: 'التمويل',
  noInvoice: 'ستظهر الفواتير بعد تسليم الطلب.', projectedWarning: 'عجز نقدي متوقع',
  payrollWarning: 'الأجور قبل التحصيل', overdueWarning: 'فاتورة متأخرة',
};
const en: Record<keyof typeof ar, string> = {
  overview: 'Overview', business: 'Company', contracts: 'Contracts', finance: 'Finance',
  overviewTitle: 'Company dashboard', businessTitle: 'Manage the company', contractsTitle: 'Contracts & invoices',
  financeTitle: 'Financial review', day: 'Day', checkpoint: 'Delivery review checkpoint',
  nextDay: 'Advance delivery day', cash: 'Ledger cash', receivables: 'Receivables',
  profit: 'Net income to date', cashSource: 'Trace cash entries', openInvoices: 'View invoices',
  analysis: '30-day cash forecast', predicted: 'Projected', confirmed: 'Confirmed',
  baseline: 'Baseline', optimistic: 'Optimistic', pessimistic: 'Pessimistic', forecastData: 'Forecast data table',
  nextDates: 'Upcoming cash movements', noDates: 'No cash movements in the forecast window.',
  payroll: 'Payroll', rent: 'Rent', utilities: 'Utilities', principal: 'Loan principal', interest: 'Interest',
  tax: 'Tax', purchase: 'Stock purchase', invoice: 'Customer invoice', credit: 'Credit',
  supplier: 'Supplier', warehouse: 'Distribution hub', stock: 'Inventory', onHand: 'On hand', availableStock: 'Unreserved stock',
  reserved: 'Reserved', bookValue: 'Book value', dispatch: 'Remaining capacity today',
  labor: 'Labor', equipment: 'Equipment', materials: 'Stock', shipping: 'Shipping',
  companySetup: 'Founding preview', contractTerms: 'The Big Order', customer: 'Customer',
  rate: 'Price per box', ordered: 'Ordered', fulfilled: 'Delivered', remaining: 'Remaining',
  payDue: 'Payment due', deliveryWindow: 'Delivery window', numberOfBoxes: 'Quantity',
  preview: 'Preview delivery', confirm: 'Confirm delivery', review: 'Review changes',
  requested: 'Selected quantity', maximum: 'Available to deliver', invoiceAmount: 'Expected invoice',
  previewChanged: 'The company changed after this preview. Review the differences before confirming again.',
  before: 'Before', after: 'Now', invalidQuantity: 'Enter a whole quantity within the available limit.',
  pending: 'Waiting for acknowledgement…', accepted: 'Delivery acknowledged and invoice issued',
  rejected: 'The delivery was declined. Refresh the preview and check the quantity.',
  completed: 'This contract is fully delivered.', invoices: 'Issued invoices', amount: 'Amount',
  issued: 'Issue date', source: 'Source', salesEntry: 'Sales entry', stockEntry: 'Cost of inventory entry',
  paymentEntry: 'Collection entry', open: 'Open', overdue: 'Overdue', paid: 'Paid',
  income: 'Profit & loss', balance: 'Balance sheet', flow: 'Cash flow', ledger: 'General ledger',
  account: 'Account', entry: 'Entry', side: 'Side', debit: 'Debit', creditSide: 'Credit',
  close: 'Close', viewEntry: 'View entry', allEntries: 'All entries', cashEntries: 'Cash entries',
  noEntries: 'No entries for this account in the period.', netIncome: 'Net income', assets: 'Assets',
  liabilities: 'Liabilities', equity: 'Equity', operating: 'Operating', investing: 'Investing', financing: 'Financing',
  noInvoice: 'Invoices appear after a delivery.', projectedWarning: 'Projected cash shortfall',
  payrollWarning: 'Payroll precedes collection', overdueWarning: 'Overdue invoice',
};
export function companyText(locale: Locale) {
  return { ...shared[locale], ...(locale === 'ar' ? ar : en) };
}

const accountNames: Record<string, readonly [string, string]> = {
  cash: ['النقد', 'Cash'], receivables: ['ذمم العملاء', 'Receivables'], inventory: ['المخزون', 'Inventory'],
  rentalDeposits: ['تأمين الإيجار', 'Rental deposits'], equipment: ['المعدات', 'Equipment'],
  accumulatedDepreciation: ['مجمع الإهلاك', 'Accumulated depreciation'], supplierPayables: ['ذمم الموردين', 'Suppliers payable'],
  loanPrincipal: ['أصل القرض', 'Loan principal'], payrollPayable: ['أجور مستحقة', 'Payroll payable'],
  utilitiesPayable: ['مرافق مستحقة', 'Utilities payable'], rentPayable: ['إيجار مستحق', 'Rent payable'],
  interestPayable: ['فائدة مستحقة', 'Interest payable'], taxPayable: ['ضريبة مستحقة', 'Tax payable'],
  contributedCapital: ['رأس المال', 'Contributed capital'], sales: ['المبيعات', 'Sales'],
  salesDiscounts: ['خصم المبيعات', 'Sales discounts'], costOfSales: ['تكلفة المبيعات', 'Cost of sales'],
  payrollExpense: ['مصروف الأجور', 'Payroll expense'], utilitiesExpense: ['مصروف المرافق', 'Utilities expense'],
  rentExpense: ['مصروف الإيجار', 'Rent expense'], depreciationExpense: ['مصروف الإهلاك', 'Depreciation expense'],
  inventorySpoilageExpense: ['مصروف التلف', 'Inventory spoilage'], interestExpense: ['مصروف الفائدة', 'Interest expense'],
  taxExpense: ['مصروف الضريبة', 'Tax expense'],
};

export function accountName(id: string, locale: Locale) {
  return accountNames[id]?.[locale === 'ar' ? 0 : 1] ?? id;
}
