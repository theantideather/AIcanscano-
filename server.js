// ============================================================================
// AICanScanO-Plus, Backend Server
// ============================================================================
//
// Upgrade over AICanScanO v1: "guided diagnosis". The /analyze endpoint now
// fuses structured clinical intake variables (the same variable set used in
// the AICanScanO-Plus clinical framework: age, sex, tobacco/alcohol/betel
// quid use, lesion duration, anatomical site, lesion colour, ulceration,
// pain, previous OPMD) with image-based AI findings, and returns normalized
// bounding boxes for suspicious regions so the frontend can draw a
// scan-grid / target-box overlay directly on the photo.
//
// BACKEND MODEL: Anthropic Claude API (claude-haiku-4-5, vision-capable)
//   - Cheapest current-generation Claude model with image understanding.
//   - The structured read-out AND normalized bounding boxes (box_2d:
//     [ymin, xmin, ymax, xmax], 0-1000 scale) for any suspicious mucosal
//     region are extracted via a FORCED tool call rather than free-text
//     JSON, the model must fill in a fixed input schema, which is far more
//     reliable than parsing JSON out of prose.
//
// SETUP:
//   1. Go to https://console.anthropic.com/settings/keys
//   2. Create an API key
//   3. Create a .env file in this directory:
//        ANTHROPIC_API_KEY=your_key_here
//   4. Restart the server: npm start
//
// The app works fully without a key, mock mode returns simulated findings
// (including plausible bounding boxes) so the UI/UX can be demoed offline.
// ============================================================================

require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend', 'dist')));

// 6 MB cap: Netlify Functions (AWS Lambda under the hood) reject request
// bodies above ~6 MB, and this backend also runs there in production.
const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are accepted.'));
    }
  },
});

// ---------------------------------------------------------------------------
// Anthropic Claude Client
// ---------------------------------------------------------------------------
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY?.trim();
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

// Forced tool-use schema: the model MUST call this tool, so its output is a
// validated object straight away (no fence-stripping / JSON.parse needed).
const SCREENING_TOOL = {
  name: 'submit_oral_screening_result',
  description: 'Submit the structured oral mucosal screening result for this intra-oral photograph.',
  input_schema: {
    type: 'object',
    properties: {
      clinical_assessment: {
        type: 'object',
        properties: {
          risk_level: { type: 'string', enum: ['low', 'moderate', 'high'] },
          primary_diagnosis_class: { type: 'string', enum: ['normal', 'opmd', 'osmf', 'oscc'] },
          anatomical_location: { type: 'string' },
          primary_findings: { type: 'string' },
          differential_diagnosis: { type: 'array', items: { type: 'string' } },
          precautionary_measures: { type: 'array', items: { type: 'string' } },
          clinical_next_steps: { type: 'array', items: { type: 'string' } },
        },
        required: ['risk_level', 'primary_diagnosis_class', 'anatomical_location', 'primary_findings', 'differential_diagnosis', 'precautionary_measures', 'clinical_next_steps'],
      },
      detection: {
        type: 'object',
        properties: {
          suspicious_regions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                box_2d: {
                  type: 'array',
                  items: { type: 'number' },
                  minItems: 4,
                  maxItems: 4,
                  description: 'Tight bounding box [ymin, xmin, ymax, xmax] normalized to a 0-1000 scale, (0,0) = top-left of the image. Fit it as closely as possible to the lesion margins, not a loose region.',
                },
                outline: {
                  type: 'array',
                  description: 'Optional, for a more precise outline of the lesion shape: 5-12 points tracing its visible margin, in order around the perimeter, each normalized 0-1000 as [x, y]. Omit if the margin is not clearly visible.',
                  items: {
                    type: 'array',
                    items: { type: 'number' },
                    minItems: 2,
                    maxItems: 2,
                  },
                },
                label: { type: 'string' },
                class: { type: 'string', enum: ['opmd', 'osmf', 'oscc', 'benign'] },
                confidence: { type: 'number' },
              },
              required: ['box_2d', 'label', 'class', 'confidence'],
            },
          },
          image_quality_note: { type: 'string' },
        },
        required: ['suspicious_regions', 'image_quality_note'],
      },
      ml_confidence_metrics: {
        type: 'object',
        properties: {
          overall_confidence: { type: 'number' },
          class_probabilities: {
            type: 'object',
            properties: {
              normal: { type: 'number' },
              opmd: { type: 'number' },
              osmf: { type: 'number' },
              oscc: { type: 'number' },
            },
            required: ['normal', 'opmd', 'osmf', 'oscc'],
          },
          image_quality_auc_impact: { type: 'string' },
        },
        required: ['overall_confidence', 'class_probabilities', 'image_quality_auc_impact'],
      },
      deployment_and_routing: {
        type: 'object',
        properties: {
          recommended_triage_action: { type: 'string' },
          target_time_to_referral: { type: 'string' },
          clinical_justification: { type: 'string' },
          specialist_type: { type: 'string' },
        },
        required: ['recommended_triage_action', 'target_time_to_referral', 'clinical_justification', 'specialist_type'],
      },
      disclaimer: { type: 'string' },
    },
    required: ['clinical_assessment', 'detection', 'ml_confidence_metrics', 'deployment_and_routing', 'disclaimer'],
  },
};

