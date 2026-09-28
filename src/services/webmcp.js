/**
 * src/services/webmcp.js
 *
 * WebMCP (Web Model Context Protocol) integration for Atelnyo.
 *
 * Exposes structured tools to AI agents via navigator.modelContext,
 * allowing them to interact with the platform's features directly.
 *
 * WebMCP is a proposed W3C standard that lets websites declare
 * capabilities as structured tools that AI agents can call.
 *
 * Tools exposed:
 *   - search_content: Search courses, music, talents, communities, etc.
 *   - navigate_to: Navigate to a specific page
 *   - get_course_info: Get detailed course information
 *   - get_user_profile: Get current user profile
 *   - toggle_save: Save/unsave a course or content
 *   - enroll_course: Enroll in a free course
 *   - join_community: Join a community
 *   - leave_community: Leave a community
 *   - follow_creator: Follow or unfollow a creator
 *   - open_chatbot: Open or close the chatbot panel
 *   - get_enrollments: List user's enrolled courses
 *   - get_creator_courses: Get courses by a specific creator
 *   - list_communities: Browse or search communities
 *   - get_my_saved: List user's saved/bookmarked items
 *   - get_course_modules: Get modules/syllabus for a course
 *   - search_creators: Search for creators on Atelnyo
 *   - create_course: Create a new course (creator)
 *   - publish_course: Publish a draft course (creator)
 *   - create_music_track: Upload a music track (creator)
 *   - create_talent: Create a talent profile (creator)
 *   - create_job: Post a job listing (creator)
 *   - create_portfolio_project: Add a portfolio project (creator)
 *   - get_learning_dashboard: Get learner progress overview
 *   - get_wallet_balance: Get wallet balance and totals
 *   - get_wallet_transactions: Get transaction history
 *   - message_instructor: Message a course instructor
 *   - get_course_certificate: Get course completion certificate
 *   - get_creator_profile: Get full creator profile details
 *   - get_community_members: List community members
 *   - update_course: Edit course details (owner only)
 *   - delete_course: Delete a course (owner only)
 *   - get_notifications: Get user notifications/activity feed
 *   - get_music_tracks: Browse/list music tracks
 *   - get_music_track: Get a single music track
 *   - get_talents: Browse/list talents
 *   - get_talent: Get a single talent
 *   - get_jobs: Browse/list job listings
 *   - get_job: Get a single job listing
 *   - get_portfolio_projects: Browse/list portfolio projects
 *   - get_products: Browse/list marketplace products
 *   - get_product: Get a single product
 *   - get_events: Get upcoming events
 *   - update_music_track: Edit a music track (owner only)
 *   - delete_music_track: Delete a music track (owner only)
 *   - update_talent: Edit a talent profile (owner only)
 *   - delete_talent: Delete a talent profile (owner only)
 *   - update_job: Edit a job listing (owner only)
 *   - delete_job: Delete a job listing (owner only)
 *   - update_portfolio_project: Edit a portfolio project (owner only)
 *   - delete_portfolio_project: Delete a portfolio project (owner only)
 *   - mark_notification_read: Mark a notification as read
 *   - get_my_contracts: List user's job contracts
 *   - call_api: Generic API call — auto-discovers any endpoint
 *   - get_progress: Get course progress
 *   - get_goals: Get learning goals
 *   - create_goal: Create a learning goal
 *   - toggle_favorite: Toggle course favorite
 *   - get_favorites: List favorite courses
 *   - get_quizzes: Get quizzes for a course
 *   - submit_quiz: Submit quiz answers
 *   - submit_speech: Submit speech for review
 *   - get_course_announcements: Get course announcements
 *   - get_course_notes: Get personal course notes
 *   - get_gamification_stats: Get XP, streak, hearts
 *   - ai_translate: Translate text via AI
 *   - get_language_programs: Browse language programs
 *   - validate_promo_code: Validate a promo code
 *   - complete_block: Mark a learning block as completed
 *   - get_course_syllabus: Get full course syllabus with all blocks
 *   - get_learning_recommendations: Get personalized course recommendations
 */

const SSR_API = import.meta.env.VITE_API_URL || 'https://api.atelnyo.site';

