import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import type { ProtocolDetailDto } from '../modules/protocols/protocols.types.js';

export type ExportLang = 'uz' | 'ru' | 'en';

interface TranslationMap {
  title: string;
  protocolInfoTitle: string;
  sampleInfoTitle: string;
  signaturesTitle: string;
  rejectionTitle: string;
  protocolId: string;
  protocolRole: string;
  protocolStatus: string;
  createdAt: string;
  mainFile: string;
  sampleType: string;
  substanceName: string;
  lotNumber: string;
  serialNumber: string;
  quantity: string;
  manufacturer: string;
  colAction: string;
  colUser: string;
  colRole: string;
  colDate: string;
  colHash: string;
  noSignatures: string;
  roles: Record<string, string>;
  statuses: Record<string, string>;
  protocolRoles: Record<string, string>;
  sampleTypes: Record<string, string>;
  actions: Record<string, string>;
}

const I18N: Record<ExportLang, TranslationMap> = {
  uz: {
    title: 'TAHLIL BAYONNOMASI (PROTOKOL)',
    protocolInfoTitle: '1. Protokol ma‘lumotlari',
    sampleInfoTitle: '2. Namuna ma‘lumotlari',
    signaturesTitle: '3. Elektron imzolar tarixi',
    rejectionTitle: 'Rad etish sababi',
    protocolId: 'Protokol ID',
    protocolRole: 'Protokol turi',
    protocolStatus: 'Holati',
    createdAt: 'Yaratilgan sana',
    mainFile: 'Asosiy tahlil fayli',
    sampleType: 'Namuna turi',
    substanceName: 'Modda nomi',
    lotNumber: 'Partiya (lot) raqami',
    serialNumber: 'Seriya raqami',
    quantity: 'Miqdori',
    manufacturer: 'Ishlab chiqaruvchi',
    colAction: 'Harakat / Bosqich',
    colUser: 'F.I.SH.',
    colRole: 'Rol',
    colDate: 'Sana va vaqt',
    colHash: 'Imzo xeshi (yaxlitlik izi)',
    noSignatures: 'Imzolar mavjud emas',
    roles: {
      chemist: 'Kimyogar-tahlilchi',
      lab_head: 'Laboratoriya mudiri',
      director: 'Direktor',
      admin: 'Administrator',
      kontrolyor: 'Sifat nazoratchisi',
      super_admin: 'Super Admin',
    },
    statuses: {
      draft: 'Qoralama (Draft)',
      submitted: 'Yuborilgan (Submitted)',
      approved: 'Tasdiqlangan (Approved)',
      rejected: 'Rad etilgan (Rejected)',
      finalized: 'Yakunlangan (Finalized)',
    },
    protocolRoles: {
      standard: 'Standart tahlil',
      final: 'Yakuniy tahlil',
      in_process: 'Oraliq tahlil',
    },
    sampleTypes: {
      raw_material: 'Xom ashyo (Raw material)',
      finished_product: 'Tayyor mahsulot (Finished product)',
      reagent: 'Reagent',
      standard_substance: 'Standart namuna (Standard substance)',
      other: 'Boshqa (Other)',
    },
    actions: {
      submitted: 'Yuborildi',
      approved: 'Tasdiqlandi',
      rejected: 'Rad etildi',
      finalized: 'Yakunlandi',
    },
  },
  ru: {
    title: 'ПРОТОКОЛ АНАЛИЗА',
    protocolInfoTitle: '1. Сведения о протоколе',
    sampleInfoTitle: '2. Сведения об образце',
    signaturesTitle: '3. История электронных подписей',
    rejectionTitle: 'Причина отклонения',
    protocolId: 'ID протокола',
    protocolRole: 'Тип протокола',
    protocolStatus: 'Статус',
    createdAt: 'Дата создания',
    mainFile: 'Основной файл анализа',
    sampleType: 'Тип образца',
    substanceName: 'Наименование вещества',
    lotNumber: 'Номер партии (лот)',
    serialNumber: 'Серийный номер',
    quantity: 'Количество',
    manufacturer: 'Производитель',
    colAction: 'Действие / Этап',
    colUser: 'Ф.И.О.',
    colRole: 'Роль',
    colDate: 'Дата и время',
    colHash: 'Хэш подписи (след целостности)',
    noSignatures: 'Подписи отсутствуют',
    roles: {
      chemist: 'Химик-аналитик',
      lab_head: 'Заведующий лабораторией',
      director: 'Директор',
      admin: 'Администратор',
      kontrolyor: 'Контролер качества',
      super_admin: 'Супер Админ',
    },
    statuses: {
      draft: 'Черновик (Draft)',
      submitted: 'На рассмотрении (Submitted)',
      approved: 'Утвержден (Approved)',
      rejected: 'Отклонен (Rejected)',
      finalized: 'Завершен (Finalized)',
    },
    protocolRoles: {
      standard: 'Стандартный анализ',
      final: 'Окончательный анализ',
      in_process: 'Промежуточный анализ',
    },
    sampleTypes: {
      raw_material: 'Сырье (Raw material)',
      finished_product: 'Готовая продукция (Finished product)',
      reagent: 'Реактив',
      standard_substance: 'Стандартное вещество (Standard substance)',
      other: 'Прочее (Other)',
    },
    actions: {
      submitted: 'Отправлен',
      approved: 'Утвержден',
      rejected: 'Отклонен',
      finalized: 'Завершен',
    },
  },
  en: {
    title: 'ANALYSIS PROTOCOL',
    protocolInfoTitle: '1. Protocol Details',
    sampleInfoTitle: '2. Sample Details',
    signaturesTitle: '3. Digital Signatures History',
    rejectionTitle: 'Rejection Reason',
    protocolId: 'Protocol ID',
    protocolRole: 'Protocol Role',
    protocolStatus: 'Status',
    createdAt: 'Created At',
    mainFile: 'Main Analysis File',
    sampleType: 'Sample Type',
    substanceName: 'Substance Name',
    lotNumber: 'Lot Number',
    serialNumber: 'Serial Number',
    quantity: 'Quantity',
    manufacturer: 'Manufacturer',
    colAction: 'Action / Stage',
    colUser: 'Full Name',
    colRole: 'Role',
    colDate: 'Date & Time',
    colHash: 'Signature Hash (Integrity Trace)',
    noSignatures: 'No signatures recorded',
    roles: {
      chemist: 'Chemist',
      lab_head: 'Head of Laboratory',
      director: 'Director',
      admin: 'Administrator',
      kontrolyor: 'Quality Inspector',
      super_admin: 'Super Admin',
    },
    statuses: {
      draft: 'Draft',
      submitted: 'Submitted',
      approved: 'Approved',
      rejected: 'Rejected',
      finalized: 'Finalized',
    },
    protocolRoles: {
      standard: 'Standard Analysis',
      final: 'Final Analysis',
      in_process: 'In-Process Analysis',
    },
    sampleTypes: {
      raw_material: 'Raw Material',
      finished_product: 'Finished Product',
      reagent: 'Reagent',
      standard_substance: 'Standard Substance',
      other: 'Other',
    },
    actions: {
      submitted: 'Submitted',
      approved: 'Approved',
      rejected: 'Rejected',
      finalized: 'Finalized',
    },
  },
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  } catch {
    return iso;
  }
}