// ---------------------------------------------------------------------------
// Clinical variable set (Table 2 of the AICanScanO-Plus framework)
// ---------------------------------------------------------------------------
const ANATOMICAL_SITES = [
  'buccal_mucosa', 'lateral_tongue', 'ventral_tongue', 'dorsal_tongue',
  'floor_of_mouth', 'gingiva', 'hard_palate', 'soft_palate', 'lip',
  'retromolar_trigone', 'other',
];
const LESION_COLOURS = ['white', 'red', 'mixed'];

function sanitizeClinicalData(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const bool = (v) => v === true || v === 'true' || v === 'yes' || v === 1 || v === '1';
  const num = (v, fallback = null) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    age: num(d.age, null),
    sex: d.sex === 'female' ? 'female' : d.sex === 'male' ? 'male' : 'unspecified',
    tobacco_use: bool(d.tobacco_use),
    alcohol_consumption: bool(d.alcohol_consumption),
    betel_quid_use: bool(d.betel_quid_use),
    lesion_duration_weeks: num(d.lesion_duration_weeks, null),
    anatomical_site: ANATOMICAL_SITES.includes(d.anatomical_site) ? d.anatomical_site : 'other',
    lesion_colour: LESION_COLOURS.includes(d.lesion_colour) ? d.lesion_colour : null,
    ulceration: bool(d.ulceration),
    pain: bool(d.pain),
    previous_opmd: bool(d.previous_opmd),
  };
}

/**
 * Transparent, non-clinically-validated heuristic that turns the intake
 * variables into a 0-1 risk contribution. This is deliberately simple and
 * explainable (not a trained model), it exists to demonstrate the
 * "guided diagnosis" fusion step from the AICanScanO-Plus framework, where
 * clinical variables + image evidence combine into one diagnostic
 * probability.
 */
function clinicalRiskScore(c) {
  let score = 0;
  if (c.tobacco_use) score += 0.16;
  if (c.alcohol_consumption) score += 0.08;
  if (c.betel_quid_use) score += 0.16;
  if (c.ulceration) score += 0.12;
  if (c.pain) score += 0.05;
  if (c.previous_opmd) score += 0.14;
  if (c.lesion_colour === 'red') score += 0.12;
  else if (c.lesion_colour === 'mixed') score += 0.09;
  if (typeof c.lesion_duration_weeks === 'number') {
    if (c.lesion_duration_weeks >= 2 && c.lesion_duration_weeks < 4) score += 0.05;
    else if (c.lesion_duration_weeks >= 4) score += 0.1;
  }
  if (typeof c.age === 'number') {
    if (c.age >= 60 && c.age < 70) score += 0.04;
    else if (c.age >= 70) score += 0.08;
  }
  return Math.max(0, Math.min(1, score));
}