function _getAuthHeaders() {
  const token = localStorage.getItem('access_token');
  return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

// ─── Tool Definitions (JSON Schema format) ───────────────────────
const TOOLS = [
  {
    name: 'search_content',
    description: 'Search for courses, music, talents, communities, jobs, products, or events on Atelnyo. Returns matching results with titles, URLs, and metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (e.g., "javascript courses", "haitian music")',
        },
        types: {
          type: 'string',
          description: 'Comma-separated content types to search: courses, music, talents, communities, jobs, products, events',
          default: 'courses,music,talents',
        },
      },
      required: ['query'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              type: { type: 'string' },
              url: { type: 'string' },
              description: { type: 'string' },
            },
          },
        },
        total: { type: 'number' },
      },
    },
  },
  {
    name: 'navigate_to',
    description: 'Navigate to a specific page on Atelnyo. Supports explore, course pages, creator profiles, and settings.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'URL path to navigate to (e.g., "/explore", "/sheet/settings")',
        },
      },
      required: ['path'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  },
  {
    name: 'get_course_info',
    description: 'Get detailed information about a specific course including title, description, price, creator, and enrollment status.',
    inputSchema: {
      type: 'object',
      properties: {
        course_id: {
          type: 'string',
          description: 'Course ID or slug',
        },
      },
      required: ['course_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        price: { type: 'number' },
        creator: { type: 'string' },
        url: { type: 'string' },
        is_enrolled: { type: 'boolean' },
      },
    },
  },
  {
    name: 'get_user_profile',
    description: 'Get current user profile information including name, avatar, and membership status.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        username: { type: 'string' },
        display_name: { type: 'string' },
        avatar: { type: 'string' },
        is_premium: { type: 'boolean' },
      },
    },
  },
  {
    name: 'toggle_save',
    description: 'Save or unsave a course, music track, or talent. Returns the new save status.',
    inputSchema: {
      type: 'object',
      properties: {
        item_id: {
          type: 'string',
          description: 'ID of the item to save/unsave',
        },
        item_type: {
          type: 'string',
          description: 'Type of item: course, music, talent',
          enum: ['course', 'music', 'talent'],
        },
      },
      required: ['item_id', 'item_type'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        saved: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  },
  {
    name: 'get_product_reviews',
    description: 'Get reviews and ratings for a marketplace product.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: {
          type: 'string',
          description: 'Product ID to get reviews for',
        },
      },
      required: ['product_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        reviews: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              rating: { type: 'number' },
              title: { type: 'string' },
              body: { type: 'string' },
              buyer: { type: 'string' },
              created_at: { type: 'string' },
            },
          },
        },
        avg_rating: { type: 'number' },
        review_count: { type: 'number' },
      },
    },
  },
  {
    name: 'submit_product_review',
    description: 'Submit a review for a marketplace product. Requires authentication and prior purchase.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: {
          type: 'string',
          description: 'Product ID to review',
        },
        rating: {
          type: 'number',
          description: 'Rating from 1 to 5',
          minimum: 1,
          maximum: 5,
        },
        title: {
          type: 'string',
          description: 'Review title (optional)',
        },
        body: {
          type: 'string',
          description: 'Review text (optional)',
        },
      },
      required: ['product_id', 'rating'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        submitted: { type: 'boolean' },
        message: { type: 'string' },
        review_id: { type: 'string' },
      },
    },
  },
  {
    name: 'get_community_info',
    description: 'Get detailed information about a community including name, description, member count, category, and join mode.',
    inputSchema: {
      type: 'object',
      properties: {
        community_slug: {
          type: 'string',
          description: 'Community slug or ID',
        },
      },
      required: ['community_slug'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        slug: { type: 'string' },
        description: { type: 'string' },
        category: { type: 'string' },
        member_count: { type: 'number' },
        join_mode: { type: 'string' },
        is_member: { type: 'boolean' },
        url: { type: 'string' },
      },
    },
  },
  {
    name: 'get_enrollments',
    description: 'List the current user\'s enrolled courses with progress info. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    outputSchema: {
      type: 'object',
      properties: {
        enrollments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              course_id: { type: 'string' },
              title: { type: 'string' },
              creator: { type: 'string' },
              progress: { type: 'number' },
              enrolled_at: { type: 'string' },
              url: { type: 'string' },
            },
          },
        },
        total: { type: 'number' },
      },
    },
  },
  {
    name: 'get_creator_courses',
    description: 'Get courses published by a specific creator. Returns their course catalog.',
    inputSchema: {
      type: 'object',
      properties: {
        creator_slug: {
          type: 'string',
          description: 'Username/slug of the creator',
        },
      },
      required: ['creator_slug'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        courses: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
              price: { type: 'number' },
              url: { type: 'string' },
            },
          },
        },
        total: { type: 'number' },
      },
    },
  },
  {
    name: 'list_communities',
    description: 'Browse or search communities on Atelnyo. Returns community cards with name, description, and member count.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Optional search query to filter communities',
        },
        category: {
          type: 'string',
          description: 'Optional category filter (e.g., "tech", "music", "language")',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 10)',
          default: 10,
        },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        communities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              slug: { type: 'string' },
              description: { type: 'string' },
              member_count: { type: 'number' },
              category: { type: 'string' },
              url: { type: 'string' },
            },
          },
        },
        total: { type: 'number' },
      },
    },
  },
  {
    name: 'get_my_saved',
    description: 'List the current user\'s saved/bookmarked items (courses, music, talents). Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        item_type: {
          type: 'string',
          description: 'Type of saved items: course, music, talent (leave empty for all)',
          enum: ['course', 'music', 'talent'],
        },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              type: { type: 'string' },
              url: { type: 'string' },
            },
          },
        },
        total: { type: 'number' },
      },
    },
  },
  {
    name: 'get_course_modules',
    description: 'Get the modules/syllabus for a specific course, including module titles and lesson counts.',
    inputSchema: {
      type: 'object',
      properties: {
        course_id: {
          type: 'string',
          description: 'Course ID or slug',
        },
      },
      required: ['course_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        course_id: { type: 'string' },
        course_title: { type: 'string' },
        modules: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              index: { type: 'number' },
              title: { type: 'string' },
              lesson_count: { type: 'number' },
            },
          },
        },
        total_modules: { type: 'number' },
      },
    },
  },
  {
    name: 'search_creators',
    description: 'Search for creators on Atelnyo by name or specialty. Returns creator profiles.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (creator name, specialty, etc.)',
        },
        limit: {
          type: 'number',
          description: 'Max results to return (default 10)',
          default: 10,
        },
      },
      required: ['query'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        creators: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              username: { type: 'string' },
              display_name: { type: 'string' },
              bio: { type: 'string' },
              followers: { type: 'number' },
              url: { type: 'string' },
            },
          },
        },
        total: { type: 'number' },
      },
    },
  },
  {
    name: 'create_course',
    description: 'Create a new course on Atelnyo. Requires authentication. The course starts as a draft — use publish_course to make it live.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Course title',
        },
        description: {
          type: 'string',
          description: 'Course description',
        },
        price: {
          type: 'number',
          description: 'Price in USD (0 for free courses)',
          default: 0,
        },
        category: {
          type: 'string',
          description: 'Course category (e.g., "programming", "music", "language")',
        },
        difficulty: {
          type: 'string',
          description: 'Difficulty level',
          enum: ['beginner', 'intermediate', 'advanced'],
          default: 'beginner',
        },
        tags: {
          type: 'string',
          description: 'Comma-separated tags',
        },
        image_url: {
          type: 'string',
          description: 'Cover image URL',
        },
      },
      required: ['title', 'description'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        created: { type: 'boolean' },
        course_id: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
  {
    name: 'publish_course',
    description: 'Publish a draft course to make it live and visible to learners. Requires authentication and course ownership.',
    inputSchema: {
      type: 'object',
      properties: {
        course_id: {
          type: 'string',
          description: 'Course ID or slug to publish',
        },
      },
      required: ['course_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        published: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  },
  {
    name: 'create_music_track',
    description: 'Upload/add a music track to Atelnyo. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Track title',
        },
        artist: {
          type: 'string',
          description: 'Artist name',
        },
        genre: {
          type: 'string',
          description: 'Music genre (e.g., "kompa", "rap", "jazz")',
        },
        cover_url: {
          type: 'string',
          description: 'Cover image URL',
        },
        preview_url: {
          type: 'string',
          description: 'Audio preview URL',
        },
        duration: {
          type: 'string',
          description: 'Track duration (e.g., "3:45")',
        },
        tags: {
          type: 'string',
          description: 'Comma-separated tags',
        },
      },
      required: ['title', 'artist', 'cover_url'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        created: { type: 'boolean' },
        track_id: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
  {
    name: 'create_talent',
    description: 'Create a talent profile on Atelnyo. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Talent name',
        },
        role: {
          type: 'string',
          description: 'Role or specialty (e.g., "Web Developer", "Musician")',
        },
        bio: {
          type: 'string',
          description: 'Short bio or description',
        },
        skills: {
          type: 'string',
          description: 'Comma-separated skills',
        },
        location: {
          type: 'string',
          description: 'Location (e.g., "Port-au-Prince, Haiti")',
        },
        avatar_url: {
          type: 'string',
          description: 'Profile image URL',
        },
      },
      required: ['name', 'role'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        created: { type: 'boolean' },
        talent_id: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
  {
    name: 'create_job',
    description: 'Post a job listing on Atelnyo marketplace. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Job title',
        },
        description: {
          type: 'string',
          description: 'Job description and requirements',
        },
        budget_type: {
          type: 'string',
          description: 'Budget type: fixed or hourly',
          enum: ['fixed', 'hourly'],
          default: 'fixed',
        },
        budget_min: {
          type: 'number',
          description: 'Minimum budget in USD',
        },
        budget_max: {
          type: 'number',
          description: 'Maximum budget in USD',
        },
        skills_required: {
          type: 'string',
          description: 'Comma-separated required skills',
        },
        location: {
          type: 'string',
          description: 'Job location (or "Remote")',
        },
        is_remote: {
          type: 'boolean',
          description: 'Whether the job is remote',
          default: false,
        },
      },
      required: ['title', 'description'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        created: { type: 'boolean' },
        job_id: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
  {
    name: 'create_portfolio_project',
    description: 'Add a project to your portfolio on Atelnyo. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Project title',
        },
        description: {
          type: 'string',
          description: 'Project description',
        },
        category: {
          type: 'string',
          description: 'Project category (e.g., "web", "mobile", "design")',
        },
        project_url: {
          type: 'string',
          description: 'Link to the project',
        },
        cover_url: {
          type: 'string',
          description: 'Cover image URL',
        },
        visibility: {
          type: 'string',
          description: 'Visibility: public or private',
          enum: ['public', 'private'],
          default: 'public',
        },
      },
      required: ['title'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        created: { type: 'boolean' },
        project_id: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
  {
    name: 'get_learning_dashboard',
    description: 'Get the learner\'s dashboard: courses in progress, completed courses, and all enrollments with progress. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    outputSchema: {
      type: 'object',
      properties: {
        continue_learning: { type: 'array' },
        my_courses: { type: 'array' },
        completed: { type: 'array' },
      },
    },
  },
  {
    name: 'get_wallet_balance',
    description: 'Get the current user\'s wallet balance and lifetime totals. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    outputSchema: {
      type: 'object',
      properties: {
        balance: { type: 'number' },
        lifetime_earned: { type: 'number' },
        lifetime_spent: { type: 'number' },
      },
    },
  },
  {
    name: 'get_wallet_transactions',
    description: 'Get the current user\'s wallet transaction history. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Max results (default 20)',
          default: 20,
        },
        type: {
          type: 'string',
          description: 'Filter by transaction type (e.g., "deposit", "purchase", "tip")',
        },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        transactions: { type: 'array' },
        total: { type: 'number' },
      },
    },
  },
  {
    name: 'message_instructor',
    description: 'Send a message to a course instructor. Requires authentication and enrollment in the course.',
    inputSchema: {
      type: 'object',
      properties: {
        course_id: {
          type: 'string',
          description: 'Course ID to message the instructor of',
        },
        body: {
          type: 'string',
          description: 'Message text (max 4000 characters)',
        },
      },
      required: ['course_id', 'body'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        sent: { type: 'boolean' },
        conversation_id: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
  {
    name: 'get_course_certificate',
    description: 'Get the user\'s completion certificate for a course. Returns 404 if not yet earned. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        course_id: {
          type: 'string',
          description: 'Course ID',
        },
      },
      required: ['course_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        certificate_number: { type: 'string' },
        issued_at: { type: 'string' },
        course_title: { type: 'string' },
      },
    },
  },
  {
    name: 'get_creator_profile',
    description: 'Get full details of a creator profile including bio, stats, and links.',
    inputSchema: {
      type: 'object',
      properties: {
        creator_slug: {
          type: 'string',
          description: 'Username/slug of the creator',
        },
      },
      required: ['creator_slug'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        username: { type: 'string' },
        display_name: { type: 'string' },
        bio: { type: 'string' },
        avatar: { type: 'string' },
        followers: { type: 'number' },
        following: { type: 'number' },
        courses_count: { type: 'number' },
        url: { type: 'string' },
      },
    },
  },
  {
    name: 'get_community_members',
    description: 'List members of a community.',
    inputSchema: {
      type: 'object',
      properties: {
        community_slug: {
          type: 'string',
          description: 'Community slug',
        },
      },
      required: ['community_slug'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        members: { type: 'array' },
        total: { type: 'number' },
      },
    },
  },
  {
    name: 'update_course',
    description: 'Update an existing course. Requires authentication and course ownership.',
    inputSchema: {
      type: 'object',
      properties: {
        course_id: {
          type: 'string',
          description: 'Course ID or slug',
        },
        title: {
          type: 'string',
          description: 'New title (optional)',
        },
        description: {
          type: 'string',
          description: 'New description (optional)',
        },
        price: {
          type: 'number',
          description: 'New price (optional)',
        },
        category: {
          type: 'string',
          description: 'New category (optional)',
        },
        difficulty: {
          type: 'string',
          description: 'New difficulty (optional)',
          enum: ['beginner', 'intermediate', 'advanced'],
        },
      },
      required: ['course_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        updated: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  },
  {
    name: 'delete_course',
    description: 'Delete a course permanently. Requires authentication and course ownership. This action cannot be undone.',
    inputSchema: {
      type: 'object',
      properties: {
        course_id: {
          type: 'string',
          description: 'Course ID or slug to delete',
        },
      },
      required: ['course_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        deleted: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  },
  {
    name: 'get_notifications',
    description: 'Get the current user\'s notifications/activity feed. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Max results (default 20)',
          default: 20,
        },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        notifications: { type: 'array' },
        unread_count: { type: 'number' },
      },
    },
  },
  {
    name: 'get_music_tracks',
    description: 'Browse or search music tracks on Atelnyo.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        genre: { type: 'string', description: 'Genre filter' },
        limit: { type: 'number', description: 'Max results (default 10)', default: 10 },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        tracks: { type: 'array' },
        total: { type: 'number' },
      },
    },
  },
  {
    name: 'get_music_track',
    description: 'Get details of a single music track.',
    inputSchema: {
      type: 'object',
      properties: {
        track_id: { type: 'string', description: 'Track ID' },
      },
      required: ['track_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        artist: { type: 'string' },
        genre: { type: 'string' },
        url: { type: 'string' },
      },
    },
  },
  {
    name: 'get_talents',
    description: 'Browse or search talent profiles on Atelnyo.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results (default 10)', default: 10 },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        talents: { type: 'array' },
        total: { type: 'number' },
      },
    },
  },
  {
    name: 'get_talent',
    description: 'Get details of a single talent profile.',
    inputSchema: {
      type: 'object',
      properties: {
        talent_id: { type: 'string', description: 'Talent ID' },
      },
      required: ['talent_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        role: { type: 'string' },
        bio: { type: 'string' },
        skills: { type: 'array' },
      },
    },
  },
  {
    name: 'get_jobs',
    description: 'Browse or search job listings on Atelnyo marketplace.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results (default 10)', default: 10 },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        jobs: { type: 'array' },
        total: { type: 'number' },
      },
    },
  },
  {
    name: 'get_job',
    description: 'Get details of a single job listing.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'Job ID' },
      },
      required: ['job_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        budget: { type: 'number' },
        url: { type: 'string' },
      },
    },
  },
  {
    name: 'get_portfolio_projects',
    description: 'Browse portfolio projects on Atelnyo.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results (default 10)', default: 10 },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        projects: { type: 'array' },
        total: { type: 'number' },
      },
    },
  },
  {
    name: 'get_products',
    description: 'Browse marketplace products on Atelnyo.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results (default 10)', default: 10 },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        products: { type: 'array' },
        total: { type: 'number' },
      },
    },
  },
  {
    name: 'get_product',
    description: 'Get details of a single marketplace product.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product ID' },
      },
      required: ['product_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        price: { type: 'number' },
        url: { type: 'string' },
      },
    },
  },
  {
    name: 'get_events',
    description: 'Get upcoming community events.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (default 10)', default: 10 },
      },
    },
    outputSchema: {
      type: 'object',
      properties: {
        events: { type: 'array' },
        total: { type: 'number' },
      },
    },
  },
  {
    name: 'update_music_track',
    description: 'Update a music track. Requires authentication and ownership.',
    inputSchema: {
      type: 'object',
      properties: {
        track_id: { type: 'string', description: 'Track ID' },
        title: { type: 'string', description: 'New title (optional)' },
        artist: { type: 'string', description: 'New artist (optional)' },
        genre: { type: 'string', description: 'New genre (optional)' },
      },
      required: ['track_id'],
    },
    outputSchema: {
      type: 'object',
      properties: { updated: { type: 'boolean' }, message: { type: 'string' } },
    },
  },
  {
    name: 'delete_music_track',
    description: 'Delete a music track permanently. Requires authentication and ownership.',
    inputSchema: {
      type: 'object',
      properties: {
        track_id: { type: 'string', description: 'Track ID to delete' },
      },
      required: ['track_id'],
    },
    outputSchema: {
      type: 'object',
      properties: { deleted: { type: 'boolean' }, message: { type: 'string' } },
    },
  },
  {
    name: 'update_talent',
    description: 'Update a talent profile. Requires authentication and ownership.',
    inputSchema: {
      type: 'object',
      properties: {
        talent_id: { type: 'string', description: 'Talent ID' },
        name: { type: 'string', description: 'New name (optional)' },
        role: { type: 'string', description: 'New role (optional)' },
        bio: { type: 'string', description: 'New bio (optional)' },
      },
      required: ['talent_id'],
    },
    outputSchema: {
      type: 'object',
      properties: { updated: { type: 'boolean' }, message: { type: 'string' } },
    },
  },
  {
    name: 'delete_talent',
    description: 'Delete a talent profile permanently. Requires authentication and ownership.',
    inputSchema: {
      type: 'object',
      properties: {
        talent_id: { type: 'string', description: 'Talent ID to delete' },
      },
      required: ['talent_id'],
    },
    outputSchema: {
      type: 'object',
      properties: { deleted: { type: 'boolean' }, message: { type: 'string' } },
    },
  },
  {
    name: 'update_job',
    description: 'Update a job listing. Requires authentication and ownership.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'Job ID' },
        title: { type: 'string', description: 'New title (optional)' },
        description: { type: 'string', description: 'New description (optional)' },
        budget_min: { type: 'number', description: 'New min budget (optional)' },
        budget_max: { type: 'number', description: 'New max budget (optional)' },
      },
      required: ['job_id'],
    },
    outputSchema: {
      type: 'object',
      properties: { updated: { type: 'boolean' }, message: { type: 'string' } },
    },
  },
  {
    name: 'delete_job',
    description: 'Delete a job listing permanently. Requires authentication and ownership.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'Job ID to delete' },
      },
      required: ['job_id'],
    },
    outputSchema: {
      type: 'object',
      properties: { deleted: { type: 'boolean' }, message: { type: 'string' } },
    },
  },
  {
    name: 'update_portfolio_project',
    description: 'Update a portfolio project. Requires authentication and ownership.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project ID' },
        title: { type: 'string', description: 'New title (optional)' },
        description: { type: 'string', description: 'New description (optional)' },
      },
      required: ['project_id'],
    },
    outputSchema: {
      type: 'object',
      properties: { updated: { type: 'boolean' }, message: { type: 'string' } },
    },
  },
  {
    name: 'delete_portfolio_project',
    description: 'Delete a portfolio project permanently. Requires authentication and ownership.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project ID to delete' },
      },
      required: ['project_id'],
    },
    outputSchema: {
      type: 'object',
      properties: { deleted: { type: 'boolean' }, message: { type: 'string' } },
    },
  },
  {
    name: 'mark_notification_read',
    description: 'Mark a single notification as read. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        notification_id: { type: 'string', description: 'Notification/event ID' },
      },
      required: ['notification_id'],
    },
    outputSchema: {
      type: 'object',
      properties: { success: { type: 'boolean' }, message: { type: 'string' } },
    },
  },
  {
    name: 'get_my_contracts',
    description: 'List the current user\'s job contracts (as client or freelancer). Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    outputSchema: {
      type: 'object',
      properties: {
        contracts: { type: 'array' },
        total: { type: 'number' },
      },
    },
  },
  {
    name: 'call_api',
    description: 'Generic API call — auto-discovers any Atelnyo endpoint. Use this when no specific tool exists for the action you need. Supports GET, POST, PATCH, DELETE on any /api/ path.',
    inputSchema: {
      type: 'object',
      properties: {
        method: {
          type: 'string',
          description: 'HTTP method',
          enum: ['GET', 'POST', 'PATCH', 'DELETE'],
          default: 'GET',
        },
        path: {
          type: 'string',
          description: 'API path (e.g., "/api/courses/", "/api/progress/", "/api/quizzes/")',
        },
        body: {
          type: 'object',
          description: 'Request body for POST/PATCH (optional)',
        },
        params: {
          type: 'object',
          description: 'URL query parameters (optional)',
        },
      },
      required: ['path'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        data: { type: 'object' },
        status: { type: 'number' },
      },
    },
  },
  {
    name: 'get_progress',
    description: 'Get the user\'s learning progress for all courses. Requires authentication.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: { progress: { type: 'array' }, total: { type: 'number' } } },
  },
  {
    name: 'get_goals',
    description: 'Get the user\'s learning goals. Requires authentication.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: { goals: { type: 'array' } } },
  },
  {
    name: 'create_goal',
    description: 'Create a new learning goal. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Goal title' },
        target_date: { type: 'string', description: 'Target date (ISO format)' },
      },
      required: ['title'],
    },
    outputSchema: { type: 'object', properties: { created: { type: 'boolean' }, goal_id: { type: 'string' }, message: { type: 'string' } } },
  },
  {
    name: 'toggle_favorite',
    description: 'Toggle favorite status on a course. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: { course_id: { type: 'string', description: 'Course ID' } },
      required: ['course_id'],
    },
    outputSchema: { type: 'object', properties: { favorited: { type: 'boolean' }, message: { type: 'string' } } },
  },
  {
    name: 'get_favorites',
    description: 'List the user\'s favorite courses. Requires authentication.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: { favorites: { type: 'array' }, total: { type: 'number' } } },
  },
  {
    name: 'get_quizzes',
    description: 'Get quizzes for a specific course.',
    inputSchema: {
      type: 'object',
      properties: { course_id: { type: 'string', description: 'Course ID' } },
      required: ['course_id'],
    },
    outputSchema: { type: 'object', properties: { quizzes: { type: 'array' }, total: { type: 'number' } } },
  },
  {
    name: 'submit_quiz',
    description: 'Submit answers for a quiz. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        quiz_id: { type: 'string', description: 'Quiz ID' },
        answers: { type: 'object', description: 'Map of question_id → selected answer' },
      },
      required: ['quiz_id', 'answers'],
    },
    outputSchema: { type: 'object', properties: { score: { type: 'number' }, passed: { type: 'boolean' }, message: { type: 'string' } } },
  },
  {
    name: 'submit_speech',
    description: 'Submit a speech recording for review in a language course. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        course_id: { type: 'string', description: 'Course ID' },
        audio_url: { type: 'string', description: 'URL of the recorded audio' },
        prompt: { type: 'string', description: 'The speech prompt/text' },
      },
      required: ['course_id', 'audio_url', 'prompt'],
    },
    outputSchema: { type: 'object', properties: { submitted: { type: 'boolean' }, submission_id: { type: 'string' }, message: { type: 'string' } } },
  },
  {
    name: 'get_course_announcements',
    description: 'Get announcements for a course. Requires enrollment or ownership.',
    inputSchema: {
      type: 'object',
      properties: { course_id: { type: 'string', description: 'Course ID' } },
      required: ['course_id'],
    },
    outputSchema: { type: 'object', properties: { announcements: { type: 'array' }, total: { type: 'number' } } },
  },
  {
    name: 'get_course_notes',
    description: 'Get the user\'s personal notes for a course. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: { course_id: { type: 'string', description: 'Course ID' } },
      required: ['course_id'],
    },
    outputSchema: { type: 'object', properties: { notes: { type: 'array' }, total: { type: 'number' } } },
  },
  {
    name: 'get_gamification_stats',
    description: 'Get the user\'s gamification stats: XP, level, streak, hearts. Requires authentication.',
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: { xp: { type: 'number' }, level: { type: 'number' }, daily_streak: { type: 'number' }, hearts: { type: 'number' } } },
  },
  {
    name: 'ai_translate',
    description: 'Translate text to any language using AI. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to translate' },
        target_lang: { type: 'string', description: 'Target language (e.g., "English", "Kreyòl", "French")' },
      },
      required: ['text', 'target_lang'],
    },
    outputSchema: { type: 'object', properties: { translated_text: { type: 'string' }, source_lang: { type: 'string' } } },
  },
  {
    name: 'get_language_programs',
    description: 'Browse available language programs on Atelnyo.',
    inputSchema: { type: 'object', properties: { limit: { type: 'number', description: 'Max results (default 10)', default: 10 } } },
    outputSchema: { type: 'object', properties: { programs: { type: 'array' }, total: { type: 'number' } } },
  },
  {
    name: 'validate_promo_code',
    description: 'Validate a promo code for a course. Returns discount info if valid.',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Promo code to validate' },
        course_id: { type: 'string', description: 'Course ID to apply the code to' },
      },
      required: ['code', 'course_id'],
    },
    outputSchema: { type: 'object', properties: { valid: { type: 'boolean' }, discount: { type: 'number' }, message: { type: 'string' } } },
  },
  {
    name: 'complete_block',
    description: 'Mark a learning block as completed in a course. Requires authentication and enrollment. This is the core action that advances the learner through the course.',
    inputSchema: {
      type: 'object',
      properties: {
        course_id: { type: 'string', description: 'Course ID' },
        module_index: { type: 'number', description: 'Module index (0-based)', default: 0 },
        block_id: { type: 'string', description: 'Block ID to complete' },
        block_type: { type: 'string', description: 'Block type (e.g., text, quiz, repeat, vocabulary)' },
      },
      required: ['course_id', 'block_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        completed: { type: 'boolean' },
        percentage: { type: 'number' },
        completed_blocks: { type: 'object' },
        completed_modules: { type: 'array' },
        gamification: { type: 'object' },
        message: { type: 'string' },
      },
    },
  },
  {
    name: 'get_course_syllabus',
    description: 'Get the full course syllabus with all modules and their blocks. Useful for understanding course structure and content. Does not require authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        course_id: { type: 'string', description: 'Course ID or slug' },
      },
      required: ['course_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        course_id: { type: 'string' },
        title: { type: 'string' },
        modules: { type: 'array' },
        total_modules: { type: 'number' },
        total_blocks: { type: 'number' },
      },
    },
  },
  {
    name: 'get_learning_recommendations',
    description: 'Get personalized course recommendations based on a specific course. Returns similar courses and next-level courses. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        course_id: { type: 'string', description: 'Course ID to base recommendations on' },
      },
      required: ['course_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        similar: { type: 'array' },
        next_level: { type: 'array' },
        reason: { type: 'string' },
      },
    },
  },
  {
    name: 'open_chatbot',
    description: 'Open or close the Atelnyo AI chatbot panel.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'Action to perform: open or close',
          enum: ['open', 'close'],
        },
      },
      required: ['action'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
      },
    },
  },
  {
    name: 'enroll_course',
    description: 'Enroll the current user in a course. Returns enrollment status.',
    inputSchema: {
      type: 'object',
      properties: {
        course_id: {
          type: 'string',
          description: 'Course ID or slug to enroll in',
        },
      },
      required: ['course_id'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        enrolled: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  },
  {
    name: 'join_community',
    description: 'Join a community on Atelnyo. Handles public and approval-based join modes.',
    inputSchema: {
      type: 'object',
      properties: {
        community_slug: {
          type: 'string',
          description: 'Slug of the community to join',
        },
      },
      required: ['community_slug'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        joined: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  },
  {
    name: 'leave_community',
    description: 'Leave a community the current user has joined.',
    inputSchema: {
      type: 'object',
      properties: {
        community_slug: {
          type: 'string',
          description: 'Slug of the community to leave',
        },
      },
      required: ['community_slug'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        left: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  },
  {
    name: 'follow_creator',
    description: 'Follow or unfollow a creator on Atelnyo (toggle). Returns the new follow status.',
    inputSchema: {
      type: 'object',
      properties: {
        creator_slug: {
          type: 'string',
          description: 'Username/slug of the creator to follow or unfollow',
        },
      },
      required: ['creator_slug'],
    },
    outputSchema: {
      type: 'object',
      properties: {
        following: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  },
];

// ─── Tool Implementations ────────────────────────────────────────

async function searchContent({ query, types = 'courses,music,talents' }) {
  try {
    const resp = await fetch(`${SSR_API}/api/search/?q=${encodeURIComponent(query)}&types=${types}`);
    if (!resp.ok) throw new Error(`Search failed: ${resp.status}`);
    const data = await resp.json();
    return {
      results: (data.results || []).map(r => ({
        title: r.title || r.display_name || 'Untitled',
        type: r.type || 'unknown',
        url: r.url || 'https://atelnyo.site/explore',
        description: r.description || r.subtitle || '',
      })),
      total: data.total || 0,
    };
  } catch (err) {
    return { results: [], total: 0, error: err.message };
  }
}

function navigateTo({ path }) {
  try {
    if (path && typeof window !== 'undefined') {
      window.location.href = path;
      return { success: true, message: `Navigating to ${path}` };
    }
    return { success: false, message: 'Invalid path' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

async function getCourseInfo({ course_id }) {
  try {
    const resp = await fetch(`${SSR_API}/api/courses/${course_id}/`);
    if (!resp.ok) throw new Error(`Course not found: ${resp.status}`);
    const data = await resp.json();
    return {
      id: data.id || course_id,
      title: data.title || 'Untitled',
      description: data.description || '',
      price: data.price || 0,
      creator: data.creator_name || data.creator?.username || 'Unknown',
      url: data.url || `https://atelnyo.site/${data.slug}/by/${data.creator?.username}/course`,
      is_enrolled: data.is_enrolled || false,
    };
  } catch (err) {
    return { error: err.message };
  }
}

function getUserProfile() {
  try {
    // Read from localStorage or app state
    const userData = localStorage.getItem('atelnyo_user');
    if (userData) {
      const user = JSON.parse(userData);
      return {
        id: user.id || '',
        username: user.username || '',
        display_name: user.display_name || user.username || '',
        avatar: user.avatar || '',
        is_premium: user.premium?.is_premium || false,
      };
    }
    return { id: '', username: '', display_name: 'Guest', avatar: '', is_premium: false };
  } catch {
    return { id: '', username: '', display_name: 'Guest', avatar: '', is_premium: false };
  }
}

async function toggleSave({ item_id, item_type }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { saved: false, message: 'Authentication required — please log in first' };
    const endpoint = `/api/explore/saved/items/`;

    // Check if already saved, then toggle
    const checkResp = await fetch(`${SSR_API}${endpoint}?item_type=${item_type}&item_id=${item_id}&limit=1`, {
      headers: _getAuthHeaders(),
    });
    const checkData = checkResp.ok ? await checkResp.json() : {};
    const existing = (checkData?.results || checkData || []).length > 0;

    if (existing) {
      // Unsave
      await fetch(`${SSR_API}${endpoint}0/?item_type=${item_type}&item_id=${item_id}`, {
        method: 'DELETE',
        headers: _getAuthHeaders(),
      });
      return { saved: false, message: `${item_type} unsaved` };
    }

    // Save
    const saveResp = await fetch(`${SSR_API}${endpoint}`, {
      method: 'POST',
      headers: _getAuthHeaders(),
      body: JSON.stringify({ item_type, item_id: Number(item_id) }),
    });

    if (saveResp.ok) {
      return { saved: true, message: `${item_type} saved successfully` };
    }

    // If already saved, try to unsave
    const unsaveResp = await fetch(`${SSR_API}${endpoint}${item_id}/`, {
      method: 'DELETE',
      headers: _getAuthHeaders(),
    });

    if (unsaveResp.ok) {
      return { saved: false, message: `${item_type} unsaved` };
    }

    return { saved: false, message: 'Could not update save status' };
  } catch (err) {
    return { saved: false, message: err.message };
  }
}

async function getProductReviews({ product_id }) {
  try {
    const resp = await fetch(`${SSR_API}/api/marketplace/reviews/?product=${encodeURIComponent(product_id)}`);
    if (!resp.ok) throw new Error(`Reviews fetch failed: ${resp.status}`);
    const data = await resp.json();
    const reviews = (data.results || data || []).map(r => ({
      id: r.id || '',
      rating: r.rating || 0,
      title: r.title || '',
      body: r.body || '',
      buyer: r.buyer_name || r.buyer?.username || 'Anonymous',
      created_at: r.created_at || '',
    }));
    const avgRating = reviews.length > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 100) / 100
      : 0;
    return { reviews, avg_rating: avgRating, review_count: reviews.length };
  } catch (err) {
    return { reviews: [], avg_rating: 0, review_count: 0, error: err.message };
  }
}

async function submitProductReview({ product_id, rating, title = '', body = '' }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { submitted: false, message: 'Authentication required — please log in first' };
    const resp = await fetch(`${SSR_API}/api/marketplace/reviews/`, {
      method: 'POST',
      headers: _getAuthHeaders(),
      body: JSON.stringify({ product: product_id, rating, title, body }),
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      return { submitted: true, message: 'Review submitted successfully', review_id: data.id || '' };
    }
    const data = await resp.json().catch(() => ({}));
    const msg = data.detail || data.error || data.non_field_errors?.[0] || `Review failed (${resp.status})`;
    return { submitted: false, message: msg };
  } catch (err) {
    return { submitted: false, message: err.message };
  }
}

async function getCommunityInfo({ community_slug }) {
  try {
    const resp = await fetch(`${SSR_API}/api/communities/${encodeURIComponent(community_slug)}/`);
    if (!resp.ok) throw new Error(`Community not found: ${resp.status}`);
    const data = await resp.json();
    return {
      id: data.id || community_slug,
      name: data.name || 'Untitled',
      slug: data.slug || community_slug,
      description: data.description || '',
      category: data.category || '',
      member_count: data.member_count ?? data.members_count ?? 0,
      join_mode: data.join_mode || 'public',
      is_member: data.is_member || false,
      url: `https://atelnyo.site/sheet/community/${data.slug || community_slug}`,
    };
  } catch (err) {
    return { error: err.message };
  }
}

async function enrollCourse({ course_id }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { enrolled: false, message: 'Authentication required — please log in first' };
    const resp = await fetch(`${SSR_API}/api/enrollments/`, {
      method: 'POST',
      headers: _getAuthHeaders(),
      body: JSON.stringify({ course: course_id }),
    });
    if (resp.ok) {
      return { enrolled: true, message: 'Successfully enrolled in course' };
    }
    const data = await resp.json().catch(() => ({}));
    const msg = data.detail || data.error || `Enrollment failed (${resp.status})`;
    return { enrolled: false, message: msg };
  } catch (err) {
    return { enrolled: false, message: err.message };
  }
}

async function joinCommunity({ community_slug }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { joined: false, message: 'Authentication required — please log in first' };
    const resp = await fetch(`${SSR_API}/api/communities/${encodeURIComponent(community_slug)}/join/`, {
      method: 'POST',
      headers: _getAuthHeaders(),
    });
    if (resp.ok) {
      return { joined: true, message: `Joined community successfully` };
    }
    const data = await resp.json().catch(() => ({}));
    const msg = data.detail || data.error || `Join failed (${resp.status})`;
    return { joined: false, message: msg };
  } catch (err) {
    return { joined: false, message: err.message };
  }
}

async function leaveCommunity({ community_slug }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { left: false, message: 'Authentication required — please log in first' };
    const resp = await fetch(`${SSR_API}/api/communities/${encodeURIComponent(community_slug)}/leave/`, {
      method: 'POST',
      headers: _getAuthHeaders(),
    });
    if (resp.ok) {
      return { left: true, message: 'Left community successfully' };
    }
    const data = await resp.json().catch(() => ({}));
    const msg = data.detail || data.error || `Leave failed (${resp.status})`;
    return { left: false, message: msg };
  } catch (err) {
    return { left: false, message: err.message };
  }
}

async function followCreator({ creator_slug }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { following: false, message: 'Authentication required — please log in first' };
    const resp = await fetch(`${SSR_API}/api/creator-profiles/${encodeURIComponent(creator_slug)}/follow/`, {
      method: 'POST',
      headers: _getAuthHeaders(),
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      const following = data.following ?? data.status === 'followed' ?? true;
      return { following, message: following ? `Now following ${creator_slug}` : `Unfollowed ${creator_slug}` };
    }
    const data = await resp.json().catch(() => ({}));
    const msg = data.detail || data.error || `Follow failed (${resp.status})`;
    return { following: false, message: msg };
  } catch (err) {
    return { following: false, message: err.message };
  }
}

function openChatbot({ action }) {
  // Dispatch custom event to toggle chatbot
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('webmcp:chatbot', { detail: { action } }));
    return { success: true };
  }
  return { success: false };
}

// ─── Auto-Discovery & Extra Tool Implementations ───────────────

async function callApi({ method = 'GET', path, body, params } = {}) {
  try {
    const token = localStorage.getItem('access_token');
    const headers = token
      ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
    let url = `${SSR_API}${path.startsWith('/') ? path : `/${path}`}`;
    if (params && Object.keys(params).length > 0) {
      const qs = new URLSearchParams(params).toString();
      url += `?${qs}`;
    }
    const opts = { method: method.toUpperCase(), headers };
    if (body && ['POST', 'PATCH', 'PUT'].includes(method.toUpperCase())) {
      opts.body = JSON.stringify(body);
    }
    const resp = await fetch(url, opts);
    if (resp.status === 204) return { data: { success: true }, status: 204 };
    const data = await resp.json().catch(() => ({}));
    return { data, status: resp.status };
  } catch (err) { return { data: { error: err.message }, status: 0 }; }
}

async function getProgress() {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { progress: [], total: 0, error: 'Authentication required' };
    const resp = await fetch(`${SSR_API}/api/progress/`, { headers: _getAuthHeaders() });
    if (!resp.ok) throw new Error(`Progress fetch failed: ${resp.status}`);
    const data = await resp.json();
    const items = (data.results || data || []).map(p => ({
      id: p.id || '', course_id: p.course?.id || p.course || '', course_title: p.course?.title || '', percentage: p.percentage ?? 0, updated_at: p.updated_at || '',
    }));
    return { progress: items, total: data.count ?? items.length };
  } catch (err) { return { progress: [], total: 0, error: err.message }; }
}

async function getGoals() {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { goals: [], error: 'Authentication required' };
    const resp = await fetch(`${SSR_API}/api/learning/goals/`, { headers: _getAuthHeaders() });
    if (!resp.ok) throw new Error(`Goals fetch failed: ${resp.status}`);
    const data = await resp.json();
    const goals = (data.results || data || []).map(g => ({ id: g.id || '', title: g.title || '', target_date: g.target_date || '', completed: g.completed ?? false }));
    return { goals };
  } catch (err) { return { goals: [], error: err.message }; }
}

async function createGoal({ title, target_date }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { created: false, message: 'Authentication required' };
    const payload = { title: title.trim() };
    if (target_date) payload.target_date = target_date;
    const resp = await fetch(`${SSR_API}/api/learning/goals/`, {
      method: 'POST', headers: _getAuthHeaders(), body: JSON.stringify(payload),
    });
    if (resp.ok) { const data = await resp.json().catch(() => ({})); return { created: true, goal_id: data.id || '', message: 'Goal created' }; }
    const data = await resp.json().catch(() => ({}));
    return { created: false, message: data.detail || `Failed (${resp.status})` };
  } catch (err) { return { created: false, message: err.message }; }
}

