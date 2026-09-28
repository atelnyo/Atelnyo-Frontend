/**
 * src/components/learning/blocks/registry.js
 *
 * CENTRALIZED BLOCK TYPE REGISTRY — §125 Block Registry Architecture
 *
 * This is THE extension point for new block types. To add a new block:
 *   1. Create a React component (e.g. NewBlock.jsx)
 *   2. Import it here
 *   3. Add it to BLOCK_REGISTRY with its type key
 *   4. Add its definition to BLOCK_TYPES with contract metadata
 *
 * §126 — Block Definition Contract:
 *   Every block type follows a predictable contract:
 *     - Identity: type, name, version
 *     - Display: icon, label, category
 *     - Capabilities: what the block can do
 *     - Validation: required fields, rules
 *     - Defaults: default data for new blocks
 *
 * §127 — Block Versioning:
 *   Each block has a version number. Old courses continue working.
 *
 * §130 — Block Category System:
 *   Blocks are grouped by category for the block picker.
 *
 * §131 — Block Capability System:
 *   Blocks declare what they support (content, media, interactive, etc.)
 *
 * Design principles:
 *   - Each block component receives: { block, lang, index, courseId, moduleIndex, onComplete, onViewed }
 *   - Each block component is responsible for its own UI + completion logic
 *   - New blocks never require changes to BlockRenderer, ModuleSession, or LearningSpace
 */

// ─── Existing blocks ─────────────────────────────────────────────────
import TextBlock from '../TextBlock';
import VideoBlock from '../VideoBlock';
import VocabularyBlock from '../VocabularyBlock';
import ListeningBlock from '../ListeningBlock';
import SpeechPractice from '../SpeechPractice';
import ConversationPractice from '../ConversationPractice';
import QuizBlock from '../QuizBlock';
import ImageBlock from './ImageBlock';
import CodeBlock from './CodeBlock';
import CodeExerciseBlock from './CodeExerciseBlock';
import AssignmentBlock from './AssignmentBlock';
import ProjectBlock from './ProjectBlock';
import CalloutBlock from './CalloutBlock';
import FillBlankBlock from './FillBlankBlock';
import MatchingBlock from './MatchingBlock';
import EmbedBlock from './EmbedBlock';
import ChecklistBlock from './ChecklistBlock';
import AudioRecordBlock from './AudioRecordBlock';
import ExerciseBlock from './ExerciseBlock';
import ReflectionBlock from './ReflectionBlock';
import ScenarioBlock from './ScenarioBlock';
import CalculatorBlock from './CalculatorBlock';
import TimelineBlock from './TimelineBlock';
import ResourceBlock from './ResourceBlock';
import MultipleChoiceBlock from './MultipleChoiceBlock';
import MultipleAnswerBlock from './MultipleAnswerBlock';
import TrueFalseBlock from './TrueFalseBlock';

// ═══════════════════════════════════════════════════════════════════════
// §126 — BLOCK DEFINITION CONTRACT
// §131 — BLOCK CAPABILITY SYSTEM
// ═══════════════════════════════════════════════════════════════════════
// Every block type defines: identity, display, capabilities, validation, defaults

export const BLOCK_CAPABILITIES = {
  CONTENT: 'content',
  MEDIA: 'media',
  INTERACTIVE: 'interactive',
  ASSESSMENT: 'assessment',
  SUBMISSION: 'submission',
  PROGRESS: 'progress',
  COMPLETION: 'completion',
  DOWNLOAD: 'download',
  WORKSPACE: 'workspace',
  EXPORT: 'export',
};

// ═══════════════════════════════════════════════════════════════════════
// §15 — BLOCK LAYOUT CAPABILITY SYSTEM
// ═══════════════════════════════════════════════════════════════════════
// Each block declares what layout widths it supports.
// The Learning Shell uses this to determine how wide a block renders.

export const BLOCK_LAYOUT = {
  CONTENT: 'content',   // 720px — readable text width
  STANDARD: 'standard', // 800px — standard media
  WIDE: 'wide',         // 960px — video, interactive
  FULL: 'full',         // 100% — complex canvas, tables
};

