/**
 * src/components/learning/blocks/blockSchema.js
 *
 * Centralized block schema definitions, validation engine, and
 * versioning for the Course Engine.
 *
 * Architecture:
 *   - Each block type has a SCHEMA defining required fields, types, and constraints
 *   - Each block type has a VALIDATOR function returning { valid, errors, warnings }
 *   - Each block type has a MIGRATION map for version upgrades
 *   - ContentValidationEngine uses these to check blocks before publishing
 *
 * Design principles:
 *   - Schemas are declarative — no side effects
 *   - Validators return structured results (not exceptions)
 *   - Migrations are pure functions (old content → new content)
 *   - New block types never require changes to the validation engine
 */

// ─── Schema definition helpers ───────────────────────────────────────

/**
 * Define a field schema.
 * @param {string} type - 'string' | 'number' | 'boolean' | 'array' | 'object' | 'url'
 * @param {object} opts - { required, minLength, maxLength, min, max, pattern, items, message }
 */
export function field(type, opts = {}) {
  return { type, ...opts };
}

/**
 * Define a complete block schema.
 * @param {string} version - Schema version (e.g. '1.0')
 * @param {object} fields - Map of field name → field schema
 * @param {object} opts - { requiredFields, uniqueFields }
 */
export function schema(version, fields, opts = {}) {
  return { version, fields, ...opts };
}

// ─── Block Schemas ────────────────────────────────────────────────────