function createKeyValueRow(key: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 3000, type: WidthType.DXA },
        children: [
          new Paragraph({
            children: [new TextRun({ text: key, bold: true, size: 20 })],
          }),
        ],
      }),
      new TableCell({
        width: { size: 6000, type: WidthType.DXA },
        children: [
          new Paragraph({
            children: [new TextRun({ text: value, size: 20 })],
          }),
        ],
      }),
    ],
  });
}

export async function generateProtocolDocx(
  protocol: ProtocolDetailDto,
  sampleExtra: {
    lotNumber?: string | null;
    serialNumber?: string | null;
    quantity?: string | null;
    manufacturer?: string | null;
  },
  lang: ExportLang = 'uz',
): Promise<Buffer> {
  const dict = I18N[lang] ?? I18N.uz;

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Sarlavha
          new Paragraph({
            text: dict.title,
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
          }),

          // 1. Protokol ma'lumotlari
          new Paragraph({
            text: dict.protocolInfoTitle,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 150 },
          }),
          new Table({
            width: { size: 9000, type: WidthType.DXA },
            rows: [
              createKeyValueRow(dict.protocolId, protocol.id),
              createKeyValueRow(
                dict.protocolRole,
                dict.protocolRoles[protocol.protocolRole] ?? protocol.protocolRole,
              ),
              createKeyValueRow(
                dict.protocolStatus,
                dict.statuses[protocol.status] ?? protocol.status,
              ),
              createKeyValueRow(dict.createdAt, formatDate(protocol.createdAt)),
              createKeyValueRow(
                dict.mainFile,
                protocol.fileName ? `${protocol.fileName} (${protocol.fileSize ? `${Math.round(protocol.fileSize / 1024)} KB` : ''})` : '—',
              ),
            ],
          }),

          // Rad etish sababi (agar bo'lsa)
          ...(protocol.rejectionReason
            ? [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${dict.rejectionTitle}: `,
                      bold: true,
                      color: 'B91C1C',
                    }),
                    new TextRun({
                      text: protocol.rejectionReason,
                      italics: true,
                    }),
                  ],
                  spacing: { before: 150, after: 150 },
                }),
              ]
            : []),

          // 2. Namuna ma'lumotlari (D-84: NAMUNA KODI YO'Q)
          new Paragraph({
            text: dict.sampleInfoTitle,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
          }),
          new Table({
            width: { size: 9000, type: WidthType.DXA },
            rows: [
              createKeyValueRow(
                dict.sampleType,
                dict.sampleTypes[protocol.sampleType] ?? protocol.sampleType,
              ),
              createKeyValueRow(dict.substanceName, protocol.sampleSubstanceName || '—'),
              createKeyValueRow(dict.lotNumber, sampleExtra.lotNumber || '—'),
              createKeyValueRow(dict.serialNumber, sampleExtra.serialNumber || '—'),
              createKeyValueRow(dict.quantity, sampleExtra.quantity || '—'),
              createKeyValueRow(dict.manufacturer, sampleExtra.manufacturer || '—'),
            ],
          }),

          // 3. Imzolar tarixi
          new Paragraph({
            text: dict.signaturesTitle,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 },
          }),

          ...(protocol.signatures.length === 0
            ? [
                new Paragraph({
                  text: dict.noSignatures,
                  spacing: { after: 200 },
                }),
              ]
            : [
                new Table({
                  width: { size: 9000, type: WidthType.DXA },
                  rows: [
                    new TableRow({
                      tableHeader: true,
                      children: [
                        new TableCell({
                          width: { size: 1500, type: WidthType.DXA },
                          children: [
                            new Paragraph({
                              children: [new TextRun({ text: dict.colAction, bold: true, size: 18 })],
                            }),
                          ],
                        }),
                        new TableCell({
                          width: { size: 2000, type: WidthType.DXA },
                          children: [
                            new Paragraph({
                              children: [new TextRun({ text: dict.colUser, bold: true, size: 18 })],
                            }),
                          ],
                        }),
                        new TableCell({
                          width: { size: 1800, type: WidthType.DXA },
                          children: [
                            new Paragraph({
                              children: [new TextRun({ text: dict.colRole, bold: true, size: 18 })],
                            }),
                          ],
                        }),
                        new TableCell({
                          width: { size: 1700, type: WidthType.DXA },
                          children: [
                            new Paragraph({
                              children: [new TextRun({ text: dict.colDate, bold: true, size: 18 })],
                            }),
                          ],
                        }),
                        new TableCell({
                          width: { size: 2000, type: WidthType.DXA },
                          children: [
                            new Paragraph({
                              children: [new TextRun({ text: dict.colHash, bold: true, size: 16 })],
                            }),
                          ],
                        }),
                      ],
                    }),
                    ...protocol.signatures.map(
                      (sig) =>
                        new TableRow({
                          children: [
                            new TableCell({
                              children: [
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: dict.actions[sig.action] ?? sig.action,
                                      size: 18,
                                    }),
                                  ],
                                }),
                              ],
                            }),
                            new TableCell({
                              children: [
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: sig.userFullName || '—',
                                      size: 18,
                                    }),
                                  ],
                                }),
                              ],
                            }),
                            new TableCell({
                              children: [
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: dict.roles[sig.role] ?? sig.role,
                                      size: 18,
                                    }),
                                  ],
                                }),
                              ],
                            }),
                            new TableCell({
                              children: [
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: formatDate(sig.signedAt),
                                      size: 18,
                                    }),
                                  ],
                                }),
                              ],
                            }),
                            new TableCell({
                              children: [
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: sig.signatureHash ? `${sig.signatureHash.slice(0, 16)}...` : '—',
                                      size: 14,
                                    }),
                                  ],
                                }),
                              ],
                            }),
                          ],
                        }),
                    ),
                  ],
                }),
              ]),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