// §27 — Offline Block Support
// Blocks declare their offline capabilities.
export const OFFLINE_MODE = {
  READABLE: 'readable',       // Can be read offline (text, image cached)
  WRITABLE: 'writable',       // Can save locally offline
  REQUIRES_SERVER: 'server',   // Needs server validation (quiz scoring)
  REQUIRES_ONLINE: 'online',   // Must be online (video, external embed)
};

/** Get the default layout for a block type. */
export function getBlockDefaultLayout(type) {
  const meta = BLOCK_TYPES[type];
  return meta?.defaultLayout || BLOCK_LAYOUT.CONTENT;
}

/** Get all supported layouts for a block type. */
export function getBlockLayouts(type) {
  const meta = BLOCK_TYPES[type];
  return meta?.layouts || [BLOCK_LAYOUT.CONTENT];
}

// ═══════════════════════════════════════════════════════════════════════
// §130 — BLOCK CATEGORY SYSTEM
// ═══════════════════════════════════════════════════════════════════════

export const BLOCK_CATEGORIES = {
  content:     { icon: 'fa-file-lines',  label: { en: 'Content',     ht: 'Kontni' },    order: 1 },
  media:       { icon: 'fa-image',       label: { en: 'Media',       ht: 'Medya' },     order: 2 },
  practice:    { icon: 'fa-dumbbell',    label: { en: 'Practice',    ht: 'Pratik' },    order: 3 },
  assessment:  { icon: 'fa-clipboard-check', label: { en: 'Assessment', ht: 'Evalyasyon' }, order: 4 },
  code:        { icon: 'fa-code',        label: { en: 'Code',        ht: 'Kòd' },       order: 5 },
  business:    { icon: 'fa-briefcase',   label: { en: 'Business',    ht: 'Biznis' },    order: 6 },
  layout:      { icon: 'fa-layer-group', label: { en: 'Layout',      ht: 'Istatiq' },   order: 7 },
};

// ═══════════════════════════════════════════════════════════════════════
// §125 — BLOCK TYPE METADATA + §127 VERSIONING
// ═══════════════════════════════════════════════════════════════════════

