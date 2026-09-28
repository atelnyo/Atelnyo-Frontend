/**
 * src/components/shared/SEOHead.jsx
 *
 * Reusable SEO component for dynamic meta tags, Open Graph, Twitter Card,
 * and structured data (JSON-LD). Every public-facing page should wrap its
 * <Helmet> through this component for consistent SEO output.
 *
 * Usage:
 *   <SEOHead
 *     title="Course Title"
 *     description="Course description..."
 *     image="https://atelnyo.site/og-banner-en.svg"
 *     url="https://atelnyo.site/@creator/course-slug"
 *     type="course"           // og:type
 *     schema={courseSchema}   // optional JSON-LD object
 *   />
 */
import React from 'react';
import { Helmet } from 'react-helmet-async';
import { parseLocaleCountry } from '../../utils/localeUrl';

const SITE_NAME = 'Atelnyo';
const DEFAULT_IMAGE = 'https://atelnyo.site/og-banner-en.svg';
const DEFAULT_DESCRIPTION = 'Atelnyo is an international platform where creators teach online courses, share music, sell products, and grow their digital presence.';
const BASE_URL = 'https://atelnyo.site';

// Truncate description to ~160 chars for meta tags
function truncate(str, max = 160) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 3).trimEnd() + '...' : str;
}

// Per-locale canonical helper: prefixes the page path with the active
// locale segment ('ht-HT', 'fr-CA', …) the same way App.jsx's switcher
// and the sitemap build localized URLs. Bare/empty locale → bare URL.
function buildLocaleUrl(pathname = '/', locale = '') {
  const cleanPath = pathname && pathname !== '/' ? pathname.replace(/\/+$/, '') : '/';
  const normalizedPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  if (!locale || locale === 'en-US' || locale === 'en') {
    return `${BASE_URL}${normalizedPath}`;
  }
  if (normalizedPath.startsWith(`/${locale}`)) {
    return `${BASE_URL}${normalizedPath}`;
  }
  return `${BASE_URL}/${locale}${normalizedPath === '/' ? '' : normalizedPath}`;
}

export default function SEOHead({
  title,
  description,
  image,
  url,
  type = 'website',
  schema,
  author,
  publishedTime,
  modifiedTime,
  noindex = false,
  lang = 'en',
  breadcrumbs,
  keywords,
  // locale: the current page's locale segment (e.g. 'en-US', 'ht-HT').
  // When set, SEOHead builds the per-locale canonical (/ht-HT/help…).
  // When not passed, it is DERIVED from the URL so every page
  // self-canonicalizes on localized URLs (hreflang requires each
  // language version to be self-referencing). (hreflang alternates
  // live in App.jsx's global <Helmet> — see below.)
  locale = '',
}) {
  const pageTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const pageDesc = truncate(description) || DEFAULT_DESCRIPTION;
  const pageImage = image || DEFAULT_IMAGE;

  const normalizedUrl = url && url !== '/' ? (url.startsWith('/') ? url : `/${url}`) : '/';
  // Explicit prop wins; otherwise read the URL's locale segment so
  // localized pages (/ht-HT/, /fr-CA/about…) self-canonicalize even
  // when the component was mounted without a locale prop.
  const urlParsed = typeof window !== 'undefined'
    ? parseLocaleCountry(window.location.pathname)
    : null;
  const activeLocale = locale || (urlParsed?.valid ? urlParsed.tag : '');
  const canonicalPath = activeLocale && activeLocale !== 'en-US' && activeLocale !== 'en'
    ? `/${activeLocale}${normalizedUrl === '/' ? '' : normalizedUrl}`
    : normalizedUrl;
  const pageUrl = buildLocaleUrl(canonicalPath, activeLocale);

  return (
    <Helmet>
      {/* Basic */}
      <title>{pageTitle}</title>
      <meta name="description" content={pageDesc} />
      {/* Canonical only on indexable pages: a noindexed 404 must not
          tell Google "this URL's canonical is the homepage". */}
      {!noindex && <link rel="canonical" href={pageUrl} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {keywords && keywords.length > 0 && (
        <meta name="keywords" content={Array.isArray(keywords) ? keywords.join(', ') : keywords} />
      )}

      {/* Open Graph — og:locale + og:locale:alternate are NOT emitted
          here: App.jsx's global <Helmet> owns them (it knows the active
          market, which this component does not). */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDesc} />
      <meta property="og:image" content={pageImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* hreflang alternates are NOT emitted here: App.jsx's global
          <Helmet> is the SINGLE owner (it covers every route via
          effectivePathname — including pages without SEOHead — and its
          alternates track the active market context). Duplicate sets
          from two components made every tag appear twice. */}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@Atelnyo" />
      {author && <meta name="twitter:creator" content={author.startsWith('@') ? author : `@${author}`} />}
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDesc} />
      <meta name="twitter:image" content={pageImage} />

      {/* Facebook */}
      <meta property="fb:app_id" content="934278055774246" />

      {/* Article-specific */}
      {author && <meta name="author" content={author} />}
      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}

      {/* Structured Data */}
      {schema && (
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            ...schema,
          })}
        </script>
      )}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: breadcrumbs.map((b, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: b.label,
              ...(b.url ? { item: b.url.startsWith('http') ? b.url : `${BASE_URL}${b.url}` } : {}),
            })),
          })}
        </script>
      )}
    </Helmet>
  );
}

