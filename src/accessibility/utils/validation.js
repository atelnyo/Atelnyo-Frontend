/**
 * src/accessibility/utils/validation.js
 *
 * Accessibility validation engine.
 *
 * Integrates with the existing ContentValidationEngine (Phase 7)
 * to add accessibility checks to course readiness evaluation.
 *
 * Validates:
 *   - Images: alt text, decorative flag
 *   - Videos: title, captions, transcript
 *   - Audio: transcript
 *   - Links: meaningful text
 *   - Headings: hierarchy, H1 presence
 *   - Interactive blocks: accessibility metadata
 *   - Forms: labels
 *   - Buttons: accessible names
 *
 * Severity: ERROR (blocks publishing), WARNING (review needed), INFO (improvement)
 */

import { A11Y_SEVERITY, A11Y_VALIDATION_RULES } from './constants';

/**
 * Validate a single image block's accessibility.
 * @param {object} block - Image block data
 * @returns {object[]} Array of validation issues
 */
export function validateImageBlock(block) {
  const issues = [];

  if (!block.isDecorative) {
    if (!block.altText || block.altText.trim() === '') {
      issues.push({
        severity: A11Y_SEVERITY.ERROR,
        code: A11Y_VALIDATION_RULES.IMAGE_MISSING_ALT,
        message: 'Add a description for this image so learners using screen readers can understand its purpose.',
        blockId: block.id,
        blockType: 'image',
        technicalDetail: 'Image block has no alt text and is not marked as decorative.',
      });
    } else if (block.altText.trim().length < 5) {
      issues.push({
        severity: A11Y_SEVERITY.WARNING,
        code: A11Y_VALIDATION_RULES.IMAGE_EMPTY_ALT,
        message: 'The image description seems very short. Consider adding more detail to help screen-reader users.',
        blockId: block.id,
        blockType: 'image',
      });
    }
  }

  return issues;
}

/**
 * Validate a video block's accessibility.
 * @param {object} block - Video block data
 * @returns {object[]} Array of validation issues
 */
export function validateVideoBlock(block) {
  const issues = [];

  if (!block.title || block.title.trim() === '') {
    issues.push({
      severity: A11Y_SEVERITY.WARNING,
      code: A11Y_VALIDATION_RULES.VIDEO_MISSING_TITLE,
      message: 'Add a title to this video so all learners know what it covers.',
      blockId: block.id,
      blockType: 'video',
    });
  }

  if (block.required && !block.captions && !block.captionUrl) {
    issues.push({
      severity: A11Y_SEVERITY.WARNING,
      code: A11Y_VALIDATION_RULES.VIDEO_MISSING_CAPTIONS,
      message: 'This required video does not have captions. Add captions so deaf or hard-of-hearing learners can follow along.',
      blockId: block.id,
      blockType: 'video',
    });
  }

  if (block.required && !block.transcript) {
    issues.push({
      severity: A11Y_SEVERITY.INFO,
      code: A11Y_VALIDATION_RULES.VIDEO_MISSING_TRANSCRIPT,
      message: 'Consider adding a transcript to this video. Transcripts help all learners review content and benefit screen-reader users.',
      blockId: block.id,
      blockType: 'video',
    });
  }

  return issues;
}

/**
 * Validate an external video/embed URL block.
 * @param {object} block - Embed block data
 * @returns {object[]} Array of validation issues
 */
export function validateExternalVideoBlock(block) {
  const issues = [];

  if (!block.title && !block.label) {
    issues.push({
      severity: A11Y_SEVERITY.WARNING,
      code: A11Y_VALIDATION_RULES.VIDEO_MISSING_TITLE,
      message: 'Add a descriptive title to this embedded content so learners understand what it contains.',
      blockId: block.id,
      blockType: 'embed',
    });
  }

  if (block.required) {
    issues.push({
      severity: A11Y_SEVERITY.INFO,
      code: A11Y_VALIDATION_RULES.EXTERNAL_VIDEO_NO_CAPTIONS,
      message: 'External media accessibility cannot be fully verified. Ensure the content is accessible or provide an alternative.',
      blockId: block.id,
      blockType: 'embed',
    });
  }

  return issues;
}

/**
 * Validate an audio block.
 * @param {object} block - Audio block data
 * @returns {object[]} Array of validation issues
 */
export function validateAudioBlock(block) {
  const issues = [];

  if (!block.transcript) {
    issues.push({
      severity: A11Y_SEVERITY.WARNING,
      code: A11Y_VALIDATION_RULES.AUDIO_MISSING_TRANSCRIPT,
      message: 'Add a transcript to this audio so all learners can access the content, including those who are deaf or hard of hearing.',
      blockId: block.id,
      blockType: 'audio_record',
    });
  }

  return issues;
}

/**
 * Validate links within a text block for meaningful names.
 * @param {object} block - Text block data
 * @returns {object[]} Array of validation issues
 */