export const BLOCK_TYPES = {
  // ─── Content blocks ───────────────────────────────────────────────
  text: {
    icon: 'fa-file-lines', label: { en: 'Reading', ht: 'Lekti' },
    category: 'content', version: 1,
    capabilities: [BLOCK_CAPABILITIES.CONTENT, BLOCK_CAPABILITIES.PROGRESS],
    layouts: [BLOCK_LAYOUT.CONTENT],
    defaultLayout: BLOCK_LAYOUT.CONTENT,
    offlineMode: OFFLINE_MODE.READABLE,
    description: { en: 'Rich text content', ht: 'Tèks ki gen fòma' },
    validation: { required: ['content'] },
    defaults: { content: '' },
  },
  image: {
    icon: 'fa-image', label: { en: 'Image', ht: 'Imaj' },
    category: 'content', version: 1,
    capabilities: [BLOCK_CAPABILITIES.CONTENT, BLOCK_CAPABILITIES.MEDIA],
    layouts: [BLOCK_LAYOUT.CONTENT, BLOCK_LAYOUT.WIDE],
    defaultLayout: BLOCK_LAYOUT.WIDE,
    offlineMode: OFFLINE_MODE.READABLE,
    description: { en: 'Image with caption', ht: 'Imaj ak kapsoyon' },
    validation: { required: ['imageUrl'] },
    defaults: { imageUrl: '', caption: '' },
  },
  video: {
    icon: 'fa-video', label: { en: 'Video', ht: 'Videyo' },
    category: 'media', version: 1,
    capabilities: [BLOCK_CAPABILITIES.CONTENT, BLOCK_CAPABILITIES.MEDIA, BLOCK_CAPABILITIES.PROGRESS],
    layouts: [BLOCK_LAYOUT.WIDE, BLOCK_LAYOUT.FULL],
    defaultLayout: BLOCK_LAYOUT.WIDE,
    offlineMode: OFFLINE_MODE.REQUIRES_ONLINE,
    description: { en: 'Video player', ht: 'Lektyè videyo' },
    validation: { required: [] },
    defaults: { videoUrl: '', poster: '', title: '' },
  },
  callout: {
    icon: 'fa-circle-info', label: { en: 'Note', ht: 'Nòt' },
    category: 'content', version: 1,
    capabilities: [BLOCK_CAPABILITIES.CONTENT],
    layouts: [BLOCK_LAYOUT.CONTENT],
    defaultLayout: BLOCK_LAYOUT.CONTENT,
    description: { en: 'Highlighted note or tip', ht: 'Nòt oswa konsèy' },
    validation: { required: ['content'] },
    defaults: { content: '', variant: 'tip' },
  },
  resource: {
    icon: 'fa-link', label: { en: 'Resource', ht: 'Resous' },
    category: 'content', version: 1,
    capabilities: [BLOCK_CAPABILITIES.CONTENT, BLOCK_CAPABILITIES.DOWNLOAD],
    layouts: [BLOCK_LAYOUT.CONTENT, BLOCK_LAYOUT.WIDE],
    defaultLayout: BLOCK_LAYOUT.WIDE,
    offlineMode: OFFLINE_MODE.READABLE,
    description: { en: 'External links, downloads, templates', ht: 'Lyen, telechaje, modèl' },
    validation: { required: ['title'] },
    defaults: { title: '', description: '', resources: [] },
  },

  embed: {
    icon: 'fa-code', label: { en: 'Embed', ht: 'Embed' },
    category: 'content', version: 1,
    capabilities: [BLOCK_CAPABILITIES.CONTENT, BLOCK_CAPABILITIES.MEDIA],
    layouts: [BLOCK_LAYOUT.WIDE, BLOCK_LAYOUT.FULL],
    defaultLayout: BLOCK_LAYOUT.WIDE,
    description: { en: 'External embed', ht: 'Ekstèn ki make' },
    validation: { required: ['embedCode'] },
    defaults: { embedCode: '' },
  },
  timeline: {
    icon: 'fa-timeline', label: { en: 'Timeline', ht: 'Tanbwa' },
    category: 'content', version: 1,
    capabilities: [BLOCK_CAPABILITIES.CONTENT, BLOCK_CAPABILITIES.INTERACTIVE, BLOCK_CAPABILITIES.PROGRESS],
    layouts: [BLOCK_LAYOUT.CONTENT, BLOCK_LAYOUT.WIDE],
    defaultLayout: BLOCK_LAYOUT.CONTENT,
    description: { en: 'Step-by-step timeline', ht: 'Tanbwa pa etap' },
    validation: { required: ['items'] },
    defaults: { items: [] },
  },

  // ─── Practice blocks ──────────────────────────────────────────────
  vocabulary: {
    icon: 'fa-book-open', label: { en: 'Vocabulary', ht: 'Vokabilè' },
    category: 'practice', version: 1,
    capabilities: [BLOCK_CAPABILITIES.INTERACTIVE, BLOCK_CAPABILITIES.PROGRESS, BLOCK_CAPABILITIES.COMPLETION],
    layouts: [BLOCK_LAYOUT.CONTENT, BLOCK_LAYOUT.WIDE],
    defaultLayout: BLOCK_LAYOUT.WIDE,
    description: { en: 'Vocabulary practice', ht: 'Pratik vokabilè' },
    validation: { required: ['items'] },
    defaults: { items: [] },
  },
  repeat: {
    icon: 'fa-repeat', label: { en: 'Repeat', ht: 'Repete' },
    category: 'practice', version: 1,
    capabilities: [BLOCK_CAPABILITIES.INTERACTIVE, BLOCK_CAPABILITIES.PROGRESS],
    layouts: [BLOCK_LAYOUT.CONTENT],
    defaultLayout: BLOCK_LAYOUT.CONTENT,
    description: { en: 'Repeat after audio', ht: 'Repete apre odyo' },
    validation: { required: ['targetText'] },
    defaults: { targetText: '' },
  },
  pronunciation: {
    icon: 'fa-language', label: { en: 'Pronunciation', ht: 'Pwononsyasyon' },
    category: 'practice', version: 1,
    capabilities: [BLOCK_CAPABILITIES.INTERACTIVE, BLOCK_CAPABILITIES.PROGRESS],
    layouts: [BLOCK_LAYOUT.CONTENT],
    defaultLayout: BLOCK_LAYOUT.CONTENT,
    description: { en: 'Pronunciation practice', ht: 'Pratik pwononsyasyon' },
    validation: { required: ['targetText'] },
    defaults: { targetText: '' },
  },
  speaking: {
    icon: 'fa-comment-dots', label: { en: 'Speaking', ht: 'Pale' },
    category: 'practice', version: 1,
    capabilities: [BLOCK_CAPABILITIES.INTERACTIVE, BLOCK_CAPABILITIES.PROGRESS, BLOCK_CAPABILITIES.SUBMISSION],
    layouts: [BLOCK_LAYOUT.CONTENT],
    defaultLayout: BLOCK_LAYOUT.CONTENT,
    description: { en: 'Speaking practice', ht: 'Pratik pale' },
    validation: { required: ['prompt'] },
    defaults: { prompt: '' },
  },
  listening: {
    icon: 'fa-ear-listen', label: { en: 'Listening', ht: 'Koute' },
    category: 'practice', version: 1,
    capabilities: [BLOCK_CAPABILITIES.INTERACTIVE, BLOCK_CAPABILITIES.MEDIA, BLOCK_CAPABILITIES.PROGRESS],
    layouts: [BLOCK_LAYOUT.CONTENT],
    defaultLayout: BLOCK_LAYOUT.CONTENT,
    description: { en: 'Listening exercise', ht: 'Egzèsis ekoutaj' },
    validation: { required: [] },
    defaults: {},
  },
  conversation: {
    icon: 'fa-comments', label: { en: 'Conversation', ht: 'Konvèsasyon' },
    category: 'practice', version: 1,
    capabilities: [BLOCK_CAPABILITIES.INTERACTIVE, BLOCK_CAPABILITIES.PROGRESS, BLOCK_CAPABILITIES.SUBMISSION],
    layouts: [BLOCK_LAYOUT.CONTENT],
    defaultLayout: BLOCK_LAYOUT.CONTENT,
    description: { en: 'Conversation practice', ht: 'Pratik konvèsasyon' },
    validation: { required: ['dialogue'] },
    defaults: { dialogue: [] },
  },
  fill_blank: {
    icon: 'fa-text-width', label: { en: 'Fill Blank', ht: 'Ranpli Nan Vid' },
    category: 'practice', version: 1,
    capabilities: [BLOCK_CAPABILITIES.INTERACTIVE, BLOCK_CAPABILITIES.PROGRESS, BLOCK_CAPABILITIES.COMPLETION],
    layouts: [BLOCK_LAYOUT.CONTENT],
    defaultLayout: BLOCK_LAYOUT.CONTENT,
    description: { en: 'Fill in the blank', ht: 'Ranpli nan vid' },
    validation: { required: ['sentence', 'answer'] },
    defaults: { sentence: '', answer: '' },
  },
  matching: {
    icon: 'fa-link', label: { en: 'Matching', ht: 'Asosye' },
    category: 'practice', version: 1,
    capabilities: [BLOCK_CAPABILITIES.INTERACTIVE, BLOCK_CAPABILITIES.PROGRESS, BLOCK_CAPABILITIES.COMPLETION],
    layouts: [BLOCK_LAYOUT.CONTENT, BLOCK_LAYOUT.WIDE],
    defaultLayout: BLOCK_LAYOUT.WIDE,
    description: { en: 'Match items', ht: 'Asosye bagay' },
    validation: { required: ['pairs'] },
    defaults: { pairs: [] },
  },
  audio_record: {
    icon: 'fa-microphone', label: { en: 'Audio Record', ht: 'Anrejistre Odyo' },
    category: 'practice', version: 1,
    capabilities: [BLOCK_CAPABILITIES.INTERACTIVE, BLOCK_CAPABILITIES.MEDIA, BLOCK_CAPABILITIES.SUBMISSION],
    layouts: [BLOCK_LAYOUT.CONTENT],
    defaultLayout: BLOCK_LAYOUT.CONTENT,
    description: { en: 'Record audio response', ht: 'Anrejistre repons odyo' },
    validation: { required: [] },
    defaults: {},
  },
  reflection: {
    icon: 'fa-brain', label: { en: 'Reflection', ht: 'Refleksyon' },
    category: 'practice', version: 1,
    capabilities: [BLOCK_CAPABILITIES.INTERACTIVE, BLOCK_CAPABILITIES.SUBMISSION, BLOCK_CAPABILITIES.WORKSPACE],
    layouts: [BLOCK_LAYOUT.CONTENT, BLOCK_LAYOUT.WIDE],
    defaultLayout: BLOCK_LAYOUT.CONTENT,
    description: { en: 'Reflection prompt', ht: 'Pon refleksyon' },
    validation: { required: ['prompt'] },
    defaults: { prompt: '' },
  },

  // ─── Assessment blocks ────────────────────────────────────────────
  quiz: {
    icon: 'fa-circle-question', label: { en: 'Quiz', ht: 'Kiz' },
    category: 'assessment', version: 1,
    capabilities: [BLOCK_CAPABILITIES.ASSESSMENT, BLOCK_CAPABILITIES.INTERACTIVE, BLOCK_CAPABILITIES.PROGRESS, BLOCK_CAPABILITIES.COMPLETION],
    layouts: [BLOCK_LAYOUT.WIDE],
    defaultLayout: BLOCK_LAYOUT.WIDE,
    offlineMode: OFFLINE_MODE.REQUIRES_SERVER,
    description: { en: 'Knowledge check quiz', ht: 'Quiz tcheke konesans' },
    validation: { required: ['question', 'options'] },
    defaults: { question: '', options: [], correct: 0, explanation: '' },
  },
  assignment: {
    icon: 'fa-pen-to-square', label: { en: 'Assignment', ht: 'Tach' },
    category: 'assessment', version: 1,
    capabilities: [BLOCK_CAPABILITIES.ASSESSMENT, BLOCK_CAPABILITIES.SUBMISSION, BLOCK_CAPABILITIES.PROGRESS],
    layouts: [BLOCK_LAYOUT.WIDE],
    defaultLayout: BLOCK_LAYOUT.WIDE,
    description: { en: 'Creator-reviewed assignment', ht: 'Devoirs ki kreyatè revize' },
    validation: { required: ['instructions'] },
    defaults: { instructions: '', reviewMode: 'automatic' },
  },
  project: {
    icon: 'fa-diagram-project', label: { en: 'Project', ht: 'Pwojè' },
    category: 'assessment', version: 1,
    capabilities: [BLOCK_CAPABILITIES.ASSESSMENT, BLOCK_CAPABILITIES.SUBMISSION, BLOCK_CAPABILITIES.PROGRESS, BLOCK_CAPABILITIES.EXPORT],
    layouts: [BLOCK_LAYOUT.WIDE, BLOCK_LAYOUT.FULL],
    defaultLayout: BLOCK_LAYOUT.WIDE,
    description: { en: 'Final project', ht: 'Pwojè final' },
    validation: { required: ['description'] },
    defaults: { description: '', deliverables: '' },
  },
  exercise: {
    icon: 'fa-pen', label: { en: 'Exercise', ht: 'Egzèsis' },
    category: 'assessment', version: 1,
    capabilities: [BLOCK_CAPABILITIES.INTERACTIVE, BLOCK_CAPABILITIES.SUBMISSION, BLOCK_CAPABILITIES.PROGRESS, BLOCK_CAPABILITIES.WORKSPACE],
    layouts: [BLOCK_LAYOUT.WIDE, BLOCK_LAYOUT.FULL],
    defaultLayout: BLOCK_LAYOUT.WIDE,
    offlineMode: OFFLINE_MODE.WRITABLE,
    description: { en: 'Interactive exercise with autosave', ht: 'Egzèsis interaktif ak autosave' },
    validation: { required: ['instructions'] },
    defaults: { instructions: '', answerType: 'text', portfolioSection: '' },
  },
  checklist: {
    icon: 'fa-list-check', label: { en: 'Checklist', ht: 'Tcheklis' },
    category: 'assessment', version: 1,
    capabilities: [BLOCK_CAPABILITIES.INTERACTIVE, BLOCK_CAPABILITIES.PROGRESS, BLOCK_CAPABILITIES.COMPLETION],
    layouts: [BLOCK_LAYOUT.CONTENT, BLOCK_LAYOUT.WIDE],
    defaultLayout: BLOCK_LAYOUT.CONTENT,
    description: { en: 'Interactive checklist', ht: 'Tcheklis interaktif' },
    validation: { required: ['items'] },
    defaults: { items: [] },
  },

  // ─── Code blocks ──────────────────────────────────────────────────
  code: {
    icon: 'fa-code', label: { en: 'Code', ht: 'Kòd' },
    category: 'code', version: 1,
    capabilities: [BLOCK_CAPABILITIES.CONTENT, BLOCK_CAPABILITIES.MEDIA],
    layouts: [BLOCK_LAYOUT.WIDE, BLOCK_LAYOUT.FULL],
    defaultLayout: BLOCK_LAYOUT.WIDE,
    description: { en: 'Code snippet', ht: 'Kòd' },
    validation: { required: ['code'] },
    defaults: { code: '', language: 'python' },
  },
  code_exercise: {
    icon: 'fa-terminal', label: { en: 'Code Exercise', ht: 'Egzèsis Kòd' },
    category: 'code', version: 1,
    capabilities: [BLOCK_CAPABILITIES.INTERACTIVE, BLOCK_CAPABILITIES.SUBMISSION, BLOCK_CAPABILITIES.PROGRESS],
    layouts: [BLOCK_LAYOUT.WIDE, BLOCK_LAYOUT.FULL],
    defaultLayout: BLOCK_LAYOUT.WIDE,
    description: { en: 'Interactive code exercise', ht: 'Egzèsis kòd interaktif' },
    validation: { required: ['instructions'] },
    defaults: { instructions: '', language: 'python' },
  },

  // ─── Business blocks ──────────────────────────────────────────────
  scenario: {
    icon: 'fa-theater-masks', label: { en: 'Scenario', ht: 'Senaryo' },
    category: 'business', version: 1,
    capabilities: [BLOCK_CAPABILITIES.INTERACTIVE, BLOCK_CAPABILITIES.ASSESSMENT, BLOCK_CAPABILITIES.PROGRESS],
    layouts: [BLOCK_LAYOUT.WIDE],
    defaultLayout: BLOCK_LAYOUT.WIDE,
    description: { en: 'Business scenario with choices', ht: 'Senaryo biznis ak chwa' },
    validation: { required: ['situation', 'options'] },
    defaults: { situation: '', options: [], correct: -1, explanation: '' },
  },
  calculator: {
    icon: 'fa-calculator', label: { en: 'Calculator', ht: 'Kalkilatè' },
    category: 'business', version: 1,
    capabilities: [BLOCK_CAPABILITIES.INTERACTIVE, BLOCK_CAPABILITIES.WORKSPACE, BLOCK_CAPABILITIES.EXPORT],
    layouts: [BLOCK_LAYOUT.WIDE, BLOCK_LAYOUT.FULL],
    defaultLayout: BLOCK_LAYOUT.WIDE,
    description: { en: 'Pricing/budget calculator', ht: 'Kalkilatè pri/bidjè' },
    validation: { required: ['fields'] },
    defaults: { fields: [], formula: '' },
  },
  canvas: {
    icon: 'fa-object-group', label: { en: 'Canvas', ht: 'Kannavas' },
    category: 'business', version: 1,
    capabilities: [BLOCK_CAPABILITIES.INTERACTIVE, BLOCK_CAPABILITIES.WORKSPACE, BLOCK_CAPABILITIES.EXPORT],
    layouts: [BLOCK_LAYOUT.WIDE, BLOCK_LAYOUT.FULL],
    defaultLayout: BLOCK_LAYOUT.FULL,
    description: { en: 'Business Model Canvas', ht: 'Kannavas Modèl Biznis' },
    validation: { required: [] },
    defaults: { sections: [] },
  },

  // ─── §14-§19 — Question blocks (shared foundation) ────────────────
  multiple_choice: {
    icon: 'fa-circle-dot', label: { en: 'Multiple Choice', ht: 'Chwa Multip' },
    category: 'assessment', version: 1,
    capabilities: [BLOCK_CAPABILITIES.ASSESSMENT, BLOCK_CAPABILITIES.INTERACTIVE, BLOCK_CAPABILITIES.PROGRESS, BLOCK_CAPABILITIES.COMPLETION],
    layouts: [BLOCK_LAYOUT.CONTENT, BLOCK_LAYOUT.WIDE],
    defaultLayout: BLOCK_LAYOUT.WIDE,
    description: { en: 'Single correct answer question', ht: 'Kesyon ak yon sèl repons korek' },
    validation: { required: ['question', 'options'] },
    defaults: { question: '', options: [], correct: 0, explanation: '' },
  },
  multiple_answer: {
    icon: 'fa-list-check', label: { en: 'Multiple Answer', ht: 'Repons Plizyè' },
    category: 'assessment', version: 1,
    capabilities: [BLOCK_CAPABILITIES.ASSESSMENT, BLOCK_CAPABILITIES.INTERACTIVE, BLOCK_CAPABILITIES.PROGRESS, BLOCK_CAPABILITIES.COMPLETION],
    layouts: [BLOCK_LAYOUT.CONTENT, BLOCK_LAYOUT.WIDE],
    defaultLayout: BLOCK_LAYOUT.WIDE,
    description: { en: 'Multiple correct answers question', ht: 'Kesyon ak plizyè repons korek' },
    validation: { required: ['question', 'options'] },
    defaults: { question: '', options: [], correct: [], explanation: '' },
  },
  true_false: {
    icon: 'fa-toggle-on', label: { en: 'True / False', ht: 'Vrè / Fo' },
    category: 'assessment', version: 1,
    capabilities: [BLOCK_CAPABILITIES.ASSESSMENT, BLOCK_CAPABILITIES.INTERACTIVE, BLOCK_CAPABILITIES.PROGRESS, BLOCK_CAPABILITIES.COMPLETION],
    layouts: [BLOCK_LAYOUT.CONTENT, BLOCK_LAYOUT.WIDE],
    defaultLayout: BLOCK_LAYOUT.WIDE,
    description: { en: 'True or false question', ht: 'Kesyon vrè oswa fo' },
    validation: { required: ['question'] },
    defaults: { question: '', correct: true, explanation: '' },
  },
};