async function toggleFavorite({ course_id }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { favorited: false, message: 'Authentication required' };
    const addResp = await fetch(`${SSR_API}/api/favorites/`, {
      method: 'POST', headers: _getAuthHeaders(), body: JSON.stringify({ course: course_id }),
    });
    if (addResp.ok) return { favorited: true, message: 'Added to favorites' };
    const removeResp = await fetch(`${SSR_API}/api/favorites/0/?course_id=${course_id}`, {
      method: 'DELETE', headers: _getAuthHeaders(),
    });
    if (removeResp.ok) return { favorited: false, message: 'Removed from favorites' };
    return { favorited: false, message: 'Could not update favorites' };
  } catch (err) { return { favorited: false, message: err.message }; }
}

async function getFavorites() {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { favorites: [], total: 0, error: 'Authentication required' };
    const resp = await fetch(`${SSR_API}/api/favorites/`, { headers: _getAuthHeaders() });
    if (!resp.ok) throw new Error(`Favorites fetch failed: ${resp.status}`);
    const data = await resp.json();
    const items = (data.results || data || []).map(f => ({ id: f.id || '', course_id: f.course?.id || f.course || '', title: f.course?.title || '' }));
    return { favorites: items, total: items.length };
  } catch (err) { return { favorites: [], total: 0, error: err.message }; }
}