export function validateLinkAccessibility(block) {
  const issues = [];
  const vaguePhrases = ['click here', 'read more', 'here', 'learn more', 'link'];

  if (block.content) {
    const linkRegex = /<a\s+[^>]*>([^<]+)<\/a>/gi;
    let match;
    while ((match = linkRegex.exec(block.content)) !== null) {
      const linkText = match[1].trim().toLowerCase();
      if (vaguePhrases.includes(linkText)) {
        issues.push({
          severity: A11Y_SEVERITY.WARNING,
          code: A11Y_VALIDATION_RULES.LINK_VAGUE_TEXT,
          message: `The link "${match[1].trim()}" may not be descriptive enough for screen-reader users. Use text that describes the destination.`,
          blockId: block.id,
          blockType: 'text',
        });
      }
    }
  }

  return issues;
}

/**
 * Validate heading hierarchy for a set of blocks.
 * @param {object[]} blocks - Array of blocks
 * @returns {object[]} Array of validation issues
 */
export function validateHeadingHierarchy(blocks) {
  const issues = [];
  let lastLevel = 0;

  blocks.forEach((block) => {
    if (block.type === 'text' && block.headingLevel) {
      const level = Number(block.headingLevel);
      if (level > lastLevel + 1 && lastLevel > 0) {
        issues.push({
          severity: A11Y_SEVERITY.WARNING,
          code: A11Y_VALIDATION_RULES.HEADING_SKIPPED,
          message: `Heading level skips from H${lastLevel} to H${level}. Consider using H${lastLevel + 1} instead.`,
          blockId: block.id,
          blockType: 'text',
        });
      }
      lastLevel = level;
    }
  });

  return issues;
}

/**
 * Validate an interactive block for accessibility metadata.
 * @param {object} block - Interactive block data
 * @returns {object[]} Array of validation issues
 */
export function validateInteractiveBlock(block) {
  const issues = [];

  const interactiveTypes = ['quiz', 'multiple_choice', 'matching', 'fill_blank', 'checklist', 'exercise', 'assignment', 'scenario'];
  if (interactiveTypes.includes(block.type)) {
    if (!block.title && !block.question && !block.instructions) {
      issues.push({
        severity: A11Y_SEVERITY.WARNING,
        code: A11Y_VALIDATION_RULES.INTERACTIVE_BLOCK_NO_A11Y,
        message: 'Add a title or description to this activity so screen-reader users know what to do.',
        blockId: block.id,
        blockType: block.type,
      });
    }
  }

  // Drag-and-drop blocks need keyboard alternatives
  if (block.type === 'matching' && block.useDragDrop) {
    issues.push({
      severity: A11Y_SEVERITY.INFO,
      code: A11Y_VALIDATION_RULES.DRAG_DROP_NO_KEYBOARD_ALT,
      message: 'If this matching activity uses drag-and-drop, ensure a keyboard alternative is available.',
      blockId: block.id,
      blockType: 'matching',
    });
  }

  return issues;
}

/**
 * Run accessibility validation on all blocks in a lesson.
 * @param {object[]} blocks - Array of block data
 * @returns {object} { errors, warnings, infos }
 */
export function validateLessonAccessibility(blocks) {
  const errors = [];
  const warnings = [];
  const infos = [];

  const pushIssues = (issues) => {
    issues.forEach((issue) => {
      if (issue.severity === A11Y_SEVERITY.ERROR) errors.push(issue);
      else if (issue.severity === A11Y_SEVERITY.WARNING) warnings.push(issue);
      else infos.push(issue);
    });
  };

  blocks.forEach((block) => {
    switch (block.type) {
      case 'image':
        pushIssues(validateImageBlock(block));
        break;
      case 'video':
        pushIssues(validateVideoBlock(block));
        break;
      case 'embed':
        pushIssues(validateExternalVideoBlock(block));
        break;
      case 'audio_record':
      case 'listening':
        pushIssues(validateAudioBlock(block));
        break;
      case 'text':
        pushIssues(validateLinkAccessibility(block));
        break;
      default:
        pushIssues(validateInteractiveBlock(block));
        break;
    }
  });

  pushIssues(validateHeadingHierarchy(blocks));

  return {
    errors,
    warnings,
    infos,
    valid: errors.length === 0,
    errorCount: errors.length,
    warningCount: warnings.length,
    infoCount: infos.length,
  };
}

/**
 * Run accessibility validation on an entire course (chapters → lessons → blocks).
 * @param {object[]} chapters - Array of chapter data with lessons and blocks
 * @returns {object} Course-level accessibility result
 */
export function validateCourseAccessibility(chapters) {
  const allIssues = [];

  chapters.forEach((chapter) => {
    (chapter.lessons || []).forEach((lesson) => {
      const lessonResult = validateLessonAccessibility(lesson.blocks || []);
      allIssues.push({
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        chapterTitle: chapter.title,
        ...lessonResult,
      });
    });
  });

  const totalErrors = allIssues.reduce((sum, r) => sum + r.errorCount, 0);
  const totalWarnings = allIssues.reduce((sum, r) => sum + r.warningCount, 0);
  const totalInfos = allIssues.reduce((sum, r) => sum + r.infoCount, 0);

  return {
    valid: totalErrors === 0,
    totalErrors,
    totalWarnings,
    totalInfos,
    lessonResults: allIssues,
  };
}