// ═══════════════════════════════════════════════════════════════════════
// BLOCK COMPONENT REGISTRY
// ═══════════════════════════════════════════════════════════════════════

export const BLOCK_REGISTRY = {
  text:          TextBlock,
  image:         ImageBlock,
  video:         VideoBlock,
  callout:       CalloutBlock,
  embed:         EmbedBlock,
  timeline:      TimelineBlock,
  vocabulary:    VocabularyBlock,
  repeat:        SpeechPractice,
  pronunciation: SpeechPractice,
  speaking:      SpeechPractice,
  listening:     ListeningBlock,
  conversation:  ConversationPractice,
  fill_blank:    FillBlankBlock,
  matching:      MatchingBlock,
  audio_record:  AudioRecordBlock,
  reflection:    ReflectionBlock,
  quiz:          QuizBlock,
  assignment:    AssignmentBlock,
  project:       ProjectBlock,
  exercise:      ExerciseBlock,
  checklist:     ChecklistBlock,
  code:          CodeBlock,
  code_exercise: CodeExerciseBlock,
  scenario:      ScenarioBlock,
  calculator:    CalculatorBlock,
  resource:      ResourceBlock,
  multiple_choice: MultipleChoiceBlock,
  multiple_answer: MultipleAnswerBlock,
  true_false:     TrueFalseBlock,
};