async function getQuizzes({ course_id }) {
  try {
    const resp = await fetch(`${SSR_API}/api/quizzes/?course_id=${encodeURIComponent(course_id)}`);
    if (!resp.ok) throw new Error(`Quizzes fetch failed: ${resp.status}`);
    const data = await resp.json();
    const quizzes = (data.results || data || []).map(q => ({ id: q.id || '', title: q.title || '', pass_score: q.pass_score ?? 0, question_count: q.questions?.length ?? 0 }));
    return { quizzes, total: quizzes.length };
  } catch (err) { return { quizzes: [], total: 0, error: err.message }; }
}

async function submitQuiz({ quiz_id, answers }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { score: 0, passed: false, message: 'Authentication required' };
    const resp = await fetch(`${SSR_API}/api/quiz-attempts/`, {
      method: 'POST', headers: _getAuthHeaders(), body: JSON.stringify({ quiz: quiz_id, answers }),
    });
    if (resp.ok) { const data = await resp.json().catch(() => ({})); return { score: data.score ?? 0, passed: data.passed ?? false, message: data.passed ? 'Passed!' : 'Not passed' }; }
    const data = await resp.json().catch(() => ({}));
    return { score: 0, passed: false, message: data.detail || `Failed (${resp.status})` };
  } catch (err) { return { score: 0, passed: false, message: err.message }; }
}

