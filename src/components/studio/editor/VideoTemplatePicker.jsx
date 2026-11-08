/**
 * src/components/studio/editor/VideoTemplatePicker.jsx
 * 
 * Reusable educational video template system for Course Studio.
 * Provides 8 template presets for creators to jump-start their video content.
 * 
 * Template presets:
 *   1. Animated Explainer
 *   2. Step-by-Step Tutorial
 *   3. Business Case Study
 *   4. Infographic Presentation
 *   5. Process Animation
 *   6. Instructor Presentation
 *   7. Documentary Style
 *   8. Animated Recap
 * 
 * Every template provides an appropriate starting composition.
 * Creators can customize their content. No design lock-in.
 * Uses existing Atelnyo visual identity (indigo/blue theme).
 */
import React, { useState, useCallback } from 'react';
import { translations } from '../../data/translations';

const templates = [
  {
    id: 'animated-explainer',
    name: 'Animated Explainer',
    nameHt: 'Explann Animè',
    description: 'Whiteboard-style animated explanation of a concept',
    descriptionHt: 'Entènèt blans ki eksplike yon konsept',
    category: 'education',
    categoryHt: 'Educasyon',
    previewColor: 'from-indigo-500 to-blue-500',
    starterScript: '#!/script\n// Animated explainer template\n// Scene 1: Introduction\n// Scene 2: Problem\n// Scene 3: Solution\n// Scene 4: Benefits\n// Scene 5: Call to action',
    starterScriptHt: '#!/script\n// Explann animè template\n// Senk 1: Introdiasyon\n// Senk 2: Posiblitè\n// Senk 3: Solinasyon\n// Senk 4: Bénifikèt\n// Senk 5: Appèl aksiyòn',
    metadata: {
      aspectRatio: '16 / 9',
      suggestedDuration: '2-3 minutes',
      style: 'whiteboard',
      recommendedFont: 'sans-serif',
    },
  },
  {
    id: 'step-by-step-tutorial',
    name: 'Step-by-Step Tutorial',
    nameHt: 'Tutorial Etap aprè Etap',
    description: 'Structured tutorial walking through each step methodically',
    descriptionHt: 'Tutorial estructri ki guide elèv aprè etap',
    category: 'education',
    categoryHt: 'Educasyon',
    previewColor: 'from-green-500 to-emerald-500',
    starterScript: '#!/script\n// Step-by-step tutorial template\n// Introduction: Goal overview\n// Step 1: First action\n// Step 2: Second action\n// Step 3: Third action\n// Step 4: Final action\n// Conclusion: Summary and next steps',
    starterScriptHt: '#!/script\n// Tutorial etap aprè etap template\n// Entènèt: Dipòziton generals\n// Etap 1: Aksan an\n// Etap 2: Aksan deux\n// Etap 3: Aksan twa\n// Etap 4: Aksan fò\n// Conclusion: Entègrman ak etapefutur',
    metadata: {
      aspectRatio: '16 / 9',
      suggestedDuration: '3-5 minutes',
      style: 'process',
      recommendedFont: 'serif',
    },
  },
  {
    id: 'business-case-study',
    name: 'Business Case Study',
    nameHt: 'Case Study Biznis',
    description: 'Real business scenario analysis with outcomes and lessons',
    descriptionHt: 'Analiz yon kesyon biznis ak lecons',
    category: 'business',
    categoryHt: 'Biznis',
    previewColor: 'from-indigo-500 to-purple-500',
    starterScript: '#!/script\n// Business case study template\n// Scenario: Market situation\n// Analysis: Key factors\n// Decision: Options considered\n// Outcome: Results achieved\n// Lessons: Takeaways for audience',
    starterScriptHt: '#!/script\n// Case study biznis template\n// Senkantè: Sitwasyon marchande\n// Analiz: Faktè key\n// Chwazi: Opiton ki selected\n// Kolè: Rezilta achiev\n// Lecons: Lecons pou aktyè',
    metadata: {
      aspectRatio: '16 / 9',
      suggestedDuration: '4-6 minutes',
      style: 'cinematic',
      recommendedFont: 'serif',
    },
  },
  {
    id: 'infographic-presentation',
    name: 'Infographic Presentation',
    nameHt: 'Presentasyon Infografi',
    description: 'Data visualization-driven presentation with minimal text',
    descriptionHt: 'Presentasyon avèk visualize données',
    category: 'education',
    categoryHt: 'Educasyon',
    previewColor: 'from-teal-500 to-emerald-500',
    starterScript: '#!/script\n// Infographic presentation template\n// Overview: Main message\n// Data Point 1: Key statistic\n// Data Point 2: Comparison\n// Data Point 3: Trend\n// Summary: Main takeaway\n// Closing: Call to action',
    starterScriptHt: '#!/script\n// Infografi presentasyon template\n// Dipòziton generals\n// Point Donn 1: Statiquant key\n// Point Donn 2: Comparison\n// Point Donn 3: Trend\n// Entègrman: Leçon principals\n// Fermasyon: Appèl aksiyòn',
    metadata: {
      aspectRatio: '16 / 9',
      suggestedDuration: '3-4 minutes',
      style: 'infographic',
      recommendedFont: 'display',
    },
  },
  {
    id: 'process-animation',
    name: 'Process Animation',
    nameHt: 'Animasyon Process',
    description: 'Workflow or process visualization showing transitions',
    descriptionHt: 'Visualize yon process ak transition',
    category: 'education',
    categoryHt: 'Educasyon',
    previewColor: 'from-orange-500 to-amber-500',
    starterScript: '#!/script\n// Process animation template\n// Current state: Where we start\n// Transition 1: First change\n// Transition 2: Second change\n// Transition 3: Third change\n// Final state: Where we end\n// Optimization: Tips and insights',
    starterScriptHt: '#!/script\n// Process animation template\n// Etat aktèl: Kote nou tann\n// Transition 1: Chanjeman an\n// Transition 2: Chanjeman deuz\n// Transition 3: Chanjeman trwa\n// Etat fò: Kote nou fini\n// Optimizasyon: Ti ipis ak insight',
    metadata: {
      aspectRatio: '16 / 9',
      suggestedDuration: '2-4 minutes',
      style: 'motion',
      recommendedFont: 'sans-serif',
    },
  },
  {
    id: 'instructor-presentation',
    name: 'Instructor Presentation',
    nameHt: 'Presentasyon Entènprann',
    description: 'Talking-head style with slides and visual aids',
    descriptionHt: 'Presentasyon entènprann ak diapo ak visualized',
    category: 'education',
    categoryHt: 'Educasyon',
    previewColor: 'from-red-500 to-rose-500',
    starterScript: '#!/script\n// Instructor presentation template\n// Introduction: Speaker intro and topic\n// Segment 1: Key point with visual\n// Segment 2: Key point with visual\n// Segment 3: Key point with visual\n// Conclusion: Summary and next steps\n// Q&A: Frequently asked questions',
    starterScriptHt: '#!/script\n// Presentasyon entènprann template\n// Introdiasyon: Entènprann ak topic\n// Segment 1: Point key ak visual\n// Segment 2: Point key ak visual\n// Segment 3: Point key ak visual\n// Conclusion: Entègrman ak etapefutur\n// Q&A: Kontra yon petenn prensipal',
    metadata: {
      aspectRatio: '4 / 3',
      suggestedDuration: '5-10 minutes',
      style: 'presentations',
      recommendedFont: 'serif',
    },
  },
  {
    id: 'documentary-style',
    name: 'Documentary Style',
    nameHt: 'Stil Dokiman',
    description: 'Narrative-driven with b-roll, interviews, and story arc',
    descriptionHt: 'Dranan ak interview ak arc dhistoir',
    category: 'education',
    categoryHt: 'Educasyon',
    previewColor: 'from-slate-500 to-gray-500',
    starterScript: '#!/script\n// Documentary style template\n// Opening: Hook and premise\n// Act 1: Background and context\n// Act 2: Main narrative and interviews\n// Act 3: Resolution and insights\n// Closing: Final thoughts and call to action',
    starterScriptHt: '#!/script\n// Stil dokiman template\n// Ouvè: Hook ak premis\n// Act 1: Fondmankon ak kontekst\n// Act 2: Narrakti moun ak interview\n// Act 3: Solidasyon ak insight\n// Fermasyon: Pensè ak aksiyòn fò',
    metadata: {
      aspectRatio: '16 / 9',
      suggestedDuration: '6-15 minutes',
      style: 'documentary',
      recommendedFont: 'serif',
    },
  },
  {
    id: 'animated-recap',
    name: 'Animated Recap',
    nameHt: 'Recap Animè',
    description: 'Quick summary of key points with engaging animation',
    descriptionHt: 'Resòme yon 분명 avec animasyon engage',
    category: 'education',
    categoryHt: 'Educasyon',
    previewColor: 'from-violet-500 to-purple-500',
    starterScript: '#!/script\n// Animated recap template\n// Main Point 1: Key takeaway 1\n// Main Point 2: Key takeaway 2\n// Main Point 3: Key takeaway 3\n// Main Point 4: Key takeaway 4\n// Closing: Summary and next lesson preview',
    starterScriptHt: '#!/script\n// Recap animè template\n// Point principèl 1: Leçon key 1\n// Point principèl 2: Leçon key 2\n// Point principèl 3: Leçon key 3\n// Point principèl 4: Leçon key 4\n// Fermasyon: Entègrman ak depiche lekòl',
    metadata: {
      aspectRatio: '16 / 9',
      suggestedDuration: '1-2 minutes',
      style: 'recap',
      recommendedFont: 'sans-serif',
    },
  },
];