export const BLOCK_SCHEMAS = {
  paragraph: schema('1.0', {
    text: field('string', { required: true, minLength: 1, maxLength: 50000, message: 'Text content is required.' }),
  }),

  heading: schema('1.0', {
    text: field('string', { required: true, minLength: 1, maxLength: 200, message: 'Heading text is required.' }),
    level: field('string', { required: false, pattern: /^h[1-6]$/, default: 'h2' }),
  }),

  code: schema('1.0', {
    code: field('string', { required: true, minLength: 1, maxLength: 50000, message: 'Code is required.' }),
    language: field('string', { required: false, default: 'python' }),
    title: field('string', { required: false, maxLength: 200 }),
  }),

  code_exercise: schema('1.0', {
    instructions: field('string', { required: true, minLength: 5, maxLength: 10000, message: 'Instructions are required (min 5 chars).' }),
    code: field('string', { required: false, maxLength: 50000 }),
    language: field('string', { required: false, default: 'python' }),
    title: field('string', { required: false, maxLength: 200 }),
  }),

  image: schema('1.0', {
    url: field('url', { required: true, message: 'Image URL is required.' }),
    alt: field('string', { required: false, maxLength: 300, message: 'Alt text recommended for accessibility.' }),
    caption: field('string', { required: false, maxLength: 500 }),
  }),

  video: schema('1.0', {
    url: field('url', { required: true, message: 'Video URL is required.' }),
    title: field('string', { required: false, maxLength: 200 }),
    description: field('string', { required: false, maxLength: 2000 }),
  }),

  audio: schema('1.0', {
    url: field('url', { required: true, message: 'Audio URL is required.' }),
    title: field('string', { required: false, maxLength: 200 }),
  }),

  callout: schema('1.0', {
    text: field('string', { required: true, minLength: 1, maxLength: 5000, message: 'Callout text is required.' }),
    variant: field('string', { required: false, pattern: /^(info|tip|warning|example|note)$/, default: 'info' }),
  }),

  quote: schema('1.0', {
    text: field('string', { required: true, minLength: 1, maxLength: 5000, message: 'Quote text is required.' }),
    author: field('string', { required: false, maxLength: 200 }),
  }),

  table: schema('1.0', {
    markdown: field('string', { required: true, minLength: 5, maxLength: 20000, message: 'Table markdown is required.' }),
  }),

  checklist: schema('1.0', {
    items: field('array', {
      required: true,
      minLength: 1,
      message: 'Checklist must have at least one item.',
      items: { text: field('string', { required: true, minLength: 1 }) },
    }),
  }),

  file: schema('1.0', {
    url: field('url', { required: true, message: 'File URL is required.' }),
    name: field('string', { required: false, maxLength: 200 }),
  }),

  separator: schema('1.0', {}),

  resource: schema('1.0', {
    title: field('string', { required: true, minLength: 1, maxLength: 200, message: 'Resource title is required.' }),
    description: field('string', { required: false, maxLength: 1000 }),
    resources: field('array', { required: false, items: { url: field('url', { required: true }), title: field('string', { required: false }) } }),
  }),

  embed: schema('1.0', {
    url: field('url', { required: true, message: 'Embed URL is required.' }),
    title: field('string', { required: false, maxLength: 200 }),
  }),

  quiz: schema('1.0', {
    questions: field('array', { required: true, minLength: 1, message: 'Quiz must have at least one question.' }),
  }),

  assignment: schema('1.0', {
    instructions: field('string', { required: true, minLength: 5, maxLength: 10000, message: 'Assignment instructions are required.' }),
    title: field('string', { required: false, maxLength: 200 }),
  }),

  // ─── Language-practice blocks ─────────────────────────────────────
  vocabulary: schema('1.0', {
    targetText: field('string', { required: true, minLength: 1, message: 'Vocabulary needs target text.' }),
  }),

  repeat: schema('1.0', {
    targetText: field('string', { required: true, minLength: 1, message: 'Repeat needs target text.' }),
  }),

  pronunciation: schema('1.0', {
    targetText: field('string', { required: true, minLength: 1, message: 'Pronunciation needs target text.' }),
  }),

  speaking: schema('1.0', {
    targetText: field('string', { required: true, minLength: 1, message: 'Speaking needs target text.' }),
  }),

  listening: schema('1.0', {
    referenceAudio: field('url', { required: true, message: 'Listening needs reference audio.' }),
  }),

  conversation: schema('1.0', {
    steps: field('array', {
      required: true,
      minLength: 1,
      message: 'Conversation needs at least one step.',
      items: { prompt: field('string', { required: true, minLength: 1 }) },
    }),
  }),

  reflection: schema('1.0', {
    prompt: field('string', { required: true, minLength: 1, maxLength: 5000, message: 'Reflection prompt is required.' }),
    mode: field('string', { required: false, pattern: /^(private|optional|saved|required)$/, default: 'optional' }),
  }),

  fill_blank: schema('1.0', {
    targetText: field('string', { required: true, minLength: 1, message: 'Fill blank needs target text.' }),
  }),

  matching: schema('1.0', {
    pairs: field('array', {
      required: true,
      minLength: 2,
      message: 'Matching needs at least 2 pairs.',
      items: { left: field('string', { required: true }), right: field('string', { required: true }) },
    }),
  }),

  audio_record: schema('1.0', {
    targetText: field('string', { required: false }),
    referenceAudio: field('url', { required: false }),
  }),

  project: schema('1.0', {
    instructions: field('string', { required: true, minLength: 5, message: 'Project instructions are required.' }),
    title: field('string', { required: false, maxLength: 200 }),
  }),

  // §14-19 — Question blocks (shared foundation)
  multiple_choice: schema('1.0', {
    question: field('string', { required: true, minLength: 1, maxLength: 5000, message: 'Question text is required.' }),
    options: field('array', { required: true, minLength: 2, message: 'At least 2 options required.' }),
    correct: field('number', { required: false }),
    explanation: field('string', { required: false, maxLength: 2000 }),
  }),

  multiple_answer: schema('1.0', {
    question: field('string', { required: true, minLength: 1, maxLength: 5000, message: 'Question text is required.' }),
    options: field('array', { required: true, minLength: 2, message: 'At least 2 options required.' }),
    correct: field('array', { required: false }),
    explanation: field('string', { required: false, maxLength: 2000 }),
  }),

  true_false: schema('1.0', {
    question: field('string', { required: true, minLength: 1, maxLength: 5000, message: 'Question text is required.' }),
    correct: field('boolean', { required: false }),
    explanation: field('string', { required: false, maxLength: 2000 }),
  }),
};

