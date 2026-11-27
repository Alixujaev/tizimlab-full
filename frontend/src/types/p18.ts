/** P18 (D-179..D-189): AI-OCR yordamchi, protokollar ro'yxati, peak fayllar, harorat taklifi, yagona tarix. */

import type { ProtocolRole, ProtocolStatus } from './index';

// ---------------------------------------------------------------- AI
export interface AiStatusDto {
  /** UI tugmalari faqat `enabled=true` bo'lsa ko'rinadi. */
  enabled: boolean;
  configured: boolean;
  companyEnabled: boolean;
  dailyLimit: number;
  usedToday: number;
  maxFileMb: number;
}

export type AiConfidence = 'high' | 'medium' | 'low';
export type AiImageQuality = 'good' | 'poor' | 'unreadable';
export type AiExtractionStatus = 'ok' | 'failed' | 'rejected';
export type AiDocumentKind = 'sample' | 'reagent';

export interface AiFieldValue {
  value: string | number | null;
  confidence: AiConfidence | null;
}

export interface AiCatalogSuggestion {
  id: string;
  name: string;
  unitFamily: string;
  score: number;
  exact: boolean;
}

export interface AiExtractionDto {
  extractionId: string;
  kind: AiDocumentKind;
  status: AiExtractionStatus;
  imageQuality: AiImageQuality | null;
  errorCode: string | null;
  fields: Record<string, AiFieldValue>;
  catalogSuggestions: AiCatalogSuggestion[];
}

export type NdSkipReason =
  'not_in_catalog' | 'unknown_unit' | 'unit_mismatch' | 'invalid_quantity' | 'empty' | 'duplicate';

export interface NdSkippedDto {
  kind: 'equipment' | 'reagent';
  name: string | null;
  quantity: string | null;
  unit: string | null;
  methodName: string | null;
  reason: NdSkipReason;
  suggestions: AiCatalogSuggestion[];
}

export interface NdExtractionDto {
  extractionId: string;
  status: AiExtractionStatus;
  imageQuality: AiImageQuality | null;
  errorCode: string | null;
  createdIds: string[];
  skipped: NdSkippedDto[];
}

/** Namuna/reaktiv yaratishda AI ekstraksiyasiga havola (D-181). */
export interface AiReviewRef {
  extractionId: string;
}

// ---------------------------------------------------------------- Protokollar ro'yxati (D-187)
export interface ProtocolListItemDto {
  id: string;
  sampleId: string;
  substanceName: string;
  serialNumber: string | null;
  lotNumber: string | null;
  sampleType: string;
  status: ProtocolStatus;
  protocolRole: ProtocolRole;
  chemistId: string | null;
  chemistName: string | null;
  equipmentId: string | null;
  equipmentName: string | null;
  analysisDate: string | null;
  date: string;
  submittedAt: string | null;
  approvedAt: string | null;
  fileName: string | null;
  peakFiles: { id: string; fileName: string }[];
  rejectionCount: number;
}

export interface ProtocolListParams {
  page?: number;
  limit?: number;
  substanceName?: string;
  series?: string;
  dateFrom?: string;
  dateTo?: string;
  chemistId?: string;
  /** uuid yoki `unknown` — apparati ko'rsatilmagan */
  equipmentId?: string;
  status?: ProtocolStatus;
  hasPeaks?: 'true';
}

export interface ProtocolRejectionDto {
  id: string;
  reason: string;
  rejectedBy: string | null;
  rejectedByName: string | null;
  rejectedAt: string;
}

// ---------------------------------------------------------------- Harorat taklifi (D-188)
export interface TemperatureSuggestionDto {
  analysisDate: string;
  sensorConfigId: string | null;
  locationName: string | null;
  roomSource: 'request' | 'protocol' | 'single_room' | null;
  status: 'ok' | 'no_room' | 'no_reading';
  reading: {
    readingId: string;
    temperature: number;
    humidity: number | null;
    recordedAt: string;
    isManual: boolean;
    alertTriggered: boolean;
    locationName: string;
  } | null;
  limits: { tempMin: number; tempMax: number } | null;
  outOfRange: boolean;
}

// ---------------------------------------------------------------- Yagona tarix (D-189)
export type HistoryEntity = 'sample' | 'reagent' | 'nd';

export type HistoryItemType =
  | 'sample_event'
  | 'protocol_signed'
  | 'protocol_rejected'
  | 'consumption'
  | 'consumption_reviewed'
  | 'ai_review'
  | 'reagent_transaction'
  | 'reagent_approval'
  | 'nd_status'
  | 'nd_ai_extract';

export interface HistoryItemDto {
  id: string;
  type: HistoryItemType;
  at: string;
  actorId: string | null;
  actorName: string | null;
  data: Record<string, unknown>;
}

export interface AiReviewChange {
  field: string;
  aiValue: unknown;
  finalValue: unknown;
  confidence: AiConfidence | null;
}