function imageRiskScore(classProbabilities) {
  const p = classProbabilities || {};
  const oscc = Number(p.oscc) || 0;
  const opmd = Number(p.opmd) || 0;
  const osmf = Number(p.osmf) || 0;
  return Math.max(0, Math.min(1, oscc * 1.0 + opmd * 0.5 + osmf * 0.4));
}

function fuseDiagnosticProbability(classProbabilities, clinicalData) {
  const imgScore = imageRiskScore(classProbabilities);
  const clinScore = clinicalRiskScore(clinicalData);
  const fused = 0.65 * imgScore + 0.35 * clinScore;
  return {
    image_derived_score: Number(imgScore.toFixed(3)),
    clinical_derived_score: Number(clinScore.toFixed(3)),
    fused_ai_diagnostic_probability: Number(Math.max(0, Math.min(1, fused)).toFixed(3)),
  };
}

function clinicalSummaryLines(c) {
  const lines = [];
  if (c.age != null) lines.push(`Age: ${c.age}`);
  if (c.sex !== 'unspecified') lines.push(`Sex: ${c.sex}`);
  lines.push(`Tobacco use: ${c.tobacco_use ? 'yes' : 'no'}`);
  lines.push(`Alcohol consumption: ${c.alcohol_consumption ? 'yes' : 'no'}`);
  lines.push(`Betel quid / areca nut use: ${c.betel_quid_use ? 'yes' : 'no'}`);
  if (c.lesion_duration_weeks != null) lines.push(`Lesion duration: ${c.lesion_duration_weeks} weeks`);
  lines.push(`Anatomical site (reported): ${c.anatomical_site.replace(/_/g, ' ')}`);
  if (c.lesion_colour) lines.push(`Lesion colour (reported): ${c.lesion_colour}`);
  lines.push(`Ulceration: ${c.ulceration ? 'yes' : 'no'}`);
  lines.push(`Pain: ${c.pain ? 'yes' : 'no'}`);
  lines.push(`Previous OPMD diagnosis: ${c.previous_opmd ? 'yes' : 'no'}`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Medical Screening Prompt (guided: clinical variables + image + regions)
// ---------------------------------------------------------------------------
function buildScreeningPrompt(clinicalData) {
  return `You are an expert oral pathologist assisting a "guided diagnosis" screening tool. You are given an intra-oral photograph AND a structured clinical intake for the same patient. Use BOTH together, do not ignore the clinical variables.

PATIENT CLINICAL INTAKE:
${clinicalSummaryLines(clinicalData)}

TASK:
1. First check whether the image is actually a usable intra-oral photograph (clear view of oral mucosa, tongue, buccal mucosa, gingiva, palate, floor of mouth, lips). If it is NOT (e.g. it's an unrelated photo, a screenshot, a document, a UI, too dark/blurry to read, or shows no oral mucosa at all), set primary_diagnosis_class to "normal", risk_level to "low", leave suspicious_regions empty, set overall_confidence low, and explain the issue in image_quality_note and primary_findings instead of guessing. Never invent a lesion on an image that is not an intra-oral photo.
2. If it IS a usable intra-oral photo, examine it for mucosal abnormalities consistent with: Oral Potentially Malignant Disorders (OPMD, e.g. leukoplakia, erythroplakia, lichen planus), Oral Submucous Fibrosis (OSMF, blanching, fibrous bands, reduced mouth opening appearance, leathery mucosa), or Oral Squamous Cell Carcinoma (OSCC, ulceroproliferative growth, exophytic mass, indurated ulcer, irregular margins).
3. For every suspicious region you identify, return BOTH: (a) a tight bounding box box_2d [ymin, xmin, ymax, xmax] on a 0-1000 scale fit closely to the lesion margins, and (b) when the margin is clearly visible, an outline of 5-12 [x, y] points (0-1000 scale) tracing the actual shape of the lesion around its perimeter, ellipse-like for a round patch, irregular for ragged carcinoma margins. Only include regions you can visually justify. If the mucosa looks normal, return an empty array, do not flag a region just to have something to show.
4. Keep risk_level logically consistent with primary_diagnosis_class and class_probabilities: "low" when primary_diagnosis_class is "normal" and OSCC/OPMD/OSMF probabilities are all small, "high" whenever primary_diagnosis_class is "oscc" or a frankly malignant-looking lesion is present, "moderate" otherwise. Never report a class/probabilities that say normal while separately claiming a moderate or high risk_level.
5. Weigh the clinical variables as real risk modifiers (tobacco/alcohol/betel quid use, ulceration, pain, lesion duration, prior OPMD, lesion colour, age all matter clinically) when forming your differential, but do not fabricate image findings that are not visually present, and do not let clinical risk factors alone push risk_level up if the image itself looks clearly normal; say so plainly instead.
6. Call the submit_oral_screening_result tool with your findings. class_probabilities must sum to approximately 1.0. Be precise rather than maximally cautious: flag what you can actually see, and say plainly when the image does not support a confident read. Use medical terminology. Write every text field in plain prose with commas and periods; do not use em dashes or en dashes anywhere.`;
}

// ---------------------------------------------------------------------------
// External Model Integration
// ---------------------------------------------------------------------------
async function callExternalModel(imageBuffer, mimeType, clinicalData) {
  if (anthropic) {
    try {
      const base64Image = imageBuffer.toString('base64');
      const prompt = buildScreeningPrompt(clinicalData);

      const response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        temperature: 0.2, // lower variance for more consistent, repeatable screening calls
        tools: [SCREENING_TOOL],
        tool_choice: { type: 'tool', name: SCREENING_TOOL.name },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } },
            ],
          },
        ],
      });

      const toolUse = response.content.find((block) => block.type === 'tool_use');
      if (!toolUse) throw new Error('Model did not return a structured tool call.');

      const parsed = parseModelOutput(toolUse.input);
      return { ...parsed, is_live_api: true };
    } catch (err) {
      console.error('Claude call failed, falling back to mock:', err.message);
      return generateMockResponse();
    }
  }

  console.log('ANTHROPIC_API_KEY not set, returning simulated response.');
  return generateMockResponse();
}

