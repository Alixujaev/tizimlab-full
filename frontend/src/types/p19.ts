/** P19: OOS jurnali, AI kopilot chat (RAG), peak natijalari va tarixiy solishtirish. AI qaror chiqarmaydi. */

import type { AiConfidence, AiExtractionStatus, AiImageQuality } from './p18';

// ---------------------------------------------------------------- OOS
export type OosStatus = 'open' | 'investigating' | 'closed';

export interface OosCaseDto {
  id: string;
  sampleId: string;
  protocolId: string | null;
  substanceName: string | null;
  serialNumber: string | null;
  testName: string;
  resultValue: string;
  specLimit: string;
  unit: string | null;
  description: string | null;
  status: OosStatus;
  openedBy: string | null;
  openedByName: string | null;
  openedAt: string;
  rootCause: string | null;
  closureNote: string | null;
  closedBy: string | null;
  closedByName: string | null;
  closedAt: string | null;
  updatedAt: string;
}

export interface OosNoteDto {
  id: string;
  kind: 'note' | 'status_change';
  text: string;
  userId: string | null;
  userName: string | null;
  createdAt: string;
}

export interface OosPeakFileRef {
  id: string;
  fileName: string;
  confirmedResults: number;
}

export interface OosCaseDetailDto extends OosCaseDto {
  notes: OosNoteDto[];
  peakFiles: OosPeakFileRef[];
}

export interface OosListParams {
  page?: number;
  limit?: number;
  status?: OosStatus;
  search?: string;
  sampleId?: string;
}

export interface CreateOosInput {
  sampleId: string;
  protocolId?: string | null;
  testName: string;
  resultValue: string;
  specLimit: string;
  unit?: string | null;
  description?: string | null;
}

export type OosStatusInput =
  | { status: 'investigating'; note?: string }
  | { status: 'closed'; rootCause: string; closureNote: string };

// ---------------------------------------------------------------- Chat
export interface ChatSessionDto {
  id: string;
  caseId: string | null;
  title: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatAttachmentDto {
  id: string;
  fileId: string;
  fileName: string;
  kind: string;
  size: number;
  createdAt: string;
}

export type ChatSourceType = 'protocol' | 'peak' | 'nd' | 'oos_case';

export interface ChatSourceDto {
  ref: string;
  sourceType: ChatSourceType;
  sourceId: string;
  title: string;
  substanceName: string | null;
  series: string | null;
  docDate: string | null;
  link: string | null;
  excerpt: string;
  cited: boolean;
}

export interface ChatAnswerDto {
  internal_findings: { source_ref: string; summary: string }[];
  peak_assessment: string | null;
  probable_causes: { cause: string; basis: 'internal' | 'general'; source_refs: string[] }[];
  recommended_checks: string[];
  general_knowledge: string[];
  internalFound: boolean;
}

export interface ChatMessageDto {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  answer: ChatAnswerDto | null;
  sources: ChatSourceDto[];
  peakComparison: PeakComparisonDto[] | null;
  retrievalMode: 'hybrid' | 'fts_only' | null;
  attachmentIds: string[];
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  errorCode: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface ChatSessionDetailDto extends ChatSessionDto {
  messages: ChatMessageDto[];
  attachments: ChatAttachmentDto[];
}

export interface ChatSendInput {
  content: string;
  attachmentIds?: string[];
  peakFileId?: string | null;
  filters?: { substanceName?: string | null; ndId?: string | null; equipmentId?: string | null };
}

export interface ChatSendResult {
  userMessage: ChatMessageDto;
  assistantMessage: ChatMessageDto;
}

// ---------------------------------------------------------------- Peak natijalari
export type PeakFlag =
  | 'rt_shift'
  | 'area_deviation'
  | 'tailing_high'
  | 'tailing_change'
  | 'plates_drop'
  | 'low_resolution'
  | 'new_peak';

export interface MetricStats {
  current: number | null;
  n: number;
  mean: number | null;
  sd: number | null;
  rsdPct: number | null;
  deviationPct: number | null;
}

export interface PeakComparisonRow {
  name: string | null;
  rt: number;
  matchedRuns: number;
  rtStats: MetricStats;
  areaStats: MetricStats & { basis: 'area_percent' | 'area' | null };
  tailingStats: MetricStats;
  platesStats: MetricStats;
  resolution: number | null;
  flags: PeakFlag[];
}

export interface PeakComparisonDto {
  peakFileId: string;
  status: 'no_current' | 'no_history' | 'compared';
  historyRuns: number;
  singleRun: boolean;
  criteria: {
    substanceName: string;
    ndId: string | null;
    equipmentId: string | null;
    equipmentName: string | null;
  };
  historySources: { protocolId: string; peakFileId: string; date: string | null }[];
  peaks: PeakComparisonRow[];
  missingPeaks: { name: string | null; meanRt: number; presentInRuns: number }[];
  flags: PeakFlag[];
  thresholds: {
    rtShiftPct: number;
    areaDevPct: number;
    tailingMax: number;
    tailingChangePct: number;
    platesDropPct: number;
    resolutionMin: number;
    [key: string]: number;
  };
}

export interface PeakResultDto {
  id: string;
  protocolFileId: string;
  peakName: string | null;
  retentionTime: number;
  area: number | null;
  height: number | null;
  areaPercent: number | null;
  tailing: number | null;
  plates: number | null;
  resolution: number | null;
  source: 'manual' | 'ai';
  aiValue: (Record<string, unknown> & { confidence?: AiConfidence | null }) | null;
  status: 'draft' | 'confirmed';
  confirmedAt: string | null;
}

export interface PeakFileInfoDto {
  id: string;
  protocolId: string;
  fileName: string;
  substanceName: string | null;
  equipmentId: string | null;
  equipmentName: string | null;
  ndId: string | null;
  analysisDate: string | null;
}

export interface PeakResultsDto {
  file: PeakFileInfoDto;
  results: PeakResultDto[];
}

export interface PeakResultInput {
  peakName?: string | null;
  retentionTime: number;
  area?: number | null;
  height?: number | null;
  areaPercent?: number | null;
  tailing?: number | null;
  plates?: number | null;
  resolution?: number | null;
}

export interface PeakExtractionDto {
  extractionId: string;
  status: AiExtractionStatus;
  imageQuality: AiImageQuality | null;
  errorCode: string | null;
  created: PeakResultDto[];
  skipped: number;
}

// ---------------------------------------------------------------- RAG
export interface RagStatusDto {
  searchMode: 'hybrid' | 'fts_only';
  embeddingModel: string | null;
  jobs: { status: string; sourceType: string; count: number }[];
  chunks: { sourceType: string; count: number; withEmbedding: number }[];
  failed: {
    id: string;
    sourceType: string;
    sourceId: string;
    lastError: string | null;
    attempts: number;
    updatedAt: string;
  }[];
}