export default function VideoTemplatePicker({ 
  lang = 'ht', 
  onSelect,
  show = true 
}) {
  const isHt = lang === 'ht';
  const t = (en, ht) => (isHt ? ht || en : en);

  if (!show) return null;

  const [selected, setSelected] = useState(null);

  const handleSelect = useCallback((template) => {
    setSelected(template.id);
    onSelect?.(template);
  }, [onSelect]);

  return (
    <div className="video-template-picker" role="dialog" aria-modal="true" aria-label={isHt ? 'Chwazi template videyo' : 'Choose video template'}>
      <div className="video-template-overlay" onClick={() => setSelected(null)}></div>
      
      <div className="video-template-modal" role="document">
        <header className="video-template-header">
          <h2>{isHt ? 'Chwazi Template Videyo' : 'Choose Video Template'}</h2>
          <button 
            type="button" 
            className="video-template-close" 
            onClick={() => setSelected(null)}
            aria-label={isHt ? 'Fermye' : 'Close'}
          >
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </header>

        <section className="video-template-list">
          {templates.map((template) => (
            <div 
              key={template.id}
              className=`video-template-item ${selected === template.id ? 'video-template-item-selected' : ''}`
              onClick={() => handleSelect(template)}
              role="button"
              tabIndex={0}
              aria-label={t(template.nameHt, template.name)}
            >
              <div className="video-template-preview" style={{ 
                background: `linear-gradient(135deg, ${template.previewColor}, #e0e7ff)`,
                border: `2px solid ${selected === template.id ? 'var(--color-primary)' : 'transparent'}`,
              }}>
                <span className="video-template-icon">
                  <i className={`fas fa-video ${template.category === 'business' ? 'fa-trophy' : ''}`} aria-hidden="true" />
                </span>
                <span className="video-template-name">{t(template.nameHt, template.name)}</span>
              </div>
              <p className="video-template-desc">{t(template.descriptionHt, template.description)}</p>
            </div>
          ))}
        </section>

        {selected && (
          <div className="video-template-details">
            <h3>{isHt ? 'Details du Template' : 'Template Details'}</h3>
            <div className="video-template-meta">
              <div className="video-meta-row">
                <span className="video-meta-label">{isHt ? 'AspekRasyon' : 'Aspect Ratio'}</span>
                <span className="video-meta-value">{templates.find(t => t.id === selected)?.metadata?.aspectRatio || '16 / 9'}</span>
              </div>
              <div className="video-meta-row">
                <span className="video-meta-label">{isHt ? 'Durasyon Suggè' : 'Suggested Duration'}</span>
                <span className="video-meta-value">{templates.find(t => t.id === selected)?.metadata?.suggestedDuration || '2-3 minutes'}</span>
              </div>
              <div className="video-meta-row">
                <span className="video-meta-label">{isHt ? 'Stil' : 'Style'}</span>
                <span className="video-meta-value">{templates.find(t => t.id === selected)?.metadata?.style || 'standard'}</span>
              </div>
            </div>
            <p className="video-template-starter">
              <strong>{isHt ? 'Script toutenn' : 'Full Script'}</strong>:<br />
              <span className="video-template-script">
                {templates.find(t => t.id === selected)?.starterScriptHt || templates.find(t => t.id === selected)?.starterScript || 'No starter script available'}
              </span>
            </p>
          </div>
        )}

        <footer className="video-template-actions">
          <button 
            type="button" 
            className="video-template-cancel" 
            onClick={() => setSelected(null)}
          >
            {isHt ? 'Refuz' : 'Cancel'}
          </button>
          <button 
            type="button" 
            className="video-template-confirm selected"
            onClick={() => {
              const template = templates.find(t => t.id === selected);
              onSelect?.(template);
              setSelected(null);
            }}
          >
            {isHt ? 'Chwazi ak kontinye' : 'Select and Continue'}
          </button>
        </footer>
      </div>
    </div>
  );
}