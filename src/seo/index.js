/**
 * src/seo/index.js
 *
 * Barrel export for the Atelnyo SEO Engine.
 */
export { default as useSEO } from './useSEO';
export {
  matchSEOConfig,
  isIndexable,
  getRobotsDirective,
  SITE_NAME,
  BASE_URL,
} from './seoConfig';
export {
  organizationSchema,
  websiteSchema,
  courseSchema,
  profileSchema,
  musicSchema,
  talentSchema,
  productSchema,
  jobSchema,
  faqPageSchema,
  breadcrumbSchema,
} from './schemas';
