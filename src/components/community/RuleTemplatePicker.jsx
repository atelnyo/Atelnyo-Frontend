/**
 * src/components/community/RuleTemplatePicker.jsx
 *
 * Optional rule library picker shared by the Create Community modal and
 * the Creator Studio rules editor.
 *
 * Behaviour is deliberately append-only: existing rules are shown as
 * "Already added" and selecting templates adds new rows; nothing is
 * replaced or removed. The caller owns the final ordering and saving.
 */
/* eslint-disable react/prop-types -- the codebase defines no PropTypes anywhere (same as the other community components) */
import React, { useMemo, useState } from 'react';
import { t } from '../../utils/i18n';
import {
  RULE_TEMPLATE_CATEGORIES,
  listTemplateRules,
  mergeRuleLists,
  normalizeRuleTitle,
  ruleTemplateLang,
  rulesFromSelection,
  templateRuleKey,
} from './ruleTemplates';

export default function RuleTemplatePicker({
  lang = 'en',
  existingRules = [],
  onAdd,
  onClose,
  testId = 'rule-template-picker',
}) {
  const key = ruleTemplateLang(lang);
  const [activeCategory, setActiveCategory] = useState(RULE_TEMPLATE_CATEGORIES[0].id);
  const [selected, setSelected] = useState([]);

  const allRules = useMemo(() => listTemplateRules(key), [key]);
  const existingTitles = useMemo(
    () => new Set((existingRules || []).map((rule) => normalizeRuleTitle(rule?.title)).filter(Boolean)),
    [existingRules],
  );

  const category = RULE_TEMPLATE_CATEGORIES.find((item) => item.id === activeCategory)
    || RULE_TEMPLATE_CATEGORIES[0];
  const categoryRules = allRules.filter((rule) => rule.categoryId === category.id);
  const availableInCategory = categoryRules.filter(
    (rule) => !existingTitles.has(normalizeRuleTitle(rule.title)),
  );
  const selectedRules = rulesFromSelection(selected, key)
    .filter((rule) => !existingTitles.has(normalizeRuleTitle(rule.title)));

  const toggle = (ruleKey) => {
    setSelected((current) => (
      current.includes(ruleKey)
        ? current.filter((item) => item !== ruleKey)
        : [...current, ruleKey]
    ));
  };

  const toggleCategory = () => {
    const keys = availableInCategory.map((rule) => rule.key);
    const allSelected = keys.length > 0 && keys.every((ruleKey) => selected.includes(ruleKey));
    setSelected((current) => (
      allSelected
        ? current.filter((ruleKey) => !keys.includes(ruleKey))
        : [...new Set([...current, ...keys])]
    ));
  };

  const addSelected = () => {
    if (selectedRules.length === 0) return;
    // mergeRuleLists is the final guard against duplicates even if a
    // parent already added the same title from another surface.
    const merged = mergeRuleLists(existingRules, selectedRules);
    const added = merged.slice((existingRules || []).length);
    onAdd?.(added);
    setSelected([]);
    onClose?.();
  };

  const allCategorySelected = availableInCategory.length > 0
    && availableInCategory.every((rule) => selected.includes(rule.key));

  return (
    <section className="rule-tpl" data-testid={testId} aria-labelledby={`${testId}-title`}>
      <div className="rule-tpl-head">
        <div>
          <h4 id={`${testId}-title`} className="rule-tpl-title">
            <i className="fas fa-wand-magic-sparkles" aria-hidden="true" />
            {' '}{t(lang, 'Bibliyotèk règ', 'Rule templates', 'Bibliothèque de règles')}
          </h4>
          <p className="rule-tpl-hint">
            {t(
              lang,
              'Chwazi règ ki adapte kominote w. Yo ajoute san efase sa w deja ekri yo.',
              'Pick rules that fit your community. They are added without replacing what you already wrote.',
              'Choisissez des règles adaptées. Elles sont ajoutées sans remplacer ce que vous avez déjà écrit.',
            )}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            className="rule-tpl-close"
            onClick={onClose}
            aria-label={t(lang, 'Fèmen', 'Close', 'Fermer')}
          >
            <i className="fas fa-xmark" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="rule-tpl-cats" role="group" aria-label={t(lang, 'Kategori règ', 'Rule categories', 'Catégories de règles')}>
        {RULE_TEMPLATE_CATEGORIES.map((item) => {
          const label = item.label[key];
          const available = allRules.filter((rule) => rule.categoryId === item.id
            && !existingTitles.has(normalizeRuleTitle(rule.title))).length;
          return (
            <button
              key={item.id}
              type="button"
              className={`rule-tpl-cat${item.id === activeCategory ? ' rule-tpl-cat--active' : ''}`}
              aria-pressed={item.id === activeCategory}
              onClick={() => setActiveCategory(item.id)}
            >
              <i className={`fas ${item.icon}`} aria-hidden="true" />
              <span>{label}</span>
              <span className="rule-tpl-cat-count">{available}</span>
            </button>
          );
        })}
      </div>

      <div className="rule-tpl-list" role="group" aria-label={category.label[key]}>
        {categoryRules.map((rule) => {
          const alreadyAdded = existingTitles.has(normalizeRuleTitle(rule.title));
          const checked = selected.includes(rule.key);
          return (
            <label
              key={rule.key}
              className={`rule-tpl-item${alreadyAdded ? ' rule-tpl-item--added' : ''}`}
            >
              <input
                type="checkbox"
                checked={alreadyAdded || checked}
                disabled={alreadyAdded}
                onChange={() => toggle(templateRuleKey(category.id, rule.key.split(':')[1]))}
              />
              <span className="rule-tpl-copy">
                <strong>{rule.title}</strong>
                <small>{rule.description}</small>
              </span>
              {alreadyAdded && (
                <span className="rule-tpl-added">
                  {t(lang, 'Deja ajoute', 'Already added', 'Déjà ajoutée')}
                </span>
              )}
            </label>
          );
        })}
        {categoryRules.length === 0 && (
          <p className="rule-tpl-empty">{t(lang, 'Pa gen règ nan kategori sa a.', 'No rules in this category.', 'Aucune règle dans cette catégorie.')}</p>
        )}
      </div>

      <div className="rule-tpl-foot">
        <button
          type="button"
          className="rule-tpl-secondary"
          onClick={toggleCategory}
          disabled={availableInCategory.length === 0}
        >
          {allCategorySelected
            ? t(lang, 'Retire tout nan kategori a', 'Clear this category', 'Tout désélectionner')
            : t(lang, 'Chwazi tout nan kategori a', 'Select all in this category', 'Tout sélectionner')}
        </button>
        <span className="rule-tpl-count" aria-live="polite">
          {t(
            lang,
            `${selectedRules.length} chwazi`,
            `${selectedRules.length} selected`,
            `${selectedRules.length} sélectionnée(s)`,
          )}
        </span>
        <button
          type="button"
          className="rule-tpl-primary"
          onClick={addSelected}
          disabled={selectedRules.length === 0}
        >
          <i className="fas fa-plus" aria-hidden="true" />
          {' '}{t(lang, 'Ajoute règ yo', 'Add selected rules', 'Ajouter les règles')}
        </button>
      </div>
    </section>
  );
}
