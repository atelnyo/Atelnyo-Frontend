/**
 * src/modules/explore/cards/index.js
 *
 * Card Registry — single entry point for all Explore card components.
 *
 * Usage:
 *   import { CourseCard, MusicCard, CardRegistry } from '../cards';
 *   const Card = CardRegistry['course'].component;
 *   const Skeleton = CardRegistry['course'].skeleton;
 *
 * Each entry maps a content type to its component + skeleton fallback,
 * so rendering code can be type-agnostic:
 *   const { component: Card, skeleton: Skel } = CardRegistry[type];
 *   return items.length ? <Card ... /> : <Skel />;
 */

import React from 'react';
import _CourseCard from './CourseCard';
import _MusicCard from './MusicCard';
import _TalentCard from './TalentCard';
import _CommunityCard from './CommunityCard';
import _PortfolioCard from './PortfolioCard';
import _ProductCard from './ProductCard';
import _EventCard from './EventCard';
import _JobPostCard from './JobPostCard';
import _SpotlightCard from './SpotlightCard';
import _FollowSuggestionCard from './FollowSuggestionCard';
import SectionLabel from './SectionLabel';
import PremiumEmpty from './PremiumEmpty';
import _TrendingVelocity from './TrendingVelocity';
import { VelocitySparkline } from './TrendingVelocity';
import {
  SkeletonCourseCard,
  SkeletonMusicCard,
  SkeletonTalentCard,
} from './skeleton/SkeletonCards';

const CourseCard = React.memo(_CourseCard);
const MusicCard = React.memo(_MusicCard);
const TalentCard = React.memo(_TalentCard);
const CommunityCard = React.memo(_CommunityCard);
const PortfolioCard = React.memo(_PortfolioCard);
const ProductCard = React.memo(_ProductCard);
const EventCard = React.memo(_EventCard);
const JobPostCard = React.memo(_JobPostCard);
const SpotlightCard = React.memo(_SpotlightCard);
const FollowSuggestionCard = React.memo(_FollowSuggestionCard);
const TrendingVelocity = React.memo(_TrendingVelocity);

/** Lookup: content type → { component, skeleton, skeletonComponent } */
export const CardRegistry = {
  course:    { component: CourseCard,    skeleton: 'course' },
  music:     { component: MusicCard,     skeleton: 'music' },
  talent:    { component: TalentCard,    skeleton: 'talent' },
  community: { component: CommunityCard, skeleton: 'course' },
  portfolio: { component: PortfolioCard, skeleton: 'course' },
  product:   { component: ProductCard,   skeleton: 'course' },
  event:     { component: EventCard,     skeleton: 'course' },
  job:       { component: JobPostCard,   skeleton: 'course' },
  spotlight: { component: SpotlightCard, skeleton: 'course' },
  creator:   { component: FollowSuggestionCard, skeleton: 'talent' },
};

/** Map skeleton type string → Skeleton component */
export const SkeletonMap = {
  course:  SkeletonCourseCard,
  music:   SkeletonMusicCard,
  talent:  SkeletonTalentCard,
};

export {
  CourseCard,
  MusicCard,
  TalentCard,
  CommunityCard,
  PortfolioCard,
  ProductCard,
  EventCard,
  JobPostCard,
  SpotlightCard,
  FollowSuggestionCard,
  SectionLabel,
  PremiumEmpty,
  TrendingVelocity,
  VelocitySparkline,
  SkeletonCourseCard,
  SkeletonMusicCard,
  SkeletonTalentCard,
};