// ═══════════════════════════════════════════════════════════════════════
// §100 — BLOCK ACCESSIBILITY CONTRACT (Phase 10)
// Each block type declares its accessibility capabilities.
// ═══════════════════════════════════════════════════════════════════════
export const BLOCK_ACCESSIBILITY = {
  text: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsCaptions: false,
    supportsTranscript: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    hasHeadingStructure: true,
    validationRules: ['heading_hierarchy'],
  },
  image: {
    keyboardSupport: false,
    screenReaderSupport: true,
    requiresAltText: true,
    supportsCaptions: true,
    supportsTranscript: false,
    supportsAccessibleName: true,
    supportsReducedMotion: false,
    validationRules: ['alt_text_required', 'decorative_flag'],
  },
  video: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsCaptions: true,
    supportsTranscript: true,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: ['title_recommended', 'captions_recommended', 'transcript_recommended'],
  },
  callout: {
    keyboardSupport: false,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: [],
  },
  resource: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: ['meaningful_link_text'],
  },
  embed: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: false,
    validationRules: ['iframe_title', 'external_a11y_warning'],
  },
  timeline: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: [],
  },
  vocabulary: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: [],
  },
  repeat: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: [],
  },
  pronunciation: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: [],
  },
  speaking: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: [],
  },
  listening: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: ['transcript_recommended'],
  },
  conversation: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: [],
  },
  fill_blank: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: [],
  },
  matching: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: ['drag_drop_keyboard_alt'],
  },
  audio_record: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: ['transcript_recommended'],
  },
  reflection: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: [],
  },
  quiz: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: ['question_label_recommended'],
  },
  assignment: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: ['instructions_recommended'],
  },
  project: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: ['description_recommended'],
  },
  exercise: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: ['instructions_recommended'],
  },
  checklist: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: [],
  },
  code: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: [],
  },
  code_exercise: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: ['instructions_recommended'],
  },
  scenario: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: ['situation_recommended'],
  },
  calculator: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: [],
  },
  multiple_choice: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: ['question_label_recommended'],
  },
  multiple_answer: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: ['question_label_recommended'],
  },
  true_false: {
    keyboardSupport: true,
    screenReaderSupport: true,
    requiresAltText: false,
    supportsAccessibleName: true,
    supportsReducedMotion: true,
    validationRules: ['question_label_recommended'],
  },
};