// ─── Pre-built schema generators ──────────────────────────────────────

export function courseSchema(course, creatorName) {
  // Canonical course URL is /{slug}/by/{creator}/course; fall back to
  // the legacy /sheet/course/{id} route when the creator is unknown.
  const creator = course.created_by_username || creatorName;
  const canonicalPath = (course.slug && creator)
    ? `/${course.slug}/by/${creator}/course`
    : `/sheet/course/${course.id || ''}`;
  return {
    '@type': 'Course',
    name: course.title,
    description: truncate(course.description, 300),
    image: course.image_url || DEFAULT_IMAGE,
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
    keywords: [
      course.title,
      course.category,
      course.difficulty,
      course.teaching_language,
      ...(Array.isArray(course.tags) ? course.tags : []),
    ].filter(Boolean).join(', '),
  };
}

export function musicSchema(track, artistName) {
  return {
    '@type': 'MusicRecording',
    name: track.title,
    byArtist: {
      '@type': 'Person',
      name: artistName || track.artist || 'Unknown',
    },
    ...(track.genre && {
      genre: track.genre,
    }),
    ...(track.image_url && {
      image: track.image_url,
    }),
  };
}

export function talentSchema(talent) {
  return {
    '@type': 'Person',
    name: talent.name,
    jobTitle: talent.role || 'Creator',
    description: talent.bio || '',
    ...(talent.image_url && {
      image: talent.image_url,
    }),
    ...(talent.location && {
      address: {
        '@type': 'PostalAddress',
        addressLocality: talent.location,
      },
    }),
    ...(talent.skills?.length && {
      knowsAbout: talent.skills,
    }),
  };
}

