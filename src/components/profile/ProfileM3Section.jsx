/**
 * src/components/profile/ProfileM3Section.jsx
 *
 * Tier-1 leaf — extracted from CreatorPublicProfile.jsx (stage A-1 refactor).
 *
 * Material Design 3 flavored section wrapper. Auto-hides empty sections.
 * Style hooks: .csp-card-m3, .csp-card-m3-header, .csp-card-m3-icon,
 *              .csp-card-m3-title. See public-profile.css.
 *
 * Props:
 *   - icon     — Font-Awesome class (e.g. 'fa-user')
 *   - title    — section title text
 *   - children — section body content
 *   - empty    — boolean: if true AND no children, return null (auto-hide)
 *   - configId — data-config-id for section_config targeting
 *
 * STAGE A-1: zero behavior change. Exact verbatim copy.
 */

import React from 'react';

export default function ProfileM3Section({ icon, title, children, empty, configId }) {
  if (!children && empty) return null;
  return (
    <div className="csp-card-m3" data-config-id={configId}>
      <div className="csp-card-m3-header">
        <span className="csp-card-m3-icon"><i className={`fas ${icon}`} aria-hidden="true" /></span>
        <span className="csp-card-m3-title">{title}</span>
      </div>
      {children}
    </div>
  );
}