// ─── Validation Engine ─────────────────────────────────────────────────

/**
 * Validate a single content block against its schema.
 *
 * @param {object} block - { id, block_type, content, ... }
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateBlock(block) {
  const result = { valid: true, errors: [], warnings: [] };

  if (!block || typeof block !== 'object') {
    result.valid = false;
    result.errors.push('Block is not a valid object.');
    return result;
  }

  const type = block.block_type || block.type;
  if (!type) {
    result.valid = false;
    result.errors.push('Block has no type.');
    return result;
  }

  const blockSchema = BLOCK_SCHEMAS[type];
  if (!blockSchema) {
    result.warnings.push(`No schema registered for block type "${type}". Cannot validate.`);
    return result; // Unknown type — warn but don't fail
  }

  const content = block.content || {};
  const fields = blockSchema.fields;

  for (const [key, fieldSchema] of Object.entries(fields)) {
    const value = content[key];

    // Required check
    if (fieldSchema.required) {
      if (value === undefined || value === null || value === '') {
        result.valid = false;
        result.errors.push(fieldSchema.message || `Field "${key}" is required.`);
        continue;
      }
    }

    // Skip further validation if not present
    if (value === undefined || value === null) continue;

    // Type-specific validation
    switch (fieldSchema.type) {
      case 'string': {
        if (typeof value !== 'string') {
          result.valid = false;
          result.errors.push(`Field "${key}" must be a string.`);
          break;
        }
        if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
          result.valid = false;
          result.errors.push(fieldSchema.message || `Field "${key}" must be at least ${fieldSchema.minLength} characters.`);
        }
        if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
          result.errors.push(`Field "${key}" exceeds ${fieldSchema.maxLength} characters (warning).`);
        }
        if (fieldSchema.pattern && !fieldSchema.pattern.test(value)) {
          result.errors.push(`Field "${key}" has invalid format.`);
        }
        break;
      }
      case 'url': {
        if (typeof value !== 'string' || !value.trim()) {
          if (fieldSchema.required) {
            result.valid = false;
            result.errors.push(fieldSchema.message || `Field "${key}" is required.`);
          }
          break;
        }
        if (!/^https?:\/\//i.test(value)) {
          result.errors.push(`Field "${key}" must be a valid URL (starts with http:// or https://).`);
        }
        break;
      }
      case 'number': {
        if (typeof value !== 'number' || isNaN(value)) {
          result.valid = false;
          result.errors.push(`Field "${key}" must be a number.`);
          break;
        }
        if (fieldSchema.min !== undefined && value < fieldSchema.min) {
          result.valid = false;
          result.errors.push(`Field "${key}" must be at least ${fieldSchema.min}.`);
        }
        if (fieldSchema.max !== undefined && value > fieldSchema.max) {
          result.valid = false;
          result.errors.push(`Field "${key}" must be at most ${fieldSchema.max}.`);
        }
        break;
      }
      case 'boolean': {
        if (typeof value !== 'boolean') {
          result.errors.push(`Field "${key}" should be a boolean (warning).`);
        }
        break;
      }
      case 'array': {
        if (!Array.isArray(value)) {
          result.valid = false;
          result.errors.push(`Field "${key}" must be an array.`);
          break;
        }
        if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
          result.valid = false;
          result.errors.push(fieldSchema.message || `Field "${key}" must have at least ${fieldSchema.minLength} items.`);
        }
        // Validate items if schema defined
        if (fieldSchema.items && typeof fieldSchema.items === 'object') {
          for (let i = 0; i < value.length; i++) {
            const item = value[i];
            if (typeof item !== 'object' || item === null) {
              result.errors.push(`Item ${i + 1} in "${key}" is not a valid object.`);
              continue;
            }
            for (const [itemKey, itemField] of Object.entries(fieldSchema.items)) {
              if (itemField.required && (item[itemKey] === undefined || item[itemKey] === null || item[itemKey] === '')) {
                result.errors.push(`Item ${i + 1} in "${key}" is missing "${itemKey}".`);
              }
            }
          }
        }
        break;
      }
      default:
        break;
    }
  }

  return result;
}

/**
 * Validate all blocks in a lesson.
 *
 * @param {Array} blocks - Array of content blocks
 * @param {string} lessonTitle - For error messages
 * @returns {{ valid: boolean, errors: string[], warnings: string[], blockResults: object[] }}
 */
