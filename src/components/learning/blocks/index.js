/**
 * Block system barrel exports.
 *
 * Usage:
 *   import { BlockRenderer, BLOCK_TYPES, getBlockTypesByCategory } from './blocks';
 *   import { validateBlock, validateLessonBlocks, scoreLessonContent } from './blocks/blockSchema';
 */
export { default as BlockRenderer } from './BlockRenderer';
export {
  BLOCK_TYPES,
  BLOCK_REGISTRY,
  getBlockComponent,
  getBlockMeta,
  getBlockTypesByCategory,
  blockTypeLabel,
} from './registry';
export {
  BLOCK_SCHEMAS,
  validateBlock,
  validateLessonBlocks,
  validateCourseContent,
  migrateBlock,
  migrateLessonBlocks,
  scoreLessonContent,
  registerMigration,
  schema,
  field,
} from './blockSchema';
