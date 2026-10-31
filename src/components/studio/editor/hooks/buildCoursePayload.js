/**
 * buildCoursePayload — single payload builder for EVERY course save path.
 *
 * Before this module, the autosave `onSave` and the explicit `doSave`
 * each built the same ~40-line payload by hand — they could (and did)
 * drift. Now both call this. The backend contract lives in ONE place.
 */
import { parseHashtags } from '../../../../utils/hashtags';

export function buildCoursePayload(data, { isExternal }) {
  return {
    title: (data.title || '').trim(),
    short_description: (data.short_description || '').trim(),
    description: (data.description || '').trim(),
    tags: parseHashtags(data.hashtags),
    price: data.price ? Number(data.price) : 0,
    price_ltd: data.price_ltd ? Number(data.price_ltd) : 0,
    category: data.category || '',
    difficulty: data.difficulty || 'beginner',
    teaching_language: (data.teaching_language || '').trim(),
    learner_language: (data.learner_language || '').trim(),
    learning_objective: (data.learning_objective || '').trim(),
    objectives: (data.objectives || '').trim() ? data.objectives.trim().split('\n').filter(Boolean) : [],
    target_audience: (data.target_audience || '').trim(),
    prerequisites: (data.prerequisites || '').trim() ? data.prerequisites.trim().split('\n').filter(Boolean) : [],
    estimated_duration: (data.estimated_duration || '').trim(),
    image_url: (data.image_url || '').trim() || undefined,
    video_url: (data.video_url || '').trim() || undefined,
    completion_rules: data.completion_rules,
    delivery_type: isExternal ? 'external' : 'online',
    external_url: isExternal ? (data.external_url || '').trim() : '',
    external_format: isExternal ? (data.external_format || '').trim() : '',
    // The syllabus JSON — the course's content structure (optional for
    // external courses). ``blocks`` ride along inside each module —
    // additive, never stripped.
    syllabus: (data.modules || []).length > 0
      ? data.modules.map((m) => ({
          title: (m.title || '').trim(),
          description: (m.description || '').trim(),
          blocks: Array.isArray(m.blocks) ? m.blocks : [],
        }))
      : [],
  };
}
