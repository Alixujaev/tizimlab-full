export type Pharmacopoeia = 'EP' | 'BP' | 'UzDSt' | 'USP' | 'OTHER';

export interface SubstanceParameterRow {
  id: string;
  substance_id: string;
  parameter_name: string;
  unit: string | null;
  spec_min: string | number | null;
  spec_max: string | number | null;
  method: string | null;
  sort_order: number;
  created_at: Date;
  company_id: string;
}

export interface SubstanceRow {
  id: string;
  name_uz: string;
  name_ru: string | null;
  name_en: string | null;
  pharmacopoeia: Pharmacopoeia;
  cas_number: string | null;
  description: string | null;
  is_active: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  company_id: string;
  parameters_count?: string | number;
}

export interface SubstanceParameterDto {
  id: string;
  substanceId: string;
  parameterName: string;
  unit: string | null;
  specMin: number | null;
  specMax: number | null;
  method: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface SubstanceDto {
  id: string;
  nameUz: string;
  nameRu: string | null;
  nameEn: string | null;
  pharmacopoeia: Pharmacopoeia;
  casNumber: string | null;
  description: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  companyId: string;
  parametersCount?: number;
}

export interface SubstanceDetailDto extends SubstanceDto {
  parameters: SubstanceParameterDto[];
}