export function validateLessonBlocks(blocks, lessonTitle = 'Lesson') {
  const result = { valid: true, errors: [], warnings: [], blockResults: [] };

  if (!Array.isArray(blocks) || blocks.length === 0) {
    result.warnings.push(`${lessonTitle} has no content blocks.`);
    return result;
  }

  blocks.forEach((block, index) => {
    const blockResult = validateBlock(block);
    const prefix = `Block ${index + 1} (${block.block_type || 'unknown'})`;

    blockResult.errors.forEach((err) => {
      result.errors.push(`${prefix}: ${err}`);
      result.valid = false;
    });

    blockResult.warnings.forEach((warn) => {
      result.warnings.push(`${prefix}: ${warn}`);
    });

    result.blockResults.push({
      index,
      type: block.block_type,
      ...blockResult,
    });
  });

  return result;
}

/**
 * Validate an entire course's content (all chapters → lessons → blocks).
 *
 * @param {Array} chapters - Array of chapter objects with nested lessons
 * @returns {{ valid: boolean, errors: string[], warnings: string[], recommendations: string[] }}
 */
export function validateCourseContent(chapters) {
  const result = { valid: true, errors: [], warnings: [], recommendations: [] };

  if (!Array.isArray(chapters) || chapters.length === 0) {
    result.warnings.push('Course has no chapters.');
    result.recommendations.push('Add chapters to structure the course content.');
    return result;
  }

  chapters.forEach((chapter, ci) => {
    const chapterLabel = chapter.title || `Chapter ${ci + 1}`;
    const lessons = chapter.lessons || [];

    if (lessons.length === 0) {
      result.warnings.push(`${chapterLabel} has no lessons.`);
    }

    lessons.forEach((lesson, li) => {
      const lessonLabel = lesson.title || `Lesson ${li + 1}`;
      const blocks = lesson.blocks || [];

      if (blocks.length === 0) {
        result.warnings.push(`${chapterLabel} → ${lessonLabel} has no content.`);
        result.recommendations.push(`Add content blocks to "${lessonLabel}".`);
      }

      const lessonResult = validateLessonBlocks(blocks, lessonLabel);
      lessonResult.errors.forEach((err) => {
        result.errors.push(`${chapterLabel} → ${err}`);
        result.valid = false;
      });
      lessonResult.warnings.forEach((warn) => {
        result.warnings.push(`${chapterLabel} → ${warn}`);
      });
    });
  });

  // Global recommendations
  if (result.valid && result.warnings.length === 0) {
    result.recommendations.push('Consider adding quizzes or exercises to improve learning outcomes.');
  }

  return result;
}

// ─── Block Versioning ──────────────────────────────────────────────────

/**
 * Block migration functions — map old version content to new version.
 * Key: `${blockType}:${fromVersion}→${toVersion}`
 */
const MIGRATIONS = {};

/**
 * Register a migration for a block type.
 * @param {string} blockType
 * @param {number} fromVersion
 * @param {number} toVersion
 * @param {function} migrateFn - (oldContent) => newContent
 */
export function registerMigration(blockType, fromVersion, toVersion, migrateFn) {
  const key = `${blockType}:${fromVersion}→${toVersion}`;
  MIGRATIONS[key] = migrateFn;
}

/**
 * Migrate a block to the latest schema version.
 *
 * @param {object} block - { block_type, content, version }
 * @returns {{ migrated: boolean, content: object, version: number, errors: string[] }}
 */
