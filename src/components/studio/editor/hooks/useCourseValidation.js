/**
 * useCourseValidation — mirrors the backend course rules + readiness.
 *
 * `validate()` gates saves; `readiness()` feeds the shell's validation
 * rail with jump targets. `blockReadiness()` ensures a broken block is
 * never published silently — every block problem maps to its module.
 */
import { useCallback } from 'react';

function asList(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') return v.split('\n').map((s) => s.trim()).filter(Boolean);
  return [];
}

export function useCourseValidation({ form, isExternal, isHt }) {
  const validate = useCallback(() => {
    const errs = {};
    if (!form.title.trim()) errs.title = isHt ? 'Tit oblije' : 'Title required';
    if (!form.description.trim() || form.description.trim().length < 20) {
      errs.description = isHt
        ? 'Deskripsyon an dwe gen 20 karaktè minimòm'
        : 'Description must be at least 20 characters';
    }
    if (form.price && isNaN(Number(form.price))) {
      errs.price = isHt ? 'Pri a pa valab' : 'Invalid price';
    }
    // External courses must point learners somewhere — a valid destination
    // URL is the one thing that makes an external course real.
    if (isExternal && !form.external_url.trim()) {
      errs.external_url = isHt
        ? 'Ajoute yon URL ekstèn (kote elèv yo ale pou aprann)'
        : 'Add an external URL (where students go to learn)';
    } else if (isExternal && form.external_url.trim() && !/^https?:\/\//i.test(form.external_url.trim())) {
      errs.external_url = isHt ? 'URL la dwe kòmanse ak http(s)://' : 'The URL must start with http(s)://';
    }
    return errs;
  }, [form.title, form.description, form.price, form.external_url, isExternal, isHt]);

  const blockReadiness = useCallback((modules) => {
    const items = [];
    (Array.isArray(modules) ? modules : []).forEach((m, mi) => {
      (Array.isArray(m?.blocks) ? m.blocks : []).forEach((b) => {
        if (!b || typeof b !== 'object') return;
        const type = b.type;
        const label = b.title || b.targetText || b.instructions || type;
        const inModule = isHt ? ` (Modil ${mi + 1})` : ` (Module ${mi + 1})`;
        if (type === 'repeat' || type === 'pronunciation' || type === 'vocabulary' || type === 'speaking') {
          if (!String(b.targetText || '').trim()) {
            items.push({
              message: isHt
                ? `Egzèsis ${label} bezwen yon tèks sib.${inModule}`
                : `${label} needs a target text.${inModule}`,
              target: `module-${mi}`,
            });
          }
        }
        // Exercise blocks: instructions are the prompt the learner sees.
        // A "speak" prompt with no instructions is exactly the bug learners
        // reported (nothing to do, nowhere to speak).
        if (type === 'exercise') {
          if (!String(b.instructions || b.content || '').trim()) {
            items.push({
              message: isHt
                ? `Egzèsis ${label} bezwen enstriksyon.${inModule}`
                : `${label} needs instructions.${inModule}`,
              target: `module-${mi}`,
            });
          }
          if (b.answerType === 'multiple_choice' && asList(b.options).length < 2) {
            items.push({
              message: isHt
                ? `Egzèsis ${label} bezwen omwen 2 opsyon.${inModule}`
                : `${label} needs at least 2 options.${inModule}`,
              target: `module-${mi}`,
            });
          }
          if (b.answerType === 'checklist' && asList(b.items).length < 2) {
            items.push({
              message: isHt
                ? `Egzèsis ${label} bezwen omwen 2 eleman.${inModule}`
                : `${label} needs at least 2 items.${inModule}`,
              target: `module-${mi}`,
            });
          }
        }
        if (type === 'listening' && !String(b.referenceAudio || '').trim()) {
          items.push({
            message: isHt
              ? `${label} bezwen odyo referans.${inModule}`
              : `${label} needs reference audio.${inModule}`,
            target: `module-${mi}`,
          });
        }
        if (type === 'conversation') {
          const steps = Array.isArray(b.steps) ? b.steps : [];
          if (steps.length === 0 || steps.some((s) => !String(s?.prompt || '').trim())) {
            items.push({
              message: isHt
                ? `${label} bezwen omwen yon etap ak yon fraz.${inModule}`
                : `${label} needs at least one step with a prompt.${inModule}`,
              target: `module-${mi}`,
            });
          }
        }
      });
    });
    return items;
  }, [isHt]);

  const readiness = useCallback(() => {
    const items = [];
    if (!form.title.trim()) items.push({ message: isHt ? 'Ajoute yon tit' : 'Add a title', target: 'overview' });
    if (!form.description.trim() || form.description.trim().length < 20) {
      items.push({ message: isHt ? 'Ekri deskripsyon an (20+ karaktè)' : 'Write the description (20+ characters)', target: 'overview' });
    }
    if (!form.image_url.trim()) items.push({ message: isHt ? 'Ajoute yon imaj kouvèti' : 'Add a cover image', target: 'props' });
    if (isExternal && !form.external_url.trim()) {
      items.push({ message: isHt ? 'Ajoute URL kou ekstèn lan' : 'Add the external course URL', target: 'props' });
    }
    return items.concat(blockReadiness(form.modules));
  }, [form.title, form.description, form.image_url, form.external_url, isExternal, form.modules, blockReadiness, isHt]);

  return { validate, blockReadiness, readiness };
}
