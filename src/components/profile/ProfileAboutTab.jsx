/**
 * src/components/profile/ProfileAboutTab.jsx
 *
 * Tier-2 stem — extracted from CreatorPublicProfile.jsx (stage A-2 refactor).
 *
 * Renders the About tab: bio, skills, languages, website, social links,
 * contact email, availability.
 *
 * STAGE A-2: zero behavior change. Verbatim copy from monolith.
 */

import React from 'react';

export default function AboutTab({ profile, lang, t, isOwner }) {
  if (!profile) return null;
  const labels = {
    bio: t.profile_bio_label || 'Biography',
    experience: t.profile_experience_label || (lang === 'ht' ? 'Eksperyans' : 'Experience'),
    education: t.profile_education_label || (lang === 'ht' ? 'Edikasyon' : 'Education'),
    skills: t.profile_skills_label || 'Skills',
    languages: t.profile_languages_label || 'Languages',
    website: t.profile_website_label || 'Website',
    social: t.profile_social_label || 'Social Links',
    contact: t.profile_contact_label || 'Contact',
    phone: t.profile_phone_label || (lang === 'ht' ? 'Telefòn' : 'Phone'),
    availability: t.profile_availability_label || 'Availability',
  };
  return (
    <div className="csp-about">
      {profile.bio && (
        <div className="csp-about-block">
          <div className="csp-about-label">{labels.bio}</div>
          <div className="csp-about-value">{profile.bio}</div>
        </div>
      )}
      {/* Experience — real data from CreatorPublicProfile.experience
          (list of {title, company, period, description}). Was stored and
          editable but never rendered; uses the pre-existing
          .csp-about-list styles. */}
      {profile.experience?.length > 0 && (
        <div className="csp-about-block">
          <div className="csp-about-label">{labels.experience}</div>
          <ul className="csp-about-list">
            {profile.experience.map((exp, i) => (
              <li key={i}>
                {exp.title && <div className="csp-about-list-title">{exp.title}</div>}
                {(exp.company || exp.period) && (
                  <div className="csp-about-list-meta">{[exp.company, exp.period].filter(Boolean).join(' · ')}</div>
                )}
                {exp.description && <div className="csp-about-list-meta">{exp.description}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* Education — real data from CreatorPublicProfile.education
          (list of {institution, degree, year, description}). */}
      {profile.education?.length > 0 && (
        <div className="csp-about-block">
          <div className="csp-about-label">{labels.education}</div>
          <ul className="csp-about-list">
            {profile.education.map((edu, i) => (
              <li key={i}>
                {(edu.degree || edu.institution) && (
                  <div className="csp-about-list-title">{[edu.degree, edu.institution].filter(Boolean).join(' — ')}</div>
                )}
                {edu.year && <div className="csp-about-list-meta">{edu.year}</div>}
                {edu.description && <div className="csp-about-list-meta">{edu.description}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {profile.skills?.length > 0 && (
        <div className="csp-about-block">
          <div className="csp-about-label">{labels.skills}</div>
          <div className="csp-skills-row">
            {profile.skills.map((skill, i) => (
              <span key={i} className="csp-skill-chip">{skill}</span>
            ))}
          </div>
        </div>
      )}
      {profile.languages?.length > 0 && (
        <div className="csp-about-block">
          <div className="csp-about-label">{labels.languages}</div>
          <div className="csp-lang-row">
            {profile.languages.map((code, i) => (
              <div key={i} className="csp-lang-item">
                <span className="csp-lang-name">{code.toUpperCase()}</span>
                <span className="csp-lang-level">Native</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {profile.website_url && (
        <div className="csp-about-block">
          <div className="csp-about-label">{labels.website}</div>
          <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="csp-social-link">
            <i className="fas fa-globe" aria-hidden="true" /> {profile.website_url}
          </a>
        </div>
      )}
      {(() => {
        // Handle both formats: {platform: url} (dict) or [{platform, url}] (array)
        const raw = profile.social_links;
        let entries = [];
        if (Array.isArray(raw)) {
          entries = raw
            .filter((l) => l && typeof l === 'object' && l.url)
            .map((l) => [l.platform || 'link', l.url]);
        } else if (raw && typeof raw === 'object') {
          entries = Object.entries(raw).filter(([, v]) => v);
        }
        if (entries.length === 0) return null;
        return (
          <div className="csp-about-block">
            <div className="csp-about-label">{labels.social}</div>
            <div className="csp-skills-row">
              {entries.map(([platform, url]) => (
                <a key={platform} href={typeof url === 'string' && url.startsWith('http') ? url : `https://${url || ''}`}
                  target="_blank" rel="noopener noreferrer" className="csp-social-link">
                  <i className={`fab fa-${platform}`} aria-hidden="true" /> {platform}
                </a>
              ))}
            </div>
          </div>
        );
      })()}
      {/* PRIVACY: contact email/phone are creator-confidential PII — only
          the owner sees them (the API also omits them for visitors). */}
      {isOwner && (profile.contact_email || profile.contact_phone) && (
        <div className="csp-about-block">
          <div className="csp-about-label">{labels.contact}</div>
          {profile.contact_email && (
            <a href={`mailto:${profile.contact_email}`} className="csp-social-link">
              <i className="fas fa-envelope" aria-hidden="true" /> {profile.contact_email}
            </a>
          )}
          {profile.contact_phone && (
            <a href={`tel:${profile.contact_phone}`} className="csp-social-link">
              <i className="fas fa-phone" aria-hidden="true" /> {profile.contact_phone}
            </a>
          )}
        </div>
      )}
      {profile.availability && (
        <div className="csp-about-block">
          <div className="csp-about-label">{labels.availability}</div>
          <div className="csp-about-value">{profile.availability}</div>
        </div>
      )}
    </div>
  );
}