export function migrateBlock(block) {
  const type = block.block_type;
  const currentVersion = block.version || 1;
  const targetSchema = BLOCK_SCHEMAS[type];

  if (!targetSchema) {
    return { migrated: false, content: block.content, version: currentVersion, errors: [`No schema for type "${type}"`] };
  }

  const targetVersion = parseInt(targetSchema.version) || 1;
  if (currentVersion >= targetVersion) {
    return { migrated: false, content: block.content, version: currentVersion, errors: [] };
  }

  // Walk through migration chain
  let content = { ...(block.content || {}) };
  let v = currentVersion;
  const errors = [];

  while (v < targetVersion) {
    const nextV = v + 1;
    const key = `${type}:${v}→${nextV}`;
    const migrateFn = MIGRATIONS[key];

    if (migrateFn) {
      try {
        content = migrateFn(content);
      } catch (err) {
        errors.push(`Migration ${v}→${nextV} failed: ${err.message}`);
        break;
      }
    }
    // If no migration function, just increment (no-op migration)
    v = nextV;
  }

  return {
    migrated: v > currentVersion,
    content,
    version: v,
    errors,
  };
}

/**
 * Migrate all blocks in a lesson.
 *
 * @param {Array} blocks
 * @returns {{ blocks: Array, errors: string[] }}
 */
export function migrateLessonBlocks(blocks) {
  const errors = [];
  const migratedBlocks = blocks.map((block) => {
    const result = migrateBlock(block);
    if (result.errors.length > 0) errors.push(...result.errors);
    if (result.migrated) {
      return { ...block, content: result.content, version: result.version };
    }
    return block;
  });

  return { blocks: migratedBlocks, errors };
}

// ─── Content Quality Scoring ───────────────────────────────────────────

/**
 * Calculate a quality score for a lesson's content blocks.
 * Returns 0-100 based on completeness, accessibility, and best practices.
 *
 * @param {Array} blocks
 * @returns {{ score: number, issues: string[] }}
 */
export function scoreLessonContent(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return { score: 0, issues: ['No content blocks.'] };
  }

  let score = 0;
  const issues = [];

  // Base score: has content
  score += 20;

  // Variety bonus (different block types)
  const types = new Set(blocks.map((b) => b.block_type));
  if (types.size >= 3) score += 15;
  else if (types.size >= 2) score += 10;
  else issues.push('Consider using more diverse block types.');

  // Has text content
  const hasText = blocks.some((b) => b.block_type === 'paragraph' || b.block_type === 'heading');
  if (hasText) score += 10;
  else issues.push('Add text content for better readability.');

  // Has visual content
  const hasVisual = blocks.some((b) => b.block_type === 'image' || b.block_type === 'video');
  if (hasVisual) score += 10;
  else issues.push('Add images or video to improve engagement.');

  // Has interactive content
  const hasInteractive = blocks.some((b) =>
    ['code_exercise', 'quiz', 'assignment', 'checklist', 'matching', 'fill_blank'].includes(b.block_type)
  );
  if (hasInteractive) score += 15;
  else issues.push('Add exercises or quizzes for active learning.');

  // Has code blocks (for programming courses)
  const hasCode = blocks.some((b) => b.block_type === 'code' || b.block_type === 'code_exercise');
  if (hasCode) score += 10;

  // Has callouts/tips
  const hasCallout = blocks.some((b) => b.block_type === 'callout');
  if (hasCallout) score += 5;
  else issues.push('Add callouts or tips to highlight important information.');

  // Accessibility checks
  const imagesWithoutAlt = blocks.filter((b) => b.block_type === 'image' && (!b.content?.alt || !b.content.alt.trim()));
  if (imagesWithoutAlt.length > 0) {
    score -= 5 * imagesWithoutAlt.length;
    issues.push(`${imagesWithoutAlt.length} image(s) missing alt text.`);
  }

  // Block count bonus
  if (blocks.length >= 5) score += 5;
  if (blocks.length >= 10) score += 5;

  return { score: Math.max(0, Math.min(100, score)), issues };
}
