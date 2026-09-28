/**
 * src/seo/schemas.js
 *
 * Centralized structured-data (JSON-LD) generators for Atelnyo.
 * Every schema type is generated from real entity data — never fabricated.
 *
 * Usage:
 *   import { courseSchema, profileSchema, ... } from '../seo/schemas';
 *   <SEOHead schema={courseSchema(course)} />
 */

const SITE_NAME = 'Atelnyo';
const BASE_URL = 'https://atelnyo.site';

function truncate(str, max = 300) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 3).trimEnd() + '...' : str;
}

// ─── Organization (homepage) ─────────────────────────────────────────
export function organizationSchema() {
  return {
    '@type': 'EducationalOrganization',
    name: SITE_NAME,
    url: BASE_URL,
    logo: `${BASE_URL}/og-banner-en.svg`,
    description: 'An international platform empowering creators, educators, and entrepreneurs with courses, music, products, and business tools.',
    foundingDate: '2024',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'HT',
    },
    sameAs: [
      'https://github.com/Atelnyo',
      'https://twitter.com/Atelnyo',
      'https://facebook.com/Atelnyo',
      'https://linkedin.com/company/atelnyo',
      'https://youtube.com/@Atelnyo',
      'https://instagram.com/atelnyo',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'support@atelnyo.site',
      availableLanguage: ['English', 'Haitian Creole', 'French', 'Spanish'],
    },
  };
}

// ─── WebSite (homepage) ──────────────────────────────────────────────
export function websiteSchema() {
  return {
    '@type': 'WebSite',
    name: SITE_NAME,
    url: BASE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${BASE_URL}/explore?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

// ─── Course ───────────────────────────────────────────────────────────
export function courseSchema(course, creatorName) {
  if (!course) return null;
  // Canonical course URL is /{slug}/by/{creator}/course; fall back to
  // the legacy /sheet/course/{id} route when the creator is unknown.
  const creator = course.created_by_username || creatorName;
  const canonicalPath = (course.slug && creator)
    ? `/${course.slug}/by/${creator}/course`
    : `/sheet/course/${course.id || ''}`;
  return {
    '@type': 'Course',
    name: course.title,
    description: truncate(course.description || course.short_description),
    image: course.image_url || `${BASE_URL}/og-banner-en.svg`,
    url: `${BASE_URL}${canonicalPath}`,
    provider: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: BASE_URL,
    },
    ...(creatorName && {
      author: {
        '@type': 'Person',
        name: creatorName,
      },
    }),
    ...(course.price != null && {
      offers: {
        '@type': 'Offer',
        price: course.price,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
    }),
    ...(course.difficulty && {
      educationalLevel: course.difficulty,
    }),
    ...(course.teaching_language && {
      inLanguage: course.teaching_language,
    }),
  };
}

// ─── Profile / Person ────────────────────────────────────────────────
export function profileSchema(profile) {
  if (!profile?.username) return null;
  return {
    '@type': 'Person',
    name: profile.display_name || profile.artist_name || profile.username,
    description: profile.seo_description || profile.bio || '',
    ...(profile.avatar_url && { image: profile.avatar_url }),
    url: `${BASE_URL}/c/${profile.username}`,
    memberOf: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: BASE_URL,
    },
    ...(Array.isArray(profile.social_links) && profile.social_links.length > 0 && {
      sameAs: profile.social_links.filter((l) => l?.url).map((l) => l.url),
    }),
    ...(Array.isArray(profile.skills) && profile.skills.length > 0 && {
      knowsAbout: profile.skills,
    }),
    ...(Array.isArray(profile.languages) && profile.languages.length > 0 && {
      knowsLanguage: profile.languages.map((l) =>
        typeof l === 'string' ? l : l.name || l
      ),
    }),
    ...(profile.country && {
      homeLocation: {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          addressCountry: profile.country,
        },
      },
    }),
    ...(profile.courses_count > 0 || profile.products_count > 0 ? {
      makesOffer: [
        ...(profile.courses_count > 0 ? [{
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Course',
            name: `${profile.display_name || profile.username}'s courses`,
          },
        }] : []),
        ...(profile.products_count > 0 ? [{
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Product',
            name: `${profile.display_name || profile.username}'s products`,
          },
        }] : []),
      ],
    } : {}),
  };
}

// ─── Music Recording ─────────────────────────────────────────────────
export function musicSchema(track, artistName) {
  if (!track) return null;
  return {
    '@type': 'MusicRecording',
    name: track.title,
    byArtist: {
      '@type': 'Person',
      name: artistName || track.artist || 'Unknown',
    },
    ...(track.genre && { genre: track.genre }),
    ...(track.image_url && { image: track.image_url }),
  };
}

// ─── Talent / Person ─────────────────────────────────────────────────
export function talentSchema(talent) {
  if (!talent) return null;
  return {
    '@type': 'Person',
    name: talent.name,
    jobTitle: talent.role || 'Creator',
    description: talent.bio || '',
    ...(talent.image_url && { image: talent.image_url }),
    ...(talent.location && {
      address: {
        '@type': 'PostalAddress',
        addressLocality: talent.location,
      },
    }),
    ...(Array.isArray(talent.skills) && talent.skills.length > 0 && {
      knowsAbout: talent.skills,
    }),
  };
}

// ─── Product ─────────────────────────────────────────────────────────
export function productSchema(product) {
  if (!product) return null;
  return {
    '@type': 'Product',
    name: product.title,
    description: truncate(product.description),
    image: product.image_url || `${BASE_URL}/og-banner-en.svg`,
    ...(product.price != null && {
      offers: {
        '@type': 'Offer',
        price: product.price,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      },
    }),
  };
}

// ─── Job Posting ─────────────────────────────────────────────────────
export function jobSchema(job) {
  if (!job) return null;
  return {
    '@type': 'JobPosting',
    title: job.title,
    description: truncate(job.description),
    ...(job.location && {
      jobLocation: {
        '@type': 'Place',
        address: job.location,
      },
    }),
    ...(job.is_remote && {
      jobLocation: {
        '@type': 'Place',
        address: 'Remote',
      },
    }),
    ...(job.budget_min != null && {
      baseSalary: {
        '@type': 'MonetaryAmount',
        minValue: job.budget_min,
        maxValue: job.budget_max || job.budget_min,
        currency: 'USD',
      },
    }),
  };
}

// ─── FAQ Page ────────────────────────────────────────────────────────
export function faqPageSchema(faqs) {
  if (!Array.isArray(faqs) || faqs.length === 0) return null;
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

// ─── BreadcrumbList ──────────────────────────────────────────────────
export function breadcrumbSchema(breadcrumbs) {
  if (!Array.isArray(breadcrumbs) || breadcrumbs.length === 0) return null;
  return {
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((b, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: b.label,
      ...(b.url && {
        item: b.url.startsWith('http') ? b.url : `${BASE_URL}${b.url}`,
      }),
    })),
  };
}