export function productSchema(product) {
  return {
    '@type': 'Product',
    name: product.title,
    description: truncate(product.description, 300),
    image: product.image_url || DEFAULT_IMAGE,
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

export function jobSchema(job) {
  return {
    '@type': 'JobPosting',
    title: job.title,
    description: truncate(job.description, 300),
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

export function organizationSchema() {
  return {
    '@type': 'EducationalOrganization',
    name: SITE_NAME,
    url: BASE_URL,
    logo: `${BASE_URL}/og-banner-en.svg`,
    description: DEFAULT_DESCRIPTION,
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

export function webSiteSchema() {
  return {
    '@type': 'WebSite',
    name: SITE_NAME,
    url: BASE_URL,
    description: DEFAULT_DESCRIPTION,
    publisher: {
      '@type': 'EducationalOrganization',
      name: SITE_NAME,
      url: BASE_URL,
      logo: `${BASE_URL}/og-banner-en.svg`,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/explore?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function profileSchema(profile, { courses = [], products = [], portfolio = [], reviews = [] } = {}) {
  if (!profile?.username) return null;
  const displayName = profile.display_name || profile.artist_name || profile.username;
  const baseUrl = `${BASE_URL}/c/${profile.username}`;

  return {
    '@type': 'Person',
    name: displayName,
    description: profile.seo_description || profile.bio || '',
    ...(profile.avatar_url && { image: profile.avatar_url }),
    url: baseUrl,
    ...(profile.seo_description || profile.bio ? { about: profile.seo_description || profile.bio } : {}),

    // Professional identity
    ...(profile.artist_name && profile.artist_name !== displayName && {
      alternateName: profile.artist_name,
    }),
    ...(profile.tagline && { headline: profile.tagline }),
    jobTitle: profile.artist_name ? 'Creator' : (profile.is_verified ? 'Verified Creator' : 'Creator'),

    // Contact info (helps Google build knowledge panel)
    ...(profile.contact_email && { email: `mailto:${profile.contact_email}` }),
    ...(profile.contact_phone && { telephone: profile.contact_phone }),
    ...(profile.website_url && { website: profile.website_url }),

    // Organization membership
    memberOf: {
      '@type': 'Organization',
      name: SITE_NAME,
      url: BASE_URL,
    },

    // Social profiles (sameAs = knowledge graph connections)
    ...(profile.social_links?.length > 0 && {
      sameAs: profile.social_links
        .filter((link) => link?.url)
        .map((link) => link.url),
    }),

    // Skills / expertise (knowledge graph surfacing)
    ...(profile.skills?.length > 0 && {
      knowsAbout: profile.skills,
    }),

    // Languages
    ...(profile.languages?.length > 0 && {
      knowsLanguage: profile.languages.map((l) =>
        typeof l === 'string' ? l : l.name || l
      ),
    }),

    // Location (detailed)
    ...(profile.country && {
      homeLocation: {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          addressCountry: profile.country,
          ...(profile.city && { addressLocality: profile.city }),
          ...(profile.postal_code && { postalCode: profile.postal_code }),
        },
      },
      ...(profile.country && { nationality: profile.country }),
    }),

    // Education (if available)
    ...(profile.education?.length > 0 && {
      alumniOf: profile.education.map((edu) => ({
        '@type': 'EducationalOrganization',
        name: edu.institution || edu.name || '',
        ...(edu.degree && { description: edu.degree }),
      })).filter((e) => e.name),
    }),

    // Experience (if available)
    ...(profile.experience?.length > 0 && {
      workLocation: {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          addressCountry: profile.country || '',
        },
      },
    }),

    // What the creator offers — REAL items when available, not just counts.
    // This tells Google exactly what this person teaches/sells.
    ...(courses.length > 0 || products.length > 0 ? {
      makesOffer: [
        ...courses.slice(0, 10).map((c) => ({
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Course',
            name: c.title || `${displayName}'s course`,
            ...(c.description && { description: truncate(c.description, 200) }),
            ...(c.image_url && { image: c.image_url }),
            url: c.slug && c.created_by_username
              ? `${BASE_URL}/${c.slug}/by/${c.created_by_username}/course`
              : undefined,
            provider: { '@type': 'Organization', name: SITE_NAME, url: BASE_URL },
            ...(c.price != null && {
              offers: {
                '@type': 'Offer',
                price: c.price,
                priceCurrency: 'USD',
              },
            }),
          },
        })),
        ...products.slice(0, 10).map((p) => ({
          '@type': 'Offer',
          itemOffered: {
            '@type': 'Product',
            name: p.title || `${displayName}'s product`,
            ...(p.description && { description: truncate(p.description, 200) }),
            ...(p.image_url && { image: p.image_url }),
            url: p.slug ? `${BASE_URL}/marketplace/${p.slug}` : undefined,
            ...(p.price != null && {
              offers: {
                '@type': 'Offer',
                price: p.price,
                priceCurrency: p.currency || 'USD',
              },
            }),
          },
        })),
      ],
    } : {
      // Fallback: count-only when items not loaded
      ...(profile.courses_count > 0 || profile.products_count > 0 ? {
        makesOffer: [
          ...(profile.courses_count > 0 ? [{
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Course',
              name: `${displayName}'s courses`,
              provider: { '@type': 'Organization', name: SITE_NAME, url: BASE_URL },
            },
          }] : []),
          ...(profile.products_count > 0 ? [{
            '@type': 'Offer',
            itemOffered: {
              '@type': 'Product',
              name: `${displayName}'s products`,
              provider: { '@type': 'Organization', name: SITE_NAME, url: BASE_URL },
            },
          }] : []),
        ],
      } : {}),
    }),

    // Portfolio — actual project titles help Google understand the body of work
    ...(portfolio.length > 0 && {
      workExample: portfolio.slice(0, 5).map((p) => ({
        '@type': 'CreativeWork',
        name: p.title || 'Portfolio project',
        ...(p.description && { description: truncate(p.description, 200) }),
        ...(p.cover_url && { image: p.cover_url }),
      })),
    }),

    // Reviews — social proof helps Google rank + knowledge panel
    ...(reviews.length > 0 && {
      review: reviews.slice(0, 5).map((r) => ({
        '@type': 'Review',
        reviewBody: truncate(r.comment || r.text || '', 300),
        reviewRating: r.rating ? {
          '@type': 'Rating',
          ratingValue: r.rating,
          bestRating: 5,
        } : undefined,
        author: r.author_name ? { '@type': 'Person', name: r.author_name } : undefined,
      })).filter((r) => r.reviewBody || r.reviewRating),
    }),

    // Social proof (follower/student counts help Google rank)
    ...(profile.followers_count > 0 && {
      interactionStatistic: [
        {
          '@type': 'InteractionCounter',
          interactionType: 'https://schema.org/FollowAction',
          userInteractionCount: profile.followers_count,
        },
        ...(profile.students_count > 0 ? [{
          '@type': 'InteractionCounter',
          interactionType: 'https://schema.org/SubscribeAction',
          userInteractionCount: profile.students_count,
        }] : []),
      ],
    }),

    // Verification badge (helps Google trust the entity)
    ...(profile.is_verified && {
      additionalType: 'https://schema.org/VerifiedPerson',
    }),

    // Achievements / awards
    ...(profile.achievements?.length > 0 && {
      award: profile.achievements.map((a) => a.title || a.name || a).filter(Boolean),
    }),
  };
}