async function submitSpeech({ course_id, audio_url, prompt }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { submitted: false, message: 'Authentication required' };
    const resp = await fetch(`${SSR_API}/api/speech-submissions/`, {
      method: 'POST', headers: _getAuthHeaders(), body: JSON.stringify({ course: course_id, audio_url, prompt }),
    });
    if (resp.ok) { const data = await resp.json().catch(() => ({})); return { submitted: true, submission_id: data.id || '', message: 'Speech submitted for review' }; }
    const data = await resp.json().catch(() => ({}));
    return { submitted: false, message: data.detail || `Failed (${resp.status})` };
  } catch (err) { return { submitted: false, message: err.message }; }
}

async function getCourseAnnouncements({ course_id }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { announcements: [], total: 0, error: 'Authentication required' };
    const resp = await fetch(`${SSR_API}/api/course-announcements/?course_id=${encodeURIComponent(course_id)}`, { headers: _getAuthHeaders() });
    if (!resp.ok) throw new Error(`Announcements fetch failed: ${resp.status}`);
    const data = await resp.json();
    const items = (data.results || data || []).map(a => ({ id: a.id || '', title: a.title || '', body: a.body || '', created_at: a.created_at || '' }));
    return { announcements: items, total: items.length };
  } catch (err) { return { announcements: [], total: 0, error: err.message }; }
}

async function getCourseNotes({ course_id }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { notes: [], total: 0, error: 'Authentication required' };
    const resp = await fetch(`${SSR_API}/api/course-notes/?course_id=${encodeURIComponent(course_id)}`, { headers: _getAuthHeaders() });
    if (!resp.ok) throw new Error(`Notes fetch failed: ${resp.status}`);
    const data = await resp.json();
    const items = (data.results || data || []).map(n => ({ id: n.id || '', module_index: n.module_index ?? 0, block_id: n.block_id || '', body: n.body || '', updated_at: n.updated_at || '' }));
    return { notes: items, total: items.length };
  } catch (err) { return { notes: [], total: 0, error: err.message }; }
}

async function getGamificationStats() {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { xp: 0, level: 1, daily_streak: 0, hearts: 5, error: 'Authentication required' };
    const resp = await fetch(`${SSR_API}/api/learning/stats/`, { headers: _getAuthHeaders() });
    if (!resp.ok) throw new Error(`Stats fetch failed: ${resp.status}`);
    const data = await resp.json();
    return { xp: data.xp ?? 0, level: data.level ?? 1, daily_streak: data.daily_streak ?? 0, hearts: data.hearts ?? 5, daily_xp: data.daily_xp ?? 0 };
  } catch (err) { return { xp: 0, level: 1, daily_streak: 0, hearts: 5, error: err.message }; }
}

async function aiTranslate({ text, target_lang }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { translated_text: '', error: 'Authentication required' };
    const resp = await fetch(`${SSR_API}/api/ai/translate/`, {
      method: 'POST', headers: _getAuthHeaders(), body: JSON.stringify({ text, target_lang }),
    });
    if (!resp.ok) throw new Error(`Translation failed: ${resp.status}`);
    const data = await resp.json();
    return { translated_text: data.translated_text || data.text || '', source_lang: data.source_lang || '' };
  } catch (err) { return { translated_text: '', error: err.message }; }
}

async function getLanguagePrograms({ limit = 10 } = {}) {
  try {
    const resp = await fetch(`${SSR_API}/api/language-programs/?limit=${limit}`);
    if (!resp.ok) throw new Error(`Programs fetch failed: ${resp.status}`);
    const data = await resp.json();
    const programs = (data.results || data || []).map(p => ({ id: p.id || '', key: p.key || '', name: p.name || '', description: p.description || '', source_language: p.source_language || '', target_language: p.target_language || '' }));
    return { programs, total: data.count ?? programs.length };
  } catch (err) { return { programs: [], total: 0, error: err.message }; }
}

async function validatePromoCode({ code, course_id }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { valid: false, message: 'Authentication required' };
    const resp = await fetch(`${SSR_API}/api/marketplace/promo-codes/validate/`, {
      method: 'POST', headers: _getAuthHeaders(), body: JSON.stringify({ code, course_id }),
    });
    if (resp.ok) { const data = await resp.json().catch(() => ({})); return { valid: true, discount: data.discount ?? 0, message: data.detail || 'Promo code valid' }; }
    const data = await resp.json().catch(() => ({}));
    return { valid: false, discount: 0, message: data.detail || 'Invalid promo code' };
  } catch (err) { return { valid: false, discount: 0, message: err.message }; }
}

// ─── Learning Space Tool Implementations ────────────────────────

async function completeBlock({ course_id, module_index = 0, block_id, block_type = '' }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { completed: false, message: 'Authentication required — please log in first' };
    const resp = await fetch(`${SSR_API}/api/progress/complete/`, {
      method: 'POST',
      headers: _getAuthHeaders(),
      body: JSON.stringify({ course_id, module_index, block_id, block_type }),
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      return {
        completed: true,
        percentage: data.percentage ?? 0,
        completed_blocks: data.completed_blocks || {},
        completed_modules: data.completed_modules || [],
        gamification: data.gamification || null,
        message: 'Block completed successfully',
      };
    }
    const data = await resp.json().catch(() => ({}));
    return { completed: false, message: data.detail || `Failed (${resp.status})` };
  } catch (err) { return { completed: false, message: err.message }; }
}

async function getCourseSyllabus({ course_id }) {
  try {
    const resp = await fetch(`${SSR_API}/api/courses/${encodeURIComponent(course_id)}/`);
    if (!resp.ok) throw new Error(`Course not found: ${resp.status}`);
    const data = await resp.json();
    const syllabus = data.syllabus || [];
    const modules = syllabus.map((m, i) => ({
      index: i,
      title: m.title || `Module ${i + 1}`,
      blocks: (m.blocks || []).map((b) => ({
        id: b.id || '',
        type: b.type || 'text',
        title: b.title || b.label || '',
      })),
      block_count: (m.blocks || []).length,
    }));
    return {
      course_id: data.id || course_id,
      title: data.title || '',
      modules,
      total_modules: modules.length,
      total_blocks: modules.reduce((sum, m) => sum + m.block_count, 0),
    };
  } catch (err) { return { course_id, title: '', modules: [], total_modules: 0, total_blocks: 0, error: err.message }; }
}

async function getLearningRecommendations({ course_id }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { similar: [], next_level: [], reason: 'Authentication required', error: 'Authentication required' };
    const resp = await fetch(`${SSR_API}/api/learning/recommendations/?course_id=${encodeURIComponent(course_id)}`, { headers: _getAuthHeaders() });
    if (!resp.ok) throw new Error(`Recommendations fetch failed: ${resp.status}`);
    const data = await resp.json();
    return {
      similar: (data.similar || []).map(c => ({ id: c.id || '', title: c.title || '', difficulty: c.difficulty || '', category: c.category || '' })),
      next_level: (data.next_level || []).map(c => ({ id: c.id || '', title: c.title || '', difficulty: c.difficulty || '', category: c.category || '' })),
      reason: data.reason || '',
    };
  } catch (err) { return { similar: [], next_level: [], reason: '', error: err.message }; }
}

// ─── Browse & CRUD Tool Implementations ────────────────────────

async function getMusicTracks({ query = '', genre = '', limit = 10 } = {}) {
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (query) params.set('q', query);
    if (genre) params.set('genre', genre);
    const resp = await fetch(`${SSR_API}/api/explore/music/?${params.toString()}`);
    if (!resp.ok) throw new Error(`Music fetch failed: ${resp.status}`);
    const data = await resp.json();
    const tracks = (data.results || data || []).map(t => ({
      id: t.id || '', title: t.title || 'Untitled', artist: t.artist || '',
      genre: t.genre || '', cover_url: t.cover_url || '',
    }));
    return { tracks, total: data.count ?? tracks.length };
  } catch (err) { return { tracks: [], total: 0, error: err.message }; }
}

async function getMusicTrack({ track_id }) {
  try {
    const resp = await fetch(`${SSR_API}/api/explore/music/${encodeURIComponent(track_id)}/`);
    if (!resp.ok) throw new Error(`Track not found: ${resp.status}`);
    const data = await resp.json();
    return { id: data.id || track_id, title: data.title || '', artist: data.artist || '', genre: data.genre || '', cover_url: data.cover_url || '', preview_url: data.preview_url || '', duration: data.duration || '' };
  } catch (err) { return { error: err.message }; }
}

