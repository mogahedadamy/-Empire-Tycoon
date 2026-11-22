/** Explains save recovery and compatibility results in the selected interface language. */
import type { Locale } from '../../../../packages/ui/src';
import type { SaveNotice } from './storage';

export function saveMessage(locale: Locale, notice: SaveNotice): string {
  const ar = locale === 'ar';
  switch (notice.kind) {
    case 'saving':
      return ar ? 'جارٍ حفظ التقدم محليًا…' : 'Saving progress on this device…';
    case 'saved':
      return ar ? 'حُفظ التقدم محليًا.' : 'Progress saved on this device.';
    case 'recovered':
      return ar ? 'استُعيد آخر حفظ صالح بعد تعذّر قراءة الحفظ الأحدث.' :
        'The latest save could not be read. The last valid checkpoint was recovered.';
    case 'write-conflict':
      return ar ? 'يوجد حفظ أحدث في تبويب آخر. أعد تحميل الصفحة لاستئنافه.' :
        'Another tab has a newer save. Reload this page to resume it.';
    case 'future-schema':
    case 'future-ruleset':
    case 'future-content':
    case 'unsupported-version': {
      const labels = ar
        ? { 'future-schema': 'صيغة الحفظ', 'future-ruleset': 'القواعد', 'future-content': 'المحتوى', 'unsupported-version': 'مكوّن الحفظ' }
        : { 'future-schema': 'save format', 'future-ruleset': 'ruleset', 'future-content': 'content', 'unsupported-version': 'save component' };
      const message = labels[notice.kind];
      return ar ? `إصدار ${message} في الملف ${notice.found}، والإصدار المدعوم ${notice.supported}. تعذّر الاستئناف.` :
        `The saved ${message} is version ${notice.found}. This app supports version ${notice.supported}. Resume unavailable.`;
    }
    case 'invalid-save':
      return ar ? 'تعذّر العثور على نقطة حفظ صالحة.' : 'No valid checkpoint could be restored.';
    case 'unavailable':
      return ar ? 'التخزين المحلي غير متاح الآن. قد لا يُحفظ التقدم.' : 'Local storage is unavailable. Progress may be unsaved.';
  }
}
