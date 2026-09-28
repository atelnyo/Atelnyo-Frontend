import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RAIL_ITEMS } from './profileConstants';

/**
 * LeftNavRail — desktop profile sub-navigation rail.
 * VERBATIM extraction from CreatorPublicProfile.jsx (post-A-2) for Stage A-3.5.
 * Includes Settings cog button at bottom + csp-rail-item class.
 *
 * @param {{ activeTab: string, onChange: (id:string)=>void, lang: string, items: Array<{id:string,label:string,labelHt:string,icon:string}> }} props
 */
export default function LeftNavRail({ activeTab, onChange, lang, items }) {
  const navigate = useNavigate();
  const navItems = items || RAIL_ITEMS;
  return (
    <nav className="csp-rail" role="navigation" aria-label="Profile navigation">
      <div className="csp-rail-logo" aria-label="Atelnyo" title="Atelnyo">
        D
      </div>
      <div className="csp-rail-divider" aria-hidden="true" />
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={`csp-rail-item ${isActive ? 'csp-rail-item--active' : ''}`}
            onClick={() => onChange(item.id)}
            aria-label={lang === 'ht' ? item.labelHt : item.label}
            title={lang === 'ht' ? item.labelHt : item.label}
          >
            <i className={`fas ${item.icon}`} aria-hidden="true" />
            <span className="csp-rail-tooltip">
              {lang === 'ht' ? item.labelHt : item.label}
            </span>
          </button>
        );
      })}
      <div className="csp-rail-spacer" aria-hidden="true" />
      <div className="csp-rail-divider" aria-hidden="true" />
      {/* Cross-link: profile → Help Center (deep link to the profile topic) */}
      <button
        type="button"
        className="csp-rail-item"
        onClick={() => navigate('/help/profile')}
        aria-label={lang === 'ht' ? 'Èd' : 'Help'}
        title={lang === 'ht' ? 'Èd' : 'Help'}
      >
        <i className="fas fa-circle-question" aria-hidden="true" />
        <span className="csp-rail-tooltip">{lang === 'ht' ? 'Èd' : 'Help'}</span>
      </button>
      <button
        type="button"
        className="csp-rail-item"
        aria-label="Settings"
        title="Settings"
      >
        <i className="fas fa-cog" aria-hidden="true" />
        <span className="csp-rail-tooltip">Settings</span>
      </button>
    </nav>
  );
}