async function getTalents({ query = '', limit = 10 } = {}) {
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (query) params.set('q', query);
    const resp = await fetch(`${SSR_API}/api/explore/talents/?${params.toString()}`);
    if (!resp.ok) throw new Error(`Talents fetch failed: ${resp.status}`);
    const data = await resp.json();
    const talents = (data.results || data || []).map(t => ({
      id: t.id || '', name: t.name || 'Untitled', role: t.role || '', bio: t.bio || '', skills: t.skills || [],
    }));
    return { talents, total: data.count ?? talents.length };
  } catch (err) { return { talents: [], total: 0, error: err.message }; }
}

async function getTalent({ talent_id }) {
  try {
    const resp = await fetch(`${SSR_API}/api/explore/talents/${encodeURIComponent(talent_id)}/`);
    if (!resp.ok) throw new Error(`Talent not found: ${resp.status}`);
    const data = await resp.json();
    return { id: data.id || talent_id, name: data.name || '', role: data.role || '', bio: data.bio || '', skills: data.skills || [], location: data.location || '' };
  } catch (err) { return { error: err.message }; }
}

async function getJobs({ query = '', limit = 10 } = {}) {
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (query) params.set('q', query);
    const resp = await fetch(`${SSR_API}/api/jobs/?${params.toString()}`);
    if (!resp.ok) throw new Error(`Jobs fetch failed: ${resp.status}`);
    const data = await resp.json();
    const jobs = (data.results || data || []).map(j => ({
      id: j.id || '', title: j.title || 'Untitled', description: j.description || '', budget_min: j.budget_min ?? 0, budget_max: j.budget_max ?? 0, location: j.location || '',
    }));
    return { jobs, total: data.count ?? jobs.length };
  } catch (err) { return { jobs: [], total: 0, error: err.message }; }
}

async function getJob({ job_id }) {
  try {
    const resp = await fetch(`${SSR_API}/api/jobs/${encodeURIComponent(job_id)}/`);
    if (!resp.ok) throw new Error(`Job not found: ${resp.status}`);
    const data = await resp.json();
    return { id: data.id || job_id, title: data.title || '', description: data.description || '', budget_min: data.budget_min ?? 0, budget_max: data.budget_max ?? 0, skills_required: data.skills_required || [], location: data.location || '', is_remote: data.is_remote ?? false };
  } catch (err) { return { error: err.message }; }
}

async function getPortfolioProjects({ query = '', limit = 10 } = {}) {
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (query) params.set('q', query);
    const resp = await fetch(`${SSR_API}/api/portfolio/projects/?${params.toString()}`);
    if (!resp.ok) throw new Error(`Projects fetch failed: ${resp.status}`);
    const data = await resp.json();
    const projects = (data.results || data || []).map(p => ({
      id: p.id || '', title: p.title || 'Untitled', description: p.description || '', category: p.category || '',
    }));
    return { projects, total: data.count ?? projects.length };
  } catch (err) { return { projects: [], total: 0, error: err.message }; }
}

async function getProducts({ query = '', limit = 10 } = {}) {
  try {
    const params = new URLSearchParams({ limit: String(limit) });
    if (query) params.set('q', query);
    const resp = await fetch(`${SSR_API}/api/marketplace/products/?${params.toString()}`);
    if (!resp.ok) throw new Error(`Products fetch failed: ${resp.status}`);
    const data = await resp.json();
    const products = (data.results || data || []).map(p => ({
      id: p.id || '', title: p.title || 'Untitled', description: p.description || '', price: p.price ?? 0, image_url: p.image_url || '',
    }));
    return { products, total: data.count ?? products.length };
  } catch (err) { return { products: [], total: 0, error: err.message }; }
}

async function getProduct({ product_id }) {
  try {
    const resp = await fetch(`${SSR_API}/api/marketplace/products/${encodeURIComponent(product_id)}/`);
    if (!resp.ok) throw new Error(`Product not found: ${resp.status}`);
    const data = await resp.json();
    return { id: data.id || product_id, title: data.title || '', description: data.description || '', price: data.price ?? 0, image_url: data.image_url || '', stock: data.stock ?? 0 };
  } catch (err) { return { error: err.message }; }
}

async function getEvents({ limit = 10 } = {}) {
  try {
    const resp = await fetch(`${SSR_API}/api/community-events/upcoming/?limit=${limit}`);
    if (!resp.ok) throw new Error(`Events fetch failed: ${resp.status}`);
    const data = await resp.json();
    const events = (data.results || data || []).map(e => ({
      id: e.id || '', title: e.title || 'Untitled', description: e.description || '', date: e.date || e.start_date || '', community: e.community?.name || '',
    }));
    return { events, total: data.count ?? events.length };
  } catch (err) { return { events: [], total: 0, error: err.message }; }
}

async function updateMusicTrack({ track_id, title, artist, genre }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { updated: false, message: 'Authentication required' };
    const payload = {};
    if (title !== undefined) payload.title = title.trim();
    if (artist !== undefined) payload.artist = artist.trim();
    if (genre !== undefined) payload.genre = genre.trim();
    if (Object.keys(payload).length === 0) return { updated: false, message: 'No fields to update' };
    const resp = await fetch(`${SSR_API}/api/explore/music/${encodeURIComponent(track_id)}/`, {
      method: 'PATCH', headers: _getAuthHeaders(), body: JSON.stringify(payload),
    });
    if (resp.ok) return { updated: true, message: 'Track updated successfully' };
    const data = await resp.json().catch(() => ({}));
    return { updated: false, message: data.detail || `Update failed (${resp.status})` };
  } catch (err) { return { updated: false, message: err.message }; }
}

async function deleteMusicTrack({ track_id }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { deleted: false, message: 'Authentication required' };
    const resp = await fetch(`${SSR_API}/api/explore/music/${encodeURIComponent(track_id)}/`, {
      method: 'DELETE', headers: _getAuthHeaders(),
    });
    if (resp.ok || resp.status === 204) return { deleted: true, message: 'Track deleted successfully' };
    const data = await resp.json().catch(() => ({}));
    return { deleted: false, message: data.detail || `Delete failed (${resp.status})` };
  } catch (err) { return { deleted: false, message: err.message }; }
}

async function updateTalent({ talent_id, name, role, bio }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { updated: false, message: 'Authentication required' };
    const payload = {};
    if (name !== undefined) payload.name = name.trim();
    if (role !== undefined) payload.role = role.trim();
    if (bio !== undefined) payload.bio = bio.trim();
    if (Object.keys(payload).length === 0) return { updated: false, message: 'No fields to update' };
    const resp = await fetch(`${SSR_API}/api/explore/talents/${encodeURIComponent(talent_id)}/`, {
      method: 'PATCH', headers: _getAuthHeaders(), body: JSON.stringify(payload),
    });
    if (resp.ok) return { updated: true, message: 'Talent updated successfully' };
    const data = await resp.json().catch(() => ({}));
    return { updated: false, message: data.detail || `Update failed (${resp.status})` };
  } catch (err) { return { updated: false, message: err.message }; }
}

async function deleteTalent({ talent_id }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { deleted: false, message: 'Authentication required' };
    const resp = await fetch(`${SSR_API}/api/explore/talents/${encodeURIComponent(talent_id)}/`, {
      method: 'DELETE', headers: _getAuthHeaders(),
    });
    if (resp.ok || resp.status === 204) return { deleted: true, message: 'Talent deleted successfully' };
    const data = await resp.json().catch(() => ({}));
    return { deleted: false, message: data.detail || `Delete failed (${resp.status})` };
  } catch (err) { return { deleted: false, message: err.message }; }
}

async function updateJob({ job_id, title, description, budget_min, budget_max }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { updated: false, message: 'Authentication required' };
    const payload = {};
    if (title !== undefined) payload.title = title.trim();
    if (description !== undefined) payload.description = description.trim();
    if (budget_min !== undefined) payload.budget_min = Number(budget_min);
    if (budget_max !== undefined) payload.budget_max = Number(budget_max);
    if (Object.keys(payload).length === 0) return { updated: false, message: 'No fields to update' };
    const resp = await fetch(`${SSR_API}/api/jobs/${encodeURIComponent(job_id)}/`, {
      method: 'PATCH', headers: _getAuthHeaders(), body: JSON.stringify(payload),
    });
    if (resp.ok) return { updated: true, message: 'Job updated successfully' };
    const data = await resp.json().catch(() => ({}));
    return { updated: false, message: data.detail || `Update failed (${resp.status})` };
  } catch (err) { return { updated: false, message: err.message }; }
}

async function deleteJob({ job_id }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { deleted: false, message: 'Authentication required' };
    const resp = await fetch(`${SSR_API}/api/jobs/${encodeURIComponent(job_id)}/`, {
      method: 'DELETE', headers: _getAuthHeaders(),
    });
    if (resp.ok || resp.status === 204) return { deleted: true, message: 'Job deleted successfully' };
    const data = await resp.json().catch(() => ({}));
    return { deleted: false, message: data.detail || `Delete failed (${resp.status})` };
  } catch (err) { return { deleted: false, message: err.message }; }
}

async function updatePortfolioProject({ project_id, title, description }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { updated: false, message: 'Authentication required' };
    const payload = {};
    if (title !== undefined) payload.title = title.trim();
    if (description !== undefined) payload.description = description.trim();
    if (Object.keys(payload).length === 0) return { updated: false, message: 'No fields to update' };
    const resp = await fetch(`${SSR_API}/api/portfolio/projects/${encodeURIComponent(project_id)}/`, {
      method: 'PATCH', headers: _getAuthHeaders(), body: JSON.stringify(payload),
    });
    if (resp.ok) return { updated: true, message: 'Project updated successfully' };
    const data = await resp.json().catch(() => ({}));
    return { updated: false, message: data.detail || `Update failed (${resp.status})` };
  } catch (err) { return { updated: false, message: err.message }; }
}

async function deletePortfolioProject({ project_id }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { deleted: false, message: 'Authentication required' };
    const resp = await fetch(`${SSR_API}/api/portfolio/projects/${encodeURIComponent(project_id)}/`, {
      method: 'DELETE', headers: _getAuthHeaders(),
    });
    if (resp.ok || resp.status === 204) return { deleted: true, message: 'Project deleted successfully' };
    const data = await resp.json().catch(() => ({}));
    return { deleted: false, message: data.detail || `Delete failed (${resp.status})` };
  } catch (err) { return { deleted: false, message: err.message }; }
}

async function markNotificationRead({ notification_id }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { success: false, message: 'Authentication required' };
    const resp = await fetch(`${SSR_API}/api/activity/feed/mark_read/`, {
      method: 'POST', headers: _getAuthHeaders(), body: JSON.stringify({ id: notification_id }),
    });
    if (resp.ok) return { success: true, message: 'Notification marked as read' };
    const data = await resp.json().catch(() => ({}));
    return { success: false, message: data.detail || `Failed (${resp.status})` };
  } catch (err) { return { success: false, message: err.message }; }
}

async function getMyContracts() {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { contracts: [], total: 0, error: 'Authentication required' };
    const resp = await fetch(`${SSR_API}/api/job-contracts/`, { headers: _getAuthHeaders() });
    if (!resp.ok) throw new Error(`Contracts fetch failed: ${resp.status}`);
    const data = await resp.json();
    const contracts = (data.results || data || []).map(c => ({
      id: c.id || '', job_title: c.job?.title || c.job_title || '', status: c.status || '', role: c.role || '',
    }));
    return { contracts, total: data.count ?? contracts.length };
  } catch (err) { return { contracts: [], total: 0, error: err.message }; }
}

