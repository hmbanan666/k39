import type { AdmissionExtraRow, AdmissionRow } from '../../shared/admission'

export const admissionReviewNow = new Date('2026-10-23T12:00:00Z')
export function admissionEntry(patch: Partial<AdmissionRow> = {}): AdmissionRow {
  return { slot: 'adult', audience: 'general', priceRub: 500, condition: null, label: 'Фикстура: основной билет',
    sourceUrl: 'https://museum.example/prices', sourceTitle: 'Фикстура: официальный прейскурант', checkedAt: '2026-10-20', sortOrder: 0, ...patch }
}
export function admissionExtra(patch: Partial<AdmissionExtraRow> = {}): AdmissionExtraRow {
  return { ...admissionEntry(), kind: 'extra', audience: null, slot: 'audio', label: 'Фикстура: аудиогид', priceRub: 200, unit: 'device', ...patch }
}
export function admissionEditorFixture() {
  return { admission: [admissionEntry()], admissionExtras: [admissionExtra()], shownSlots: ['adult'], shownExtraSlots: ['audio'], extrasWriteEnabled: true, events: [] }
}