/**
 * Get accessibility metadata for a block type.
 * @param {string} type - Block type key
 * @returns {object|null} Accessibility contract or null if unknown type
 */
export function getBlockAccessibility(type) {
  return BLOCK_ACCESSIBILITY[type] || null;
}

// ═══════════════════════════════════════════════════════════════════════
// §125 — REGISTRY HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

/** Get the React component for a block type. Returns null for unknown types. */
export function getBlockComponent(type) {
  return BLOCK_REGISTRY[type] || null;
}

/** Get full metadata for a block type (§126 contract). */
export function getBlockMeta(type) {
  return BLOCK_TYPES[type] || {
    icon: 'fa-cube',
    label: { en: type, ht: type },
    category: 'other',
    version: 1,
    capabilities: [],
    description: { en: type, ht: type },
    validation: {},
    defaults: {},
  };
}

/** Get all block types grouped by category (§130). */
export function getBlockTypesByCategory() {
  const groups = {};
  for (const [type, meta] of Object.entries(BLOCK_TYPES)) {
    const cat = meta.category || 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ type, ...meta });
  }
  // Sort categories by order
  const sorted = {};
  for (const [cat, catMeta] of Object.entries(BLOCK_CATEGORIES).sort((a, b) => a[1].order - b[1].order)) {
    if (groups[cat]) {
      sorted[cat] = { ...catMeta, blocks: groups[cat] };
    }
  }
  return sorted;
}

