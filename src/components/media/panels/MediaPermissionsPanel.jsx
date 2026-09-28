/**
 * MediaPermissionsPanel — Permissions tab content (Slice 0 retro + Phase-2).
 *
 * Surfaces visibility, role-based access summary, and modules where
 * media appears. The role-list `value` field was a dead key in the
 * prior version (no consumer iterated by it); the field has been kept
 * on each chip because it now serves as the React `key` prop on the
 * <li>, eliminating any index-key warning and giving the list a
 * semantic identity.
 *
 * Visibility tile + role list + module list — all use the canonical
 * VISIBILITY_LABELS / moduleLabel helpers exported from
 * src/constants/media.
 */
import React from 'react';
import { VISIBILITY_LABELS, moduleLabel } from '../../../constants/media';

export default function MediaPermissionsPanel({ media, lang = 'ht' }) {
  const item = media || {};
  const isHt = lang === 'ht';
  const visibility = item.visibility || 'public';
  const visMeta = VISIBILITY_LABELS[visibility] || VISIBILITY_LABELS.public;
  const owner = item.owner_username || item.owner || '—';
  const allowedRoles = computeAllowedRoles(visibility);

  return (
    <div className="media-panel media-panel-permissions">
      <div className="media-panel-permissions-summary">
        <div className="media-panel-perms-tile" style={{ borderColor: visMeta.color }}>
          <i className={`fas ${visMeta.icon}`} style={{ color: visMeta.color }} aria-hidden="true" />
          <div className="media-panel-perms-tile-body">
            <span className="media-panel-perms-label">{isHt ? 'Vizibilite' : 'Visibility'}</span>
            <span className="media-panel-perms-value">{isHt ? visMeta.ht : visMeta.en}</span>
          </div>
        </div>
        <div className="media-panel-perms-tile">
          <i className="fas fa-user-shield" aria-hidden="true" />
          <div className="media-panel-perms-tile-body">
            <span className="media-panel-perms-label">{isHt ? 'Pwopriyetè' : 'Owner'}</span>
            <span className="media-panel-perms-value">{owner}</span>
          </div>
        </div>
      </div>

      <h4 className="media-panel-perms-section-title">
        <i className="fas fa-users" aria-hidden="true" />
        {isHt ? 'Ròl ki gen aksè' : 'Roles with access'}
      </h4>
      <ul className="media-panel-perms-role-list">
        {allowedRoles.map((role) => (
          <li
            key={role.value}
            className="media-panel-perms-role-chip"
            style={role.role === 'denied' ? { opacity: 0.45 } : undefined}
          >
            <i className={`fas ${role.icon}`} aria-hidden="true" />
            <span>{isHt ? role.ht : role.en}</span>
          </li>
        ))}
      </ul>

      <h4 className="media-panel-perms-section-title">
        <i className="fas fa-cubes" aria-hidden="true" />
        {isHt ? 'Modil kote medya a parèt' : 'Modules where media appears'}
      </h4>
      <ul className="media-panel-perms-module-list">
        {(Array.isArray(item.usages) ? item.usages : []).slice(0, 10).map((u) => (
          <li key={u.module ? `${u.module}-${u.module_id || u.name}` : (u.module_id || Math.random())}>
            <i className="fas fa-link" aria-hidden="true" />
            {moduleLabel(u.module, isHt)} — <span className="media-panel-perms-mod-id">{u.module_id || u.name || '—'}</span>
          </li>
        ))}
        {Array.isArray(item.usages) && item.usages.length > 10 && (
          <li className="media-panel-perms-more">+{item.usages.length - 10} {isHt ? 'plis' : 'more'}</li>
        )}
        {!Array.isArray(item.usages) || item.usages.length === 0 && (
          <li className="media-panel-perms-empty">{isHt ? 'Pa gen modil ki itilize medya sa a.' : 'No modules use this media.'}</li>
        )}
      </ul>
    </div>
  );
}

function computeAllowedRoles(visibility) {
  const base = [
    { value: 'owner', en: 'Owner', ht: 'Pwopriyetè', icon: 'fa-user',        role: 'allowed' },
    { value: 'admin', en: 'Admin', ht: 'Admin',     icon: 'fa-user-shield', role: 'allowed' },
  ];
  const conditional = {
    public:    [{ value: 'public',     en: 'Public',     ht: 'Piblik',     icon: 'fa-globe',          role: 'allowed' }],
    followers: [{ value: 'followers',  en: 'Followers',  ht: 'Abonnen',    icon: 'fa-users',          role: 'allowed' }],
    students:  [{ value: 'students',   en: 'Students',   ht: 'Elèv',       icon: 'fa-graduation-cap', role: 'allowed' }],
    customers: [{ value: 'customers',  en: 'Customers',  ht: 'Kliyan',     icon: 'fa-shopping-bag',   role: 'allowed' }],
    community: [{ value: 'community',  en: 'Community',  ht: 'Kominote',   icon: 'fa-comments',       role: 'allowed' }],
    purchased: [{ value: 'purchasers', en: 'Purchasers', ht: 'Moun ki Achte', icon: 'fa-receipt',     role: 'allowed' }],
    private:   [],
    unlisted:  [{ value: 'link_only',  en: 'Anyone with the link', ht: 'Nenpòt moun ki genyen URL', icon: 'fa-link', role: 'allowed' }],
  };
  return [...base, ...(conditional[visibility] || [])];
}
