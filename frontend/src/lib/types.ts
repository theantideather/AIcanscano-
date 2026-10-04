export type DiagnosisClass = 'normal' | 'opmd' | 'osmf' | 'oscc';
export type RiskLevel = 'low' | 'moderate' | 'high';
export type AnatomicalSite =
  | 'buccal_mucosa' | 'lateral_tongue' | 'ventral_tongue' | 'dorsal_tongue'
  | 'floor_of_mouth' | 'gingiva' | 'hard_palate' | 'soft_palate' | 'lip'
  | 'retromolar_trigone' | 'other';
export type LesionColour = 'white' | 'red' | 'mixed';

export interface ClinicalIntake {
  age: number | null;
  sex: 'male' | 'female' | 'unspecified';
  tobacco_use: boolean;
  alcohol_consumption: boolean;
  betel_quid_use: boolean;
  lesion_duration_weeks: number | null;
  anatomical_site: AnatomicalSite;
  lesion_colour: LesionColour | null;
  ulceration: boolean;
  pain: boolean;
  previous_opmd: boolean;
}

export const EMPTY_INTAKE: ClinicalIntake = {
  age: null,
  sex: 'unspecified',
  tobacco_use: false,
  alcohol_consumption: false,
  betel_quid_use: false,
  lesion_duration_weeks: null,
  anatomical_site: 'other',
  lesion_colour: null,
  ulceration: false,
  pain: false,
  previous_opmd: false,
};

export interface SuspiciousRegion {
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] on 0-1000 scale
  outline?: [number, number][] | null; // optional [x, y] points tracing the lesion's visible margin, 0-1000 scale
  label: string;
  class: DiagnosisClass | 'benign';
  confidence: number;
}

export interface AnalysisResult {
  clinical_assessment: {
    risk_level: RiskLevel;
    primary_diagnosis_class: DiagnosisClass;
    anatomical_location: string;
    primary_findings: string;
    differential_diagnosis: string[];
    precautionary_measures: string[];
    clinical_next_steps: string[];
  };
  detection: {
    suspicious_regions: SuspiciousRegion[];
    image_quality_note: string;
  };
  ml_confidence_metrics: {
    overall_confidence: number;
    class_probabilities: { normal: number; opmd: number; osmf: number; oscc: number };
    image_quality_auc_impact: string;
  };
  deployment_and_routing: {
    recommended_triage_action: string;
    target_time_to_referral: string;
    clinical_justification: string;
    specialist_type: string;
  };
  diagnostic_fusion: {
    image_derived_score: number;
    clinical_derived_score: number;
    fused_ai_diagnostic_probability: number;
  };
  clinical_intake: ClinicalIntake;
  disclaimer: string;
  is_mock_fallback?: boolean;
  is_live_api?: boolean;
}

export const CLASS_META: Record<DiagnosisClass | 'benign', { label: string; color: string; short: string }> = {
  normal: { label: 'Normal / Benign', color: '#1F5C4A', short: 'NORMAL' },
  benign: { label: 'Benign', color: '#1F5C4A', short: 'BENIGN' },
  opmd: { label: 'OPMD', color: '#C9A227', short: 'OPMD' },
  osmf: { label: 'Oral Submucous Fibrosis', color: '#0F8B8B', short: 'OSMF' },
  oscc: { label: 'OSCC (Carcinoma)', color: '#9B2C2C', short: 'OSCC' },
};

export const ANATOMICAL_SITE_OPTIONS: { value: AnatomicalSite; label: string }[] = [
  { value: 'buccal_mucosa', label: 'Buccal mucosa' },
  { value: 'lateral_tongue', label: 'Lateral tongue' },
  { value: 'ventral_tongue', label: 'Ventral tongue' },
  { value: 'dorsal_tongue', label: 'Dorsal tongue' },
  { value: 'floor_of_mouth', label: 'Floor of mouth' },
  { value: 'gingiva', label: 'Gingiva' },
  { value: 'hard_palate', label: 'Hard palate' },
  { value: 'soft_palate', label: 'Soft palate' },
  { value: 'lip', label: 'Lip' },
  { value: 'retromolar_trigone', label: 'Retromolar trigone' },
  { value: 'other', label: 'Other / Unsure' },
];