/** Get human-readable label for a block type. */
export function blockTypeLabel(type, lang = 'ht') {
  const meta = BLOCK_TYPES[type];
  if (!meta) return type;
  return meta.label[lang] || meta.label.en || type;
}

/** Check if a block type supports a specific capability (§131). */
export function blockHasCapability(type, capability) {
  const meta = BLOCK_TYPES[type];
  return meta?.capabilities?.includes(capability) || false;
}

/** Get all block types that support a specific capability. */
export function getBlocksByCapability(capability) {
  return Object.entries(BLOCK_TYPES)
    .filter(([, meta]) => meta.capabilities?.includes(capability))
    .map(([type]) => type);
}

/** Validate block data against its contract (§126 + §154). */
export function validateBlockData(type, data) {
  const meta = BLOCK_TYPES[type];
  if (!meta) return { valid: false, errors: [`Unknown block type: ${type}`] };

  const errors = [];
  const required = meta.validation?.required || [];
  for (const field of required) {
    if (!data[field] || (typeof data[field] === 'string' && !data[field].trim())) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/** Get default data for a new block of given type. */
export function getBlockDefaults(type) {
  const meta = BLOCK_TYPES[type];
  return meta?.defaults ? { ...meta.defaults } : {};
}

/** Get block version (§127). */
export function getBlockVersion(type) {
  return BLOCK_TYPES[type]?.version || 1;
}

/** Get all available block categories. */
export function getAllCategories() {
  return Object.entries(BLOCK_CATEGORIES).sort((a, b) => a[1].order - b[1].order);
}
