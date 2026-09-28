/**
 * src/components/admin/AdminFAQ.jsx
 *
 * Admin-specific FAQ section — answers questions that staff/superusers
 * have about the admin tools, course management, creator review, and
 * platform configuration. Distinct from the learner-facing FAQ.
 *
 * Mounted inside AdminDashboard and also available as a standalone
 * sheet route (/sheet/admin/faq).
 */
import React, { useState, useCallback } from 'react';

const ADMIN_FAQS = {
  ht: [
    {
      category: 'Jesyon Kou',
      items: [
        {
          q: 'Kijan mwen kreye yon kou ofisyèl?',
          a: 'Al nan Language Academy (/sheet/admin/academy), chwazi yon pwogram, epi klike "Jenere kou yo". Sa a kreye 15 kou brouyon otomatikman. Revize chak kou nan Creator Studio anvan w pibliye.',
        },
        {
          q: 'Ki diferans ant "Jenere" ak "Rejenere"?',
          a: '"Jenere" kreye kou yo pou premyè fwa (brouyon). "Rejenere" mete ajou kontni egzistan yo san kreye doublon — li itilize `curriculum_key` pou reutilize kou yo deja genyen.',
        },
        {
          q: 'Kijan mwen mete ajou yon kou deja pibliye?',
          a: 'Ouvri kou a nan Creator Studio, fè chanjman yo, epi sove. Chanjman yo ap parèt otomatikman. Si w vle fè yon gwo mizajou, itilize bouton "Metre ajou" nan Studio a.',
        },
        {
          q: 'Èske mwen ka depibliye yon kou?',
          a: 'Wi, nan Creator Studio, klike "Depibliye". Men, si gen elèv ki gen aksè (entitlement oswa enskripsyon), depibliye pa pral fèt jiskaske tout elèv yo fini.',
        },
      ],
    },
    {
      category: 'Revizyon Kreyatè',
      items: [
        {
          q: 'Kijan mwen apwouve yon aplikasyon kreyatè?',
          a: 'Al nan /sheet/admin/creators, chwazi aplikasyon an, epi klike "Apwouve". Kreyatè a ap resevwa yon notifikasyon epi wout pou kreye kou.',
        },
        {
          q: 'Ki sa ki "pwofil piblik kreyatè"?',
          a: 'Se paj piblik yon kreyatè nan /c/{username}. Ou ka verifye, mete an vedèt, oswa sispende yon pwofil soti nan Admin Dashboard la.',
        },
        {
          q: 'Kijan mwen retire yon kreyatè?',
          a: 'Nan Admin User Management (/sheet/admin/users), chwazi itilizatè a epi klike "Retire privilèj kreyatè". Sa a retire wout pou kreye kou san efase pwofil la.',
        },
      ],
    },
    {
      category: 'Medya ak Kontni',
      items: [
        {
          q: 'Kijan mwen jere medya yo?',
          a: 'Nan /sheet/admin/media, ou ka gade tout medya yo, tcheke estati pwovatè yo, epi chanje medya pou yon pwovatè diferan.',
        },
        {
          q: 'Kisa "Medya Kraze" (Broken Media) ye?',
          a: 'Se lyen medya ki pa fonksyone ankò (404, timeout, elatriye). Nan /sheet/admin/broken-media, ou ka wè tout medya ki gen pwoblèm epi voye pou validasyon.',
        },
        {
          q: 'Kijan mwen modere kontni?',
          a: 'Nan /sheet/admin/moderation, ou ka wè medya ki make, retire medya ki vyole规则 yo, epi mete itilizatè yo an preferans.',
        },
      ],
    },
    {
      category: 'Sekirite ak Konfigirasyon',
      items: [
        {
          q: 'Kijan mwen wè estati sekirite a?',
          a: 'Nan /sheet/admin/security-center, ou ka wè login rekàn, limit toke, ak souksè logo. Chak endikatè montre estati a an tan reyèl.',
        },
        {
          q: 'Kijan mwen configure limit pri pou bòs la?',
          a: 'Nan Admin Dashboard, gen yon seksyon "Konfigirasyon Platfòm" kote ou ka modifiede limit pri bòs la (top-up limit) san restart sèvè a.',
        },
        {
          q: 'Ki sa ki "Reglman Engine" ye?',
          a: 'Nan /sheet/admin/rules, ou ka kreye epi jere reglman otomatik (biznis reglman) ki kontwole kondwit sou platfòm nan — tankou moderasyon otomatik, limit, ak deklanchman.',
        },
      ],
    },
    {
      category: 'Statistik ak Analiz',
      items: [
        {
          q: 'Ki sa ki Admin Dashboard montre?',
          a: 'Dashboard la montre: total itilizatè, rapò ki annatansyon, itilizatè ki bloke, apèl jodi a, mesaj, konvèsasyon aktif, gwoup, ak estorage itilize. Genyen tou yon rapò sante sèvè (DB + Cache).',
        },
        {
          q: 'Kijan mwen wè analiz pou yon kou?',
          a: 'Nan Creator Studio, chwazi kou a, epi klike "Analiz". Ou pral wè kantite enskripsyon, pwogrè mwayèn, konplete, ak esè quiz.',
        },
      ],
    },
    {
      category: 'Pwoblèm Ofisye',
      items: [
        {
          q: 'Kou a pa pibliye — ki sa k ap manke?',
          a: 'Kou a bezwen: (1) yon tit, (2) deskripsyon 20+ karaktè, (3) yon imaj kouvèti, epi (4) pou kou sou Atelnyo, yon modil ak kontni pratik. Pou kou ekstèn, bezwen yon URL ekstèn valid.',
        },
        {
          q: 'Èske mwen ka verifye yon pwofil kreyatè?',
          a: 'Wi, nan Admin Dashboard, nan seksyon "Creator Public Profiles", klike bouton vèt la (✓) bò kote kreyatè a pou verifye li. Sa a montre yon badge verified sou pwofil la.',
        },
      ],
    },
  ],
  en: [
    {
      category: 'Course Management',
      items: [
        {
          q: 'How do I create an official course?',
          a: 'Go to Language Academy (/sheet/admin/academy), choose a program, and click "Generate". This creates 15 draft courses automatically. Review each course in Creator Studio before publishing.',
        },
        {
          q: 'What is the difference between "Generate" and "Resync"?',
          a: '"Generate" creates courses for the first time (draft). "Resync" updates existing content without creating duplicates — it uses curriculum_key to reuse existing courses.',
        },
        {
          q: 'How do I update an already published course?',
          a: 'Open the course in Creator Studio, make your changes, and save. Changes appear automatically. For major updates, use the "Update" button in the Studio.',
        },
        {
          q: 'Can I unpublish a course?',
          a: 'Yes, in Creator Studio, click "Unpublish". However, if learners already have access (entitlement or enrollment), unpublishing won\'t work until they finish.',
        },
      ],
    },
    {
      category: 'Creator Review',
      items: [
        {
          q: 'How do I approve a creator application?',
          a: 'Go to /sheet/admin/creators, select the application, and click "Approve". The creator will receive a notification and a link to create courses.',
        },
        {
          q: 'What is a "creator public profile"?',
          a: 'It\'s a creator\'s public page at /c/{username}. You can verify, feature, or suspend a profile from the Admin Dashboard.',
        },
        {
          q: 'How do I remove a creator?',
          a: 'In Admin User Management (/sheet/admin/users), select the user and click "Revoke creator privileges". This removes the ability to create courses without deleting the profile.',
        },
      ],
    },
    {
      category: 'Media & Content',
      items: [
        {
          q: 'How do I manage media?',
          a: 'At /sheet/admin/media, you can view all media, check provider status, and switch media to a different provider.',
        },
        {
          q: 'What is "Broken Media"?',
          a: 'It\'s media links that no longer work (404, timeout, etc.). At /sheet/admin/broken-media, you can see all problematic media and send them for validation.',
        },
        {
          q: 'How do I moderate content?',
          a: 'At /sheet/admin/moderation, you can see flagged media, remove media that violates rules, and set user preferences.',
        },
      ],
    },
    {
      category: 'Security & Configuration',
      items: [
        {
          q: 'How do I check security status?',
          a: 'At /sheet/admin/security-center, you can see login attempts, token limits, and success rates. Each indicator shows real-time status.',
        },
        {
          q: 'How do I configure the top-up limit?',
          a: 'In Admin Dashboard, there\'s a "Platform Configuration" section where you can modify the wallet top-up limit without restarting the server.',
        },
        {
          q: 'What is the "Rule Engine"?',
          a: 'At /sheet/admin/rules, you can create and manage automated rules (business rules) that control platform behavior — like auto-moderation, limits, and triggers.',
        },
      ],
    },
    {
      category: 'Statistics & Analytics',
      items: [
        {
          q: 'What does the Admin Dashboard show?',
          a: 'The dashboard shows: total users, pending reports, banned users, today\'s calls, messages, active conversations, groups, and storage used. There\'s also a server health report (DB + Cache).',
        },
        {
          q: 'How do I see analytics for a course?',
          a: 'In Creator Studio, select the course and click "Analytics". You\'ll see enrollment count, average progress, completions, and quiz attempts.',
        },
      ],
    },
    {
      category: 'Troubleshooting',
      items: [
        {
          q: 'The course won\'t publish — what\'s missing?',
          a: 'A course needs: (1) a title, (2) a 20+ character description, (3) a cover image, and (4) for online courses, a module with practice content. External courses need a valid external URL.',
        },
        {
          q: 'Can I verify a creator profile?',
          a: 'Yes, in the Admin Dashboard, in the "Creator Public Profiles" section, click the green checkmark (✓) next to the creator to verify them. This shows a verified badge on their profile.',
        },
      ],
    },
  ],
};