function clampBox(box) {
  if (!Array.isArray(box) || box.length !== 4) return null;
  const [ymin, xmin, ymax, xmax] = box.map((n) => Math.max(0, Math.min(1000, Number(n) || 0)));
  if (ymax <= ymin || xmax <= xmin) return null;
  return [ymin, xmin, ymax, xmax];
}

function clampOutline(outline) {
  if (!Array.isArray(outline) || outline.length < 5 || outline.length > 12) return null;
  const pts = outline
    .map((p) => (Array.isArray(p) && p.length === 2 ? [Math.max(0, Math.min(1000, Number(p[0]) || 0)), Math.max(0, Math.min(1000, Number(p[1]) || 0))] : null))
    .filter(Boolean);
  return pts.length >= 5 ? pts : null;
}

function normalizeRegions(regions) {
  if (!Array.isArray(regions)) return [];
  return regions
    .map((r) => {
      const box = clampBox(r?.box_2d);
      if (!box) return null;
      const validClasses = ['opmd', 'osmf', 'oscc', 'benign'];
      return {
        box_2d: box,
        outline: clampOutline(r?.outline),
        label: typeof r.label === 'string' && r.label.trim() ? r.label.trim() : 'Suspicious region',
        class: validClasses.includes(r.class) ? r.class : 'benign',
        confidence: Math.max(0, Math.min(1, Number(r.confidence) || 0.5)),
      };
    })
    .filter(Boolean)
    .slice(0, 6);
}

/**
 * Derives risk_level deterministically from the primary diagnosis class, the
 * fused diagnostic probability, and the raw image-derived score, overriding
 * whatever the model said. This guarantees the headline risk badge never
 * contradicts the class probabilities / diagnosis shown right next to it
 * (e.g. "Normal" paired with "Moderate risk"), which the model's own
 * free-text risk_level field could otherwise produce inconsistently.
 *
 * The image-derived score is checked on its own, not just the blended fused
 * score, because when the optional clinical intake is left blank (no habits,
 * duration, etc. entered) the clinical half of the fusion sits at 0 and
 * drags the blended score down. A visually alarming lesion should still read
 * as high risk even if the patient skipped the optional questionnaire.
 */
function deriveRiskLevel(primaryClass, fusedProbability, imageScore) {
  if (primaryClass === 'oscc' || fusedProbability >= 0.5 || imageScore >= 0.45) return 'high';
  if (primaryClass !== 'normal' || fusedProbability >= 0.2 || imageScore >= 0.2) return 'moderate';
  return 'low';
}

/**
 * Validates and normalizes the structured tool-call input Claude returns
 * into our standard response schema. Since the model is forced to call
 * submit_oral_screening_result, `parsed` is already a well-typed object.
 * This is just defensive normalization, not JSON parsing.
 */
function parseModelOutput(parsed) {
  try {
    const riskLevelRaw = parsed.clinical_assessment?.risk_level || 'moderate';
    const validRiskLevels = ['low', 'moderate', 'high'];
    const finalRisk = validRiskLevels.includes(riskLevelRaw) ? riskLevelRaw : 'moderate';

    const validClasses = ['normal', 'opmd', 'osmf', 'oscc'];
    const diagClassRaw = parsed.clinical_assessment?.primary_diagnosis_class;
    const diagClass = validClasses.includes(diagClassRaw) ? diagClassRaw : 'normal';

    const rawProbs = parsed.ml_confidence_metrics?.class_probabilities || {};
    let probs = {
      normal: Number(rawProbs.normal) || 0,
      opmd: Number(rawProbs.opmd) || 0,
      osmf: Number(rawProbs.osmf) || 0,
      oscc: Number(rawProbs.oscc) || 0,
    };
    const probSum = probs.normal + probs.opmd + probs.osmf + probs.oscc;
    if (probSum > 0) {
      probs = {
        normal: probs.normal / probSum,
        opmd: probs.opmd / probSum,
        osmf: probs.osmf / probSum,
        oscc: probs.oscc / probSum,
      };
    } else {
      probs = { normal: 0.7, opmd: 0.15, osmf: 0.1, oscc: 0.05 };
    }

    return {
      clinical_assessment: {
        risk_level: finalRisk,
        primary_diagnosis_class: diagClass,
        anatomical_location: parsed.clinical_assessment?.anatomical_location || 'Location indeterminate',
        primary_findings: parsed.clinical_assessment?.primary_findings || 'Analysis complete. See details below.',
        differential_diagnosis: Array.isArray(parsed.clinical_assessment?.differential_diagnosis)
          ? parsed.clinical_assessment.differential_diagnosis
          : ['Findings indeterminate'],
        precautionary_measures: Array.isArray(parsed.clinical_assessment?.precautionary_measures)
          ? parsed.clinical_assessment.precautionary_measures
          : ['Minimize local irritants', 'Maintain oral hygiene'],
        clinical_next_steps: Array.isArray(parsed.clinical_assessment?.clinical_next_steps)
          ? parsed.clinical_assessment.clinical_next_steps
          : ['Schedule clinical examination', 'Monitor for changes'],
      },
      detection: {
        suspicious_regions: normalizeRegions(parsed.detection?.suspicious_regions),
        image_quality_note: parsed.detection?.image_quality_note || 'No quality issues flagged.',
      },
      ml_confidence_metrics: {
        overall_confidence: Number(parsed.ml_confidence_metrics?.overall_confidence) || 0.5,
        class_probabilities: probs,
        image_quality_auc_impact: parsed.ml_confidence_metrics?.image_quality_auc_impact || 'Unknown',
      },
      deployment_and_routing: {
        recommended_triage_action: parsed.deployment_and_routing?.recommended_triage_action || 'Consult a clinician for evaluation.',
        target_time_to_referral: parsed.deployment_and_routing?.target_time_to_referral || 'Prompt (2 weeks)',
        clinical_justification: parsed.deployment_and_routing?.clinical_justification || 'Clinical follow-up required to validate automated screening.',
        specialist_type: parsed.deployment_and_routing?.specialist_type || 'Oral & Maxillofacial Pathologist',
      },
      disclaimer: parsed.disclaimer || 'This is an AI-assisted screening result, not a medical diagnosis. Always consult a healthcare professional. Metrics provided are estimates based on model confidence and must be clinically validated.',
    };
  } catch (parseErr) {
    console.error('Failed to normalize model output:', parseErr.message);
    return {
      clinical_assessment: {
        risk_level: 'low',
        primary_diagnosis_class: 'normal',
        anatomical_location: 'System Fault',
        primary_findings: 'The analysis engine received a malformed response from the AI. This typically occurs when an image is highly ambiguous, not a clinical scan, or violates processing constraints.',
        differential_diagnosis: ['Format Exception'],
        precautionary_measures: ['Ensure the image is a clear, well-lit intra-oral photograph.', 'Do not upload screenshots or non-medical images.'],
        clinical_next_steps: ['Reset and provide a valid clinical image.'],
      },
      detection: { suspicious_regions: [], image_quality_note: 'Processing aborted.' },
      ml_confidence_metrics: {
        overall_confidence: 0,
        class_probabilities: { normal: 1, opmd: 0, osmf: 0, oscc: 0 },
        image_quality_auc_impact: 'Critical Failure',
      },
      deployment_and_routing: {
        recommended_triage_action: 'REJECT PAYLOAD',
        target_time_to_referral: 'N/A',
        clinical_justification: 'System was unable to parse diagnostic data from the foundational model.',
        specialist_type: 'N/A',
      },
      disclaimer: 'System encountered a processing failure.',
    };
  }
}