// ─── Creator Tool Implementations ───────────────────────────────

async function createCourse({ title, description, price = 0, category = '', difficulty = 'beginner', tags = '', image_url }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { created: false, message: 'Authentication required — please log in first' };
    const payload = {
      title: title.trim(),
      description: description.trim(),
      price: Number(price) || 0,
      category: category.trim(),
      difficulty,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    };
    if (image_url) payload.image_url = image_url.trim();
    const resp = await fetch(`${SSR_API}/api/courses/`, {
      method: 'POST',
      headers: _getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      return { created: true, course_id: data.id || '', message: 'Course created successfully' };
    }
    const data = await resp.json().catch(() => ({}));
    const msg = data.detail || data.title?.[0] || data.error || `Course creation failed (${resp.status})`;
    return { created: false, message: msg };
  } catch (err) {
    return { created: false, message: err.message };
  }
}

async function publishCourse({ course_id }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { published: false, message: 'Authentication required — please log in first' };
    const resp = await fetch(`${SSR_API}/api/courses/${encodeURIComponent(course_id)}/publish/`, {
      method: 'POST',
      headers: _getAuthHeaders(),
    });
    if (resp.ok) {
      return { published: true, message: 'Course published successfully' };
    }
    const data = await resp.json().catch(() => ({}));
    const msg = data.detail || data.error || `Publish failed (${resp.status})`;
    return { published: false, message: msg };
  } catch (err) {
    return { published: false, message: err.message };
  }
}

async function createMusicTrack({ title, artist, genre = '', cover_url, preview_url = '', duration = '', tags = '' }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { created: false, message: 'Authentication required — please log in first' };
    const payload = {
      title: title.trim(),
      artist: artist.trim(),
      cover_url: cover_url.trim(),
    };
    if (genre) payload.genre = genre.trim();
    if (preview_url) payload.preview_url = preview_url.trim();
    if (duration) payload.duration = duration.trim();
    if (tags) payload.tags = tags.split(',').map(t => t.trim()).filter(Boolean);
    const resp = await fetch(`${SSR_API}/api/explore/music/`, {
      method: 'POST',
      headers: _getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      return { created: true, track_id: data.id || '', message: 'Music track added successfully' };
    }
    const data = await resp.json().catch(() => ({}));
    const msg = data.detail || data.title?.[0] || data.error || `Music upload failed (${resp.status})`;
    return { created: false, message: msg };
  } catch (err) {
    return { created: false, message: err.message };
  }
}

async function createTalent({ name, role, bio = '', skills = '', location = '', avatar_url = '' }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { created: false, message: 'Authentication required — please log in first' };
    const payload = {
      name: name.trim(),
      role: role.trim(),
      is_active: true,
    };
    if (bio) payload.bio = bio.trim();
    if (skills) payload.skills = skills.split(',').map(s => s.trim()).filter(Boolean);
    if (location) payload.location = location.trim();
    if (avatar_url) payload.avatar_url = avatar_url.trim();
    const resp = await fetch(`${SSR_API}/api/explore/talents/`, {
      method: 'POST',
      headers: _getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      return { created: true, talent_id: data.id || '', message: 'Talent profile created successfully' };
    }
    const data = await resp.json().catch(() => ({}));
    const msg = data.detail || data.name?.[0] || data.role?.[0] || data.error || `Talent creation failed (${resp.status})`;
    return { created: false, message: msg };
  } catch (err) {
    return { created: false, message: err.message };
  }
}

async function createJob({ title, description, budget_type = 'fixed', budget_min = 0, budget_max = 0, skills_required = '', location = '', is_remote = false }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { created: false, message: 'Authentication required — please log in first' };
    const payload = {
      title: title.trim(),
      description: description.trim(),
      budget_type,
      budget_min: Number(budget_min) || 0,
      budget_max: Number(budget_max) || 0,
      currency: 'USD',
      skills_required: skills_required ? skills_required.split(',').map(s => s.trim()).filter(Boolean) : [],
      is_remote: Boolean(is_remote),
      location: location.trim(),
      visibility: 'public',
    };
    const resp = await fetch(`${SSR_API}/api/jobs/`, {
      method: 'POST',
      headers: _getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      return { created: true, job_id: data.id || '', message: 'Job listing created successfully' };
    }
    const data = await resp.json().catch(() => ({}));
    const msg = data.detail || data.title?.[0] || data.error || `Job creation failed (${resp.status})`;
    return { created: false, message: msg };
  } catch (err) {
    return { created: false, message: err.message };
  }
}

async function createPortfolioProject({ title, description = '', category = '', project_url = '', cover_url = '', visibility = 'public' }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { created: false, message: 'Authentication required — please log in first' };
    const payload = { title: title.trim() };
    if (description) payload.description = description.trim();
    if (category) payload.category = category.trim();
    if (project_url) payload.project_url = project_url.trim();
    if (cover_url) payload.cover_url = cover_url.trim();
    payload.visibility = visibility;
    const resp = await fetch(`${SSR_API}/api/portfolio/projects/`, {
      method: 'POST',
      headers: _getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      return { created: true, project_id: data.id || '', message: 'Portfolio project added successfully' };
    }
    const data = await resp.json().catch(() => ({}));
    const msg = data.detail || data.title?.[0] || data.error || `Project creation failed (${resp.status})`;
    return { created: false, message: msg };
  } catch (err) {
    return { created: false, message: err.message };
  }
}

// ─── Extra Tool Implementations ────────────────────────────────

async function getLearningDashboard() {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { continue_learning: [], my_courses: [], completed: [], error: 'Authentication required' };
    const resp = await fetch(`${SSR_API}/api/learning/dashboard/`, { headers: _getAuthHeaders() });
    if (!resp.ok) throw new Error(`Dashboard fetch failed: ${resp.status}`);
    const data = await resp.json();
    const simplify = (items) => (items || []).map(r => ({
      course_id: r.course?.id || '',
      title: r.course?.title || 'Untitled',
      progress: r.progress?.percentage ?? 0,
      enrolled_at: r.enrolled_at || '',
    }));
    return {
      continue_learning: simplify(data.continue_learning),
      my_courses: simplify(data.my_courses),
      completed: simplify(data.completed),
    };
  } catch (err) {
    return { continue_learning: [], my_courses: [], completed: [], error: err.message };
  }
}

async function getWalletBalance() {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { balance: 0, lifetime_earned: 0, lifetime_spent: 0, error: 'Authentication required' };
    const resp = await fetch(`${SSR_API}/api/wallet/me/`, { headers: _getAuthHeaders() });
    if (!resp.ok) throw new Error(`Wallet fetch failed: ${resp.status}`);
    const data = await resp.json();
    return {
      balance: data.balance ?? 0,
      lifetime_earned: data.lifetime_earned ?? 0,
      lifetime_spent: data.lifetime_spent ?? 0,
    };
  } catch (err) {
    return { balance: 0, lifetime_earned: 0, lifetime_spent: 0, error: err.message };
  }
}

async function getWalletTransactions({ limit = 20, type = '' } = {}) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { transactions: [], total: 0, error: 'Authentication required' };
    const params = new URLSearchParams({ limit: String(limit) });
    if (type) params.set('type', type);
    const resp = await fetch(`${SSR_API}/api/wallet/transactions/?${params.toString()}`, { headers: _getAuthHeaders() });
    if (!resp.ok) throw new Error(`Transactions fetch failed: ${resp.status}`);
    const data = await resp.json();
    const items = (data.results || data || []).map(t => ({
      id: t.id || '',
      type: t.type || '',
      amount: t.amount ?? 0,
      description: t.description || '',
      created_at: t.created_at || '',
    }));
    return { transactions: items, total: data.count ?? items.length };
  } catch (err) {
    return { transactions: [], total: 0, error: err.message };
  }
}

async function messageInstructor({ course_id, body }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { sent: false, message: 'Authentication required — please log in first' };
    const resp = await fetch(`${SSR_API}/api/courses/${encodeURIComponent(course_id)}/message_instructor/`, {
      method: 'POST',
      headers: _getAuthHeaders(),
      body: JSON.stringify({ body }),
    });
    if (resp.ok) {
      const data = await resp.json().catch(() => ({}));
      return { sent: true, conversation_id: data.conversation_id || '', message: 'Message sent successfully' };
    }
    const data = await resp.json().catch(() => ({}));
    const msg = data.detail || data.error || `Message failed (${resp.status})`;
    return { sent: false, message: msg };
  } catch (err) {
    return { sent: false, message: err.message };
  }
}

async function getCourseCertificate({ course_id }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { error: 'Authentication required — please log in first' };
    const resp = await fetch(`${SSR_API}/api/courses/${encodeURIComponent(course_id)}/certificate/`, { headers: _getAuthHeaders() });
    if (resp.status === 404) return { error: 'No certificate yet — complete the course to earn it.' };
    if (!resp.ok) throw new Error(`Certificate fetch failed: ${resp.status}`);
    const data = await resp.json();
    return {
      certificate_number: data.certificate_number || '',
      issued_at: data.issued_at || '',
      course_title: data.course_title || '',
    };
  } catch (err) {
    return { error: err.message };
  }
}

async function getCreatorProfile({ creator_slug }) {
  try {
    const resp = await fetch(`${SSR_API}/api/creator-profiles/${encodeURIComponent(creator_slug)}/`);
    if (!resp.ok) throw new Error(`Creator profile not found: ${resp.status}`);
    const data = await resp.json();
    return {
      username: data.username || creator_slug,
      display_name: data.display_name || data.username || '',
      bio: data.bio || '',
      avatar: data.avatar || '',
      followers: data.followers_count ?? data.followers ?? 0,
      following: data.following_count ?? data.following ?? 0,
      courses_count: data.courses_count ?? 0,
      url: `https://atelnyo.site/c/${data.username || creator_slug}`,
    };
  } catch (err) {
    return { error: err.message };
  }
}

async function getCommunityMembers({ community_slug }) {
  try {
    const resp = await fetch(`${SSR_API}/api/communities/${encodeURIComponent(community_slug)}/members/`);
    if (!resp.ok) throw new Error(`Members fetch failed: ${resp.status}`);
    const data = await resp.json();
    const items = (data.results || data || []).map(m => ({
      username: m.username || m.user?.username || '',
      display_name: m.display_name || m.user?.display_name || '',
      avatar: m.avatar || m.user?.avatar || '',
      role: m.role || 'member',
    }));
    return { members: items, total: data.count ?? items.length };
  } catch (err) {
    return { members: [], total: 0, error: err.message };
  }
}