function FAQItem({ item, isOpen, onToggle, lang }) {
  return (
    <div className={`faq-accordion-item ${isOpen ? 'faq-accordion-item--open' : ''}`}>
      <button
        type="button"
        className="faq-accordion-trigger"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="faq-accordion-question">{item.q}</span>
        <i
          className={`fas fa-chevron-down faq-accordion-icon ${isOpen ? 'faq-accordion-icon--open' : ''}`}
          aria-hidden="true"
        />
      </button>
      <div
        className={`faq-accordion-collapse ${isOpen ? 'faq-accordion-collapse--open' : ''}`}
        role="region"
        aria-hidden={!isOpen}
      >
        <div className="faq-accordion-content">
          <p className="faq-accordion-answer">{item.a}</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminFAQ({ lang = 'ht', onNavigate }) {
  const isHt = lang === 'ht';
  const [openKey, setOpenKey] = useState(null);
  const [search, setSearch] = useState('');

  const faqs = ADMIN_FAQS[lang] || ADMIN_FAQS.ht;

  const toggle = useCallback((catIdx, itemIdx) => {
    const key = `${catIdx}-${itemIdx}`;
    setOpenKey((prev) => (prev === key ? null : key));
  }, []);

  // Filter by search
  const filtered = faqs.map((cat) => {
    if (!search.trim()) return cat;
    const q = search.toLowerCase();
    return {
      ...cat,
      items: cat.items.filter(
        (item) => item.q.toLowerCase().includes(q) || item.a.toLowerCase().includes(q),
      ),
    };
  }).filter((cat) => cat.items.length > 0);

  return (
    <div className="ad-dash-shell">
      {/* Header */}
      <div className="ad-dash-header">
        <div className="ad-dash-header-left">
          <button
            type="button"
            className="ad-dash-back"
            onClick={() => onNavigate?.(-1)}
            aria-label="Back"
          >
            <i className="fas fa-arrow-left" />
          </button>
          <div>
            <h1 className="ad-dash-title">
              <i className="fas fa-question-circle" aria-hidden="true" />
              {' '}{isHt ? 'FAQ Admin' : 'Admin FAQ'}
            </h1>
            <p className="ad-dash-subtitle">
              {isHt
                ? 'Kesyon ak repons pou itilizatè administratè yo.'
                : 'Questions & answers for admin users.'}
            </p>
          </div>
        </div>
        <div className="ad-dash-header-right">
          <button
            type="button"
            className="ad-dash-refresh"
            onClick={() => onNavigate?.('/sheet/admin/dashboard')}
            title={isHt ? 'Retounen nan Dashboard' : 'Back to Dashboard'}
          >
            <i className="fas fa-gauge-high" />
          </button>
        </div>
      </div>

      <div className="ad-dash-body">
        {/* Search bar */}
        <div className="ad-dash-panel" style={{ marginBottom: 20 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px',
            borderRadius: 10, border: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)',
          }}>
            <i className="fas fa-search" aria-hidden="true" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOpenKey(null); }}
              placeholder={isHt ? 'Chèche nan FAQ admin...' : 'Search admin FAQ...'}
              style={{
                border: 'none', outline: 'none', background: 'transparent',
                color: 'var(--text-primary)', fontSize: '0.9rem', width: '100%',
              }}
              aria-label={isHt ? 'Chèche nan FAQ admin' : 'Search admin FAQ'}
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); setOpenKey(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                aria-label={isHt ? 'Efase chèch' : 'Clear search'}
              >
                <i className="fas fa-times" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* No results */}
        {search && filtered.length === 0 && (
          <div className="ad-dash-panel-empty">
            <i className="fas fa-search" />
            <p>{isHt ? 'Pa gen kesyon ki mache ak chèch ou.' : 'No questions match your search.'}</p>
          </div>
        )}

        {/* FAQ categories */}
        {filtered.map((cat, catIdx) => (
          <div key={cat.category} className="ad-dash-panel" style={{ marginBottom: 16 }}>
            <div className="ad-dash-panel-header">
              <h2 className="ad-dash-panel-title">
                <i className={`fas ${
                  cat.category.includes('Jesyon') || cat.category.includes('Course') ? 'fa-book' :
                  cat.category.includes('Revizyon') || cat.category.includes('Creator') ? 'fa-users-gear' :
                  cat.category.includes('Medya') || cat.category.includes('Media') ? 'fa-cloud-upload-alt' :
                  cat.category.includes('Sekirite') || cat.category.includes('Security') ? 'fa-shield-halved' :
                  cat.category.includes('Statistik') || cat.category.includes('Statistic') ? 'fa-chart-line' :
                  'fa-wrench'
                }`} aria-hidden="true" />
                {' '}{cat.category}
              </h2>
              <span className="ad-dash-panel-badge">{cat.items.length}</span>
            </div>
            <div className="ad-dash-panel-body">
              <div className="faq-accordion-list">
                {cat.items.map((item, itemIdx) => (
                  <FAQItem
                    key={itemIdx}
                    item={item}
                    isOpen={openKey === `${catIdx}-${itemIdx}`}
                    onToggle={() => toggle(catIdx, itemIdx)}
                    lang={lang}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}

        {/* Quick links to other admin pages */}
        <div className="ad-dash-panel">
          <div className="ad-dash-panel-header">
            <h2 className="ad-dash-panel-title">
              <i className="fas fa-bolt" aria-hidden="true" />
              {' '}{isHt ? 'Lyen Rapid' : 'Quick Links'}
            </h2>
          </div>
          <div className="ad-dash-panel-body">
            <div className="ad-dash-links">
              {[
                { href: '/sheet/admin/dashboard', icon: 'fa-gauge-high', label: 'Admin Dashboard', desc: isHt ? 'Jwenn tout enfòmasyon nan yon kote' : 'Overview of everything' },
                { href: '/sheet/admin/creators', icon: 'fa-users-gear', label: 'Creator Review', desc: isHt ? 'Revize aplikasyon kreyatè yo' : 'Review creator applications' },
                { href: '/sheet/admin/academy', icon: 'fa-graduation-cap', label: 'Language Academy', desc: isHt ? 'Jere pwogram lang ofisyèl yo' : 'Manage official language programs' },
                { href: '/sheet/admin/rules', icon: 'fa-gears', label: 'Rule Engine', desc: isHt ? 'Kreye reglman otomatik' : 'Create automated rules' },
              ].map((link) => (
                <button
                  key={link.href}
                  type="button"
                  className="ad-dash-link-btn"
                  onClick={() => onNavigate?.(link.href)}
                >
                  <div className="ad-dash-link-icon">
                    <i className={`fas ${link.icon}`} />
                  </div>
                  <div className="ad-dash-link-text">
                    <strong>{link.label}</strong>
                    <span>{link.desc}</span>
                  </div>
                  <i className="fas fa-chevron-right ad-dash-link-arrow" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="ad-dash-footer">
        <span className="ad-dash-footer-text">
          <i className="fas fa-shield-halved" /> Admin FAQ
        </span>
      </div>
    </div>
  );
}