/**
 * Realistic mock response for demo / no-API-key scenarios, now including
 * plausible bounding boxes so the grid/overlay UI can be demoed offline.
 */
function generateMockResponse(forceClass = null) {
  const scenarios = [
    {
      clinical_assessment: {
        risk_level: 'low',
        primary_diagnosis_class: 'normal',
        anatomical_location: 'Buccal mucosa',
        primary_findings: 'Mucosal surface appears uniform in color and texture. No irregular borders, ulceration, or atypical discoloration identified.',
        differential_diagnosis: ['Normal mucosa', 'Mild frictional keratosis', 'Linea alba'],
        precautionary_measures: ['Maintain regular oral hygiene', 'Attend routine biannual dental checkups', 'Avoid tobacco products'],
        clinical_next_steps: ['No immediate action required', 'Continue standard preventive care'],
      },
      detection: { suspicious_regions: [], image_quality_note: 'Clear, well-lit, in focus.' },
      ml_confidence_metrics: {
        overall_confidence: 0.92,
        class_probabilities: { normal: 0.88, opmd: 0.08, osmf: 0.03, oscc: 0.01 },
        image_quality_auc_impact: 'Low impact',
      },
      deployment_and_routing: {
        recommended_triage_action: 'Routine Monitoring',
        target_time_to_referral: 'Routine (6–12 months)',
        clinical_justification: 'High NPV scenario. Maximizing specificity to prevent over-referral for healthy tissue.',
        specialist_type: 'General Dentist',
      },
    },
    {
      clinical_assessment: {
        risk_level: 'moderate',
        primary_diagnosis_class: 'opmd',
        anatomical_location: 'Lateral border of tongue',
        primary_findings: 'Focal area displaying altered surface texture and slight white discoloration (homogeneous leukoplakia) compared to adjacent healthy mucosa. Borders are somewhat demarcated but lack frank nodularity.',
        differential_diagnosis: ['Homogeneous leukoplakia', 'Lichen planus', 'Focal hyperkeratosis'],
        precautionary_measures: ['Cease tobacco and alcohol consumption', 'Monitor lesion daily for rapid growth', 'Remove ill-fitting dental appliances causing friction'],
        clinical_next_steps: ['Schedule specialist evaluation within 2–4 weeks', 'Consider incisional biopsy if lesion persists'],
      },
      detection: {
        suspicious_regions: [
          {
            box_2d: [410, 560, 640, 830], label: 'Leukoplakic patch', class: 'opmd', confidence: 0.74,
            outline: [[600, 420], [700, 410], [790, 460], [820, 540], [790, 610], [700, 635], [610, 620], [575, 550], [585, 470]],
          },
        ],
        image_quality_note: 'Slight glare on wet mucosa limits detailed texture analysis.',
      },
      ml_confidence_metrics: {
        overall_confidence: 0.74,
        class_probabilities: { normal: 0.15, opmd: 0.55, osmf: 0.2, oscc: 0.1 },
        image_quality_auc_impact: 'Medium impact',
      },
      deployment_and_routing: {
        recommended_triage_action: 'Non-Urgent Specialist Evaluation',
        target_time_to_referral: 'Prompt (2–4 weeks)',
        clinical_justification: 'Balances sensitivity for potential OPMD while acknowledging intermediate risk level. Requires biopsy for definitive diagnosis.',
        specialist_type: 'Oral Medicine Specialist',
      },
    },
    {
      clinical_assessment: {
        risk_level: 'moderate',
        primary_diagnosis_class: 'osmf',
        anatomical_location: 'Buccal mucosa, bilateral',
        primary_findings: 'Blanched, leathery mucosal texture with palpable fibrous bands along the buccal mucosa, consistent with submucous fibrosis. Reduced mucosal pliability suspected.',
        differential_diagnosis: ['Oral submucous fibrosis', 'Chronic frictional keratosis'],
        precautionary_measures: ['Immediate and complete cessation of areca nut / betel quid use', 'Mouth-opening exercises as tolerated', 'Nutritional counseling'],
        clinical_next_steps: ['Specialist evaluation for staging', 'Consider biopsy to rule out epithelial dysplasia'],
      },
      detection: {
        suspicious_regions: [
          { box_2d: [250, 150, 560, 480], label: 'Fibrous banding / blanching', class: 'osmf', confidence: 0.68 },
        ],
        image_quality_note: 'Adequate lighting; mucosal texture clearly visible.',
      },
      ml_confidence_metrics: {
        overall_confidence: 0.7,
        class_probabilities: { normal: 0.12, opmd: 0.23, osmf: 0.55, oscc: 0.1 },
        image_quality_auc_impact: 'Low impact',
      },
      deployment_and_routing: {
        recommended_triage_action: 'Non-Urgent Specialist Evaluation',
        target_time_to_referral: 'Prompt (2–4 weeks)',
        clinical_justification: 'OSMF carries malignant transformation risk and requires staged specialist monitoring.',
        specialist_type: 'Oral Medicine Specialist',
      },
    },
    {
      clinical_assessment: {
        risk_level: 'high',
        primary_diagnosis_class: 'oscc',
        anatomical_location: 'Floor of mouth / ventral tongue',
        primary_findings: 'Prominent region exhibiting mixed red/white changes (erythroleukoplakia) with granular texture, irregular raised margins, and suspected submucosal induration.',
        differential_diagnosis: ['Squamous cell carcinoma', 'Severe dysplasia / high-risk OPMD', 'Proliferative verrucous leukoplakia'],
        precautionary_measures: ['Halt all potential chemical or physical irritants immediately', 'Do not aggressively probe the lesion', 'Prepare for urgent specialist handoff'],
        clinical_next_steps: ['Urgent referral for histopathological biopsy', 'Comprehensive head and neck examination', 'Consider baseline imaging (CT/MRI)'],
      },
      detection: {
        suspicious_regions: [
          {
            box_2d: [330, 380, 700, 760], label: 'Ulceroproliferative lesion', class: 'oscc', confidence: 0.86,
            outline: [[560, 340], [660, 360], [730, 420], [745, 500], [700, 580], [720, 650], [640, 690], [540, 680], [460, 630], [420, 540], [440, 450], [490, 370]],
          },
          { box_2d: [250, 300, 340, 420], label: 'Adjacent erythroplakic margin', class: 'oscc', confidence: 0.61 },
        ],
        image_quality_note: 'Lesion features distinct and clearly identifiable.',
      },
      ml_confidence_metrics: {
        overall_confidence: 0.89,
        class_probabilities: { normal: 0.02, opmd: 0.1, osmf: 0.08, oscc: 0.8 },
        image_quality_auc_impact: 'Low impact',
      },
      deployment_and_routing: {
        recommended_triage_action: 'Urgent Oral Oncology Referral',
        target_time_to_referral: 'Urgent (< 7 days)',
        clinical_justification: 'High-sensitivity threshold triggered; maximizing PPV for malignancy to expedite biopsy and oncological intervention.',
        specialist_type: 'Oral & Maxillofacial Oncologist',
      },
    },
  ];

  let scenario;
  if (forceClass) {
    scenario = scenarios.find((s) => s.clinical_assessment.primary_diagnosis_class === forceClass);
  }
  if (!scenario) {
    scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  }

  return {
    ...scenario,
    is_mock_fallback: true,
    disclaimer: 'This is an AI-assisted screening result, not a medical diagnosis. Always consult a healthcare professional. Metrics provided are estimates based on model confidence and must be clinically validated.',
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /analyze
 * multipart/form-data:
 *   image         - the intra-oral photograph (required)
 *   clinicalData  - JSON string of the guided-intake clinical variables (optional)
 */
app.post('/analyze', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' });
    }

    let rawClinical = {};
    if (req.body.clinicalData) {
      try {
        rawClinical = JSON.parse(req.body.clinicalData);
      } catch {
        rawClinical = {};
      }
    }
    const clinicalData = sanitizeClinicalData(rawClinical);

    console.log(
      `Received image: ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB, ${req.file.mimetype})`
    );

    const result = await callExternalModel(req.file.buffer, req.file.mimetype, clinicalData);
    const fusion = fuseDiagnosticProbability(result.ml_confidence_metrics.class_probabilities, clinicalData);

    // Override the model's own risk_level with one derived deterministically from
    // the diagnosis class + fused probability, so the headline badge can never
    // contradict the class probabilities shown right next to it.
    const consistentRiskLevel = deriveRiskLevel(
      result.clinical_assessment.primary_diagnosis_class,
      fusion.fused_ai_diagnostic_probability,
      fusion.image_derived_score
    );
    result.clinical_assessment.risk_level = consistentRiskLevel;

    console.log(`Analysis complete, class: ${result.clinical_assessment?.primary_diagnosis_class}, risk: ${consistentRiskLevel}, fused: ${fusion.fused_ai_diagnostic_probability}`);

    return res.json({
      ...result,
      clinical_intake: clinicalData,
      diagnostic_fusion: fusion,
    });
  } catch (err) {
    console.error('Analysis error:', err.message);
    return res.status(500).json({
      error: err.message || 'Analysis failed. Please try again.',
    });
  }
});

/**
 * POST /teleconsult
 * Demo request flow for the research prototype: captures a patient's contact
 * details and logs the request. No real specialist is connected on the
 * backend; there is no scheduling system or notification service wired up.
 */
app.post('/teleconsult', (req, res) => {
  const { name, contact, preferredTime, specialistType } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || typeof contact !== 'string' || !contact.trim()) {
    return res.status(400).json({ error: 'Name and a way to reach you are required.' });
  }
  console.log(
    `Teleconsultation requested: ${name.trim()} (${contact.trim()}), preferred time: ${preferredTime || 'unspecified'}, specialist: ${specialistType || 'unspecified'}`
  );
  return res.json({ status: 'received' });
});

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    model: ANTHROPIC_API_KEY ? `${CLAUDE_MODEL} (live)` : 'mock (no API key)',
  });
});

// Multer error handler
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 6 MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Start server (local/standalone only — Netlify imports `app` directly via
// netlify/functions/api.js and never calls listen())
// ---------------------------------------------------------------------------
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\nAICanScanO-Plus server running at http://localhost:${PORT}`);
    console.log('-'.repeat(55));
    if (!ANTHROPIC_API_KEY) {
      console.log(
        'No ANTHROPIC_API_KEY found, mock responses will be used.\n' +
          '\n' +
          '  To enable real AI analysis:\n' +
          '  1. Get an API key: https://console.anthropic.com/settings/keys\n' +
          '  2. Create .env file:   echo "ANTHROPIC_API_KEY=your_key" > .env\n' +
          '  3. Restart server:     npm start\n'
      );
    } else {
      console.log(`Anthropic API key detected, live ${CLAUDE_MODEL} analysis enabled.\n`);
    }
  });
}

module.exports = app;