async function updateCourse({ course_id, title, description, price, category, difficulty }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { updated: false, message: 'Authentication required — please log in first' };
    const payload = {};
    if (title !== undefined) payload.title = title.trim();
    if (description !== undefined) payload.description = description.trim();
    if (price !== undefined) payload.price = Number(price);
    if (category !== undefined) payload.category = category.trim();
    if (difficulty !== undefined) payload.difficulty = difficulty;
    if (Object.keys(payload).length === 0) return { updated: false, message: 'No fields to update' };
    const resp = await fetch(`${SSR_API}/api/courses/${encodeURIComponent(course_id)}/`, {
      method: 'PATCH',
      headers: _getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (resp.ok) return { updated: true, message: 'Course updated successfully' };
    const data = await resp.json().catch(() => ({}));
    const msg = data.detail || data.error || `Update failed (${resp.status})`;
    return { updated: false, message: msg };
  } catch (err) {
    return { updated: false, message: err.message };
  }
}

async function deleteCourse({ course_id }) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { deleted: false, message: 'Authentication required — please log in first' };
    const resp = await fetch(`${SSR_API}/api/courses/${encodeURIComponent(course_id)}/`, {
      method: 'DELETE',
      headers: _getAuthHeaders(),
    });
    if (resp.ok || resp.status === 204) return { deleted: true, message: 'Course deleted successfully' };
    const data = await resp.json().catch(() => ({}));
    const msg = data.detail || data.error || `Delete failed (${resp.status})`;
    return { deleted: false, message: msg };
  } catch (err) {
    return { deleted: false, message: err.message };
  }
}

async function getNotifications({ limit = 20 } = {}) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { notifications: [], unread_count: 0, error: 'Authentication required' };
    const [feedResp, countResp] = await Promise.all([
      fetch(`${SSR_API}/api/activity/feed/?limit=${limit}`, { headers: _getAuthHeaders() }),
      fetch(`${SSR_API}/api/activity/feed/unread_count/`, { headers: _getAuthHeaders() }),
    ]);
    const feedData = feedResp.ok ? await feedResp.json().catch(() => ({})) : {};
    const countData = countResp.ok ? await countResp.json().catch(() => ({})) : {};
    const items = (feedData.results || feedData || []).map(n => ({
      id: n.id || '',
      type: n.event_type || n.type || '',
      actor: n.actor?.username || n.actor_username || '',
      message: n.data?.body_preview || n.data?.course_title || '',
      read: n.read ?? false,
      created_at: n.created_at || '',
    }));
    return { notifications: items, unread_count: countData.unread ?? 0 };
  } catch (err) {
    return { notifications: [], unread_count: 0, error: err.message };
  }
}

// ─── New Tool Implementations ───────────────────────────────────

async function getEnrollments() {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { enrollments: [], total: 0, error: 'Authentication required — please log in first' };
    const resp = await fetch(`${SSR_API}/api/enrollments/`, { headers: _getAuthHeaders() });
    if (!resp.ok) throw new Error(`Enrollments fetch failed: ${resp.status}`);
    const data = await resp.json();
    const items = (data.results || data || []).map(e => ({
      id: e.id || '',
      course_id: e.course?.id || e.course || '',
      title: e.course?.title || e.title || 'Untitled',
      creator: e.course?.creator_name || e.course?.creator?.username || '',
      progress: e.progress ?? 0,
      enrolled_at: e.created_at || e.enrolled_at || '',
      url: e.course?.url || '',
    }));
    return { enrollments: items, total: items.length };
  } catch (err) {
    return { enrollments: [], total: 0, error: err.message };
  }
}

async function getCreatorCourses({ creator_slug }) {
  try {
    const resp = await fetch(`${SSR_API}/api/creator-profiles/${encodeURIComponent(creator_slug)}/courses/`);
    if (!resp.ok) throw new Error(`Creator courses fetch failed: ${resp.status}`);
    const data = await resp.json();
    const items = (data.results || data || []).map(c => ({
      id: c.id || '',
      title: c.title || 'Untitled',
      description: c.description || '',
      price: c.price || 0,
      url: c.url || `https://atelnyo.site/${c.slug}/by/${creator_slug}/course`,
    }));
    return { courses: items, total: items.length };
  } catch (err) {
    return { courses: [], total: 0, error: err.message };
  }
}

async function listCommunities({ query = '', category = '', limit = 10 } = {}) {
  try {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (category) params.set('category', category);
    params.set('limit', String(limit));
    const resp = await fetch(`${SSR_API}/api/communities/?${params.toString()}`);
    if (!resp.ok) throw new Error(`Communities fetch failed: ${resp.status}`);
    const data = await resp.json();
    const items = (data.results || data || []).map(c => ({
      id: c.id || '',
      name: c.name || 'Untitled',
      slug: c.slug || '',
      description: c.description || '',
      member_count: c.member_count ?? c.members_count ?? 0,
      category: c.category || '',
      url: `https://atelnyo.site/sheet/community/${c.slug || ''}`,
    }));
    return { communities: items, total: data.count ?? items.length };
  } catch (err) {
    return { communities: [], total: 0, error: err.message };
  }
}

async function getMySaved({ item_type } = {}) {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return { items: [], total: 0, error: 'Authentication required — please log in first' };
    const params = new URLSearchParams();
    if (item_type) params.set('item_type', item_type);
    const resp = await fetch(`${SSR_API}/api/explore/saved/items/?${params.toString()}`, {
      headers: _getAuthHeaders(),
    });
    if (!resp.ok) throw new Error(`Saved items fetch failed: ${resp.status}`);
    const data = await resp.json();
    const items = (data.results || data || []).map(s => ({
      id: s.item_id || s.id || '',
      title: s.title || s.item_title || 'Untitled',
      type: s.item_type || item_type || 'unknown',
      url: s.url || '',
    }));
    return { items, total: items.length };
  } catch (err) {
    return { items: [], total: 0, error: err.message };
  }
}

async function getCourseModules({ course_id }) {
  try {
    const resp = await fetch(`${SSR_API}/api/courses/${course_id}/modules/`);
    if (!resp.ok) throw new Error(`Course modules fetch failed: ${resp.status}`);
    const data = await resp.json();
    const modules = (data.modules || data || []).map((m, i) => ({
      index: m.index ?? i,
      title: m.title || `Module ${i + 1}`,
      lesson_count: m.lesson_count ?? m.blocks?.length ?? m.lessons?.length ?? 0,
    }));
    return {
      course_id: data.course_id || course_id,
      course_title: data.course_title || '',
      modules,
      total_modules: modules.length,
    };
  } catch (err) {
    return { course_id, course_title: '', modules: [], total_modules: 0, error: err.message };
  }
}

async function searchCreators({ query, limit = 10 }) {
  try {
    const resp = await fetch(`${SSR_API}/api/creator-profiles/?q=${encodeURIComponent(query)}&limit=${limit}`);
    if (!resp.ok) throw new Error(`Creator search failed: ${resp.status}`);
    const data = await resp.json();
    const creators = (data.results || data || []).map(c => ({
      username: c.username || '',
      display_name: c.display_name || c.username || '',
      bio: c.bio || '',
      followers: c.followers_count ?? c.followers ?? 0,
      url: `https://atelnyo.site/c/${c.username || ''}`,
    }));
    return { creators, total: data.count ?? creators.length };
  } catch (err) {
    return { creators: [], total: 0, error: err.message };
  }
}

// ─── Tool Executor ───────────────────────────────────────────────
const TOOL_EXECUTORS = {
  search_content: searchContent,
  navigate_to: navigateTo,
  get_course_info: getCourseInfo,
  get_product_reviews: getProductReviews,
  submit_product_review: submitProductReview,
  get_community_info: getCommunityInfo,
  get_user_profile: getUserProfile,
  toggle_save: toggleSave,
  enroll_course: enrollCourse,
  join_community: joinCommunity,
  leave_community: leaveCommunity,
  follow_creator: followCreator,
  open_chatbot: openChatbot,
  get_enrollments: getEnrollments,
  get_creator_courses: getCreatorCourses,
  list_communities: listCommunities,
  get_my_saved: getMySaved,
  get_course_modules: getCourseModules,
  search_creators: searchCreators,
  create_course: createCourse,
  publish_course: publishCourse,
  create_music_track: createMusicTrack,
  create_talent: createTalent,
  create_job: createJob,
  create_portfolio_project: createPortfolioProject,
  get_learning_dashboard: getLearningDashboard,
  get_wallet_balance: getWalletBalance,
  get_wallet_transactions: getWalletTransactions,
  message_instructor: messageInstructor,
  get_course_certificate: getCourseCertificate,
  get_creator_profile: getCreatorProfile,
  get_community_members: getCommunityMembers,
  update_course: updateCourse,
  delete_course: deleteCourse,
  get_notifications: getNotifications,
  get_music_tracks: getMusicTracks,
  get_music_track: getMusicTrack,
  get_talents: getTalents,
  get_talent: getTalent,
  get_jobs: getJobs,
  get_job: getJob,
  get_portfolio_projects: getPortfolioProjects,
  get_products: getProducts,
  get_product: getProduct,
  get_events: getEvents,
  update_music_track: updateMusicTrack,
  delete_music_track: deleteMusicTrack,
  update_talent: updateTalent,
  delete_talent: deleteTalent,
  update_job: updateJob,
  delete_job: deleteJob,
  update_portfolio_project: updatePortfolioProject,
  delete_portfolio_project: deletePortfolioProject,
  mark_notification_read: markNotificationRead,
  get_my_contracts: getMyContracts,
  call_api: callApi,
  get_progress: getProgress,
  get_goals: getGoals,
  create_goal: createGoal,
  toggle_favorite: toggleFavorite,
  get_favorites: getFavorites,
  get_quizzes: getQuizzes,
  submit_quiz: submitQuiz,
  submit_speech: submitSpeech,
  get_course_announcements: getCourseAnnouncements,
  get_course_notes: getCourseNotes,
  get_gamification_stats: getGamificationStats,
  ai_translate: aiTranslate,
  get_language_programs: getLanguagePrograms,
  validate_promo_code: validatePromoCode,
  complete_block: completeBlock,
  get_course_syllabus: getCourseSyllabus,
  get_learning_recommendations: getLearningRecommendations,
};

// ─── Register WebMCP Tools ──────────────────────────────────────
async function registerTools() {
  if (typeof navigator === 'undefined' || !navigator.modelContext) {
    console.log('[WebMCP] navigator.modelContext not available — skipping registration');
    return false;
  }

  try {
    // Register each tool
    for (const tool of TOOLS) {
      const executor = TOOL_EXECUTORS[tool.name];
      if (!executor) {
        console.warn(`[WebMCP] No executor for tool: ${tool.name}`);
        continue;
      }

      await navigator.modelContext.registerTool({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        execute: async (input) => {
          console.log(`[WebMCP] Executing tool: ${tool.name}`, input);
          try {
            const result = await executor(input);
            return { success: true, data: result };
          } catch (err) {
            return { success: false, error: err.message };
          }
        },
      });

      console.log(`[WebMCP] Registered tool: ${tool.name}`);
    }

    console.log(`[WebMCP] Successfully registered ${TOOLS.length} tools`);
    return true;
  } catch (err) {
    console.error('[WebMCP] Failed to register tools:', err);
    return false;
  }
}

// ─── Initialize on page load ────────────────────────────────────
let initialized = false;

export function initWebMCP() {
  if (initialized) return;
  initialized = true;

  // Check if WebMCP is available
  if (typeof navigator !== 'undefined' && navigator.modelContext) {
    console.log('[WebMCP] Available — registering tools...');
    registerTools();
  } else {
    console.log('[WebMCP] Not available in this browser — tools will not be registered');
    // WebMCP is still experimental; gracefully degrade
  }
}

export default {
  TOOLS,
  initWebMCP,
  registerTools,
};
