/**
 * src/components/HelpPage.jsx
 *
 * Help Center — public, crawlable, deeply indexed help hub.
 * Route: /help
 *
 * Sections (each is an anchor target: /help#section-id):
 *   1. Hero with search
 *   2. Sticky "On this page" anchor navigation (scroll-spy)
 *   3. Topic sections with real guides, steps and quick links:
 *      getting-started, courses, music, marketplace, creator,
 *      wallet, affiliate, account, community, troubleshooting
 *   4. FAQ accordion (fetched from platform-faqs API) — #faq
 *   5. Contact / support CTA — #contact
 *   6. Related links (legal, trust, about, status, developers...) — #related
 *
 * SEO: FAQPage + BreadcrumbList JSON-LD, index,follow, hreflang via SEOHead.
 */
import React, { useState, useEffect } from 'react';
import SEOHead, { faqPageSchema } from './shared/SEOHead';
import { useNavigate, useParams } from 'react-router-dom';
import { API_URL } from '../services/api';
import './HelpPage.css';

/* ═══════════════════════════════════════════════════════════════════════════
   MULTILINGUAL CONTENT
   ═══════════════════════════════════════════════════════════════════════════ */

const SEO = {
  en: {
    title: 'Help Center — Atelnyo',
    description: 'Find answers to common questions, learn how to use Atelnyo courses, music, marketplace, and account features. Get support and contact our team.',
  },
  ht: {
    title: 'Sant Èd — Atelnyo',
    description: 'Jwenn repons a kesyon ki komen, aprann kijan pou itilize kou, mizik, mache, ak fonksyon kont Atelnyo. Jwenn sipò epi kontakte ekip nou.',
  },
  fr: {
    title: "Centre d'aide — Atelnyo",
    description: "Trouvez des réponses aux questions fréquentes, apprenez à utiliser les cours, la musique, le marketplace et les fonctionnalités de compte Atelnyo.",
  },
  es: {
    title: 'Centro de Ayuda — Atelnyo',
    description: 'Encuentra respuestas a preguntas frecuentes, aprende a usar los cursos, la música, el marketplace y las funciones de cuenta de Atelnyo.',
  },
};

const PAGE = {
  en: {
    heroTitle: 'How can we help?',
    heroSubtitle: 'Search our help center or browse the topics below',
    searchPlaceholder: 'Search for help...',
    clearSearch: 'Clear search',

    onThisPage: 'On this page',
    topicsIndex: 'All help topics',
    popularSearches: 'Popular searches',
    commonQuestions: 'Common questions',
    backToTop: 'Top',
    noResults: 'Nothing matches your search. Try another word or contact support.',
    faqLoadError: 'Could not load FAQs.',
    faqEmpty: 'No FAQ yet.',
    faqNoMatch: 'No matching questions.',

    sections: [
      {
        id: 'getting-started',
        icon: 'fa-rocket',
        title: 'Getting Started',
        desc: 'Everything you need to create an account and find your way around Atelnyo.',
        paragraphs: [
          'Atelnyo is an international platform where creators teach online courses, share music, and sell products while learners discover new skills. Everything lives under one roof: the Explore catalog, creator profiles, and your personal library.',
          'You can use Atelnyo in English, Haitian Creole, French, or Spanish — pick your language in Settings and the whole app follows.',
        ],
        guides: [
          {
            title: 'Create your account',
            steps: [
              'Open the Sign up page and choose email, Google, or phone to register.',
              'Verify your email address with the link we send you.',
              'Complete your profile: display name, photo, and a short bio.',
              'Pick the languages and markets you want to see content for.',
            ],
          },
          {
            title: 'Learner mode vs creator mode',
            steps: [
              'Every account starts as a learner: enroll in courses, listen to music, and buy products.',
              'When you publish your first course, track, or product, your creator tools unlock automatically.',
              'Switch between the two at any time from your profile menu — your data stays in one place.',
            ],
          },
        ],
        links: [
          { label: 'Sign up', path: '/signup', icon: 'fa-user-plus' },
          { label: 'Explore catalog', path: '/explore', icon: 'fa-compass' },
          { label: 'About Atelnyo', path: '/about', icon: 'fa-circle-info' },
        ],
        questions: [
          { q: 'How do I create an account?', a: "Open the Sign up page and register with email, Google, or phone — then verify your address and complete your profile." },
          { q: 'How do I set up my creator profile?', a: "Complete your profile, publish your first course, track, or product, and your creator tools unlock automatically in the studio." },
          { q: 'How do I switch between learner and creator mode?', a: "Every account starts as a learner. When you publish your first content, creator mode unlocks — switch anytime from your profile menu without losing data." },
          { q: 'What languages does Atelnyo support?', a: "Atelnyo works in English, Haitian Creole, French, and Spanish — pick your language in Settings and the whole app follows." },
        ],
      },
      {
        id: 'courses',
        icon: 'fa-graduation-cap',
        title: 'Courses & Learning',
        desc: 'Browse, enroll, and complete courses — then show off your certificates.',
        paragraphs: [
          'Courses are built by independent creators and organized by category, level, and language. The Explore page is the front door: filter by what you want to learn and open any course for a full description, curriculum, and reviews.',
          'Your progress saves automatically, so you can come back on any device and pick up where you left off.',
        ],
        guides: [
          {
            title: 'Find and enroll in a course',
            steps: [
              'Open Explore and use the filter chips to narrow by category, price, or language.',
              'Open a course to read the curriculum, watch the preview, and check reviews.',
              'Tap Enroll — free courses start instantly, paid courses go through checkout.',
              'Find all your enrolled courses in your library from the profile menu.',
            ],
          },
          {
            title: 'Certificates & progress',
            steps: [
              'Each completed lesson updates your progress bar in real time.',
              'When you reach 100% you can download your certificate as a PDF.',
              'Every certificate has a unique code — anyone can confirm it on the Verify page.',
              'Creators see which students completed their courses in the studio dashboard.',
            ],
          },
        ],
        links: [
          { label: 'Browse courses', path: '/explore', icon: 'fa-compass' },
          { label: 'Verify a certificate', path: '/verify', icon: 'fa-certificate' },
        ],
        questions: [
          { q: 'How do I find and enroll in a course?', a: "Open Explore, filter by category, price, or language, open a course and tap Enroll — free courses start instantly, paid ones go through checkout." },
          { q: 'How do I track my learning progress?', a: "Your progress saves automatically with each completed lesson, and syncs across all your devices." },
          { q: 'How do certificates work?', a: "At 100% completion you can download your certificate as a PDF; every certificate has a unique code verifiable on the Verify page." },
          { q: 'Can I download course content for offline use?', a: "Streaming comes first: your lessons stay available online on any device with your progress saved — no offline mode yet." },
        ],
      },
      {
        id: 'music',
        icon: 'fa-music',
        title: 'Music & Media',
        desc: 'Upload, share, and discover music and media from creators around the world.',
        paragraphs: [
          'Atelnyo doubles as a streaming home for independent artists. Tracks live on creator profiles and in the Explore catalog under the Music filter.',
          'Streaming works in the browser and in the mobile app — no download required, and audio keeps playing while you browse.',
        ],
        guides: [
          {
            title: 'Upload your first track',
            steps: [
              'Sign in and open the studio from your profile menu.',
              'Choose Music → Upload and drop an MP3, WAV, M4A, or FLAC file.',
              'Add a title, genre, cover image, and description, then publish.',
              'Share the track link anywhere — it opens straight to your music.',
            ],
          },
          {
            title: 'Discover new artists',
            steps: [
              'Open Explore and switch the filter to Music.',
              'Follow creators to get their new releases in your feed.',
              'Build playlists from any track menu to organize what you love.',
            ],
          },
        ],
        links: [
          { label: 'Discover music', path: '/explore', icon: 'fa-compass' },
        ],
        questions: [
          { q: 'How do I upload music to Atelnyo?', a: "From the studio choose Music → Upload, drop your file, add title, genre, and cover, then publish — your track page is shareable right away." },
          { q: 'What audio formats are supported?', a: "MP3, WAV, M4A, and FLAC are supported for uploads." },
          { q: 'How do I discover new artists?', a: "Open Explore with the Music filter and follow artists — their new releases land in your feed." },
          { q: 'Can I create playlists?', a: "Yes — build playlists from the menu on any track to organize what you love." },
        ],
      },
      {
        id: 'marketplace',
        icon: 'fa-shopping-bag',
        title: 'Marketplace & Products',
        desc: 'Buy and sell digital products, services, and physical goods.',
        paragraphs: [
          'The marketplace connects creators with buyers: digital downloads, services, and physical goods. Every product page shows the price, what is included, and reviews from real buyers.',
          'Payments are processed securely — Atelnyo never stores your card details.',
        ],
        guides: [
          {
            title: 'Buy with confidence',
            steps: [
              'Open Explore and filter by Products, or follow a product link shared by a creator.',
              'Review the description, the files included, and buyer reviews.',
              'Check out with your preferred payment method — you get an email receipt.',
              'Downloads and services you purchased stay available from your library.',
            ],
          },
          {
            title: 'Sell your first product',
            steps: [
              'From the studio, choose Products → New product.',
              'Upload the files or photos, write a clear description, and set your price.',
              'Publish — your product appears on your profile and in Explore.',
              'Track orders, messages, and earnings from the studio dashboard.',
            ],
          },
        ],
        links: [
          { label: 'Browse products', path: '/explore', icon: 'fa-compass' },
          { label: 'Withdrawals & fees', path: '#wallet', icon: 'fa-wallet' },
        ],
        questions: [
          { q: 'How do I list a product for sale?', a: "From the studio choose Products → New product, upload files or photos, write a clear description, set your price, and publish." },
          { q: 'What payment methods are accepted?', a: "Bank cards and local payment methods depending on your country — Atelnyo never stores your card details." },
          { q: 'How do returns and refunds work?', a: "Contact the creator first; if it stays unresolved, support reviews each case with your order number and refunds where the rules allow it." },
          { q: 'What are the commission fees?', a: "A commission is only taken when you sell — there is no fixed fee to list products." },
        ],
      },
      {
        id: 'creator',
        icon: 'fa-pen-nib',
        title: 'Creator Studio',
        desc: 'Publish courses, music, and products — and grow your audience.',
        paragraphs: [
          'The studio is the creator workspace: publish content, see analytics, answer student questions, and manage your earnings. Your public profile is your storefront.',
          'There is no fee to become a creator — you only share a commission when you make a sale.',
        ],
        guides: [
          {
            title: 'Become a creator',
            steps: [
              'Create your free account and complete your profile.',
              'Open the studio and add your display name, bio, and links.',
              'Publish your first course, track, or product — one is enough to go live.',
              'Share your profile link on social media to bring your audience over.',
            ],
          },
          {
            title: 'Grow with analytics',
            steps: [
              'The dashboard shows views, sales, and student progress at a glance.',
              'Update older content based on questions and reviews.',
              'Use the affiliate program to let others promote your work for a cut.',
            ],
          },
        ],
        links: [
          { label: 'Affiliate program', path: '/affiliate', icon: 'fa-bullhorn' },
          { label: 'Contact creator support', path: '/contact', icon: 'fa-headset' },
        ],
        questions: [
          { q: 'How do I become a creator?', a: "Create a free account, complete your profile, and publish your first course, track, or product — that's all it takes." },
          { q: 'What can I publish on Atelnyo?', a: "Courses, music, products, services, and events — any original content you own the rights to." },
          { q: 'How much commission does Atelnyo take?', a: "A commission is only taken on your sales — check the pricing page for the current rate." },
          { q: 'How do creator payouts work?', a: "Earnings accumulate in your wallet; request a withdrawal once you pass the minimum payout threshold (see Billing & Payouts)." },
        ],
      },
      {
        id: 'profile',
        icon: 'fa-id-card',
        title: 'Public Profile',
        desc: 'Your storefront on Atelnyo: follow, tabs, reviews, and sharing.',
        paragraphs: [
          'Every creator gets a public profile — your storefront on Atelnyo. It gathers your courses, products, portfolio, reviews, and story in one shareable page with its own link.',
          'Learners can follow you to see your new releases in their feed, leave reviews tied to real purchases, and message you — while you control what appears from the studio.',
        ],
        guides: [
          {
            title: 'Find and share a public profile',
            steps: [
              'Every profile lives at its own address: atelnyo.site/c/username — for example /c/maria.',
              'Open any course, product, or track to reach the creator profile with one tap on the name or avatar.',
              'Use the Share button on the profile to copy the link or send it straight to your apps.',
              'Follow a creator to get their new courses, tracks, and products in your feed.',
            ],
          },
          {
            title: 'What each tab shows',
            steps: [
              'Overview — the full picture: stats, featured content, and highlights.',
              'Picks — the content the creator recommends and curates.',
              'Courses, Products, Portfolio — everything the creator published, organized by type.',
              'Reviews — ratings and comments from real buyers; About — the creator story and links.',
            ],
          },
        ],
        links: [
          { label: 'Trust Center', path: '/trust', icon: 'fa-shield-halved' },
          { label: 'Community guidelines', path: '#community', icon: 'fa-people-group' },
        ],
        questions: [
          { q: 'How do I share my profile?', a: "Tap Share on any profile to copy its atelnyo.site/c/username link, or send it straight to your apps." },
          { q: 'How do I follow a creator?', a: "Tap Follow on any profile — their new courses, tracks, and products then appear in your feed." },
          { q: 'How do I customize what appears on my profile?', a: "From the studio: edit your bio, cover, and links, and manage what each tab displays on your public page." },
          { q: 'Who can see my profile?', a: "Public profiles are visible to everyone — that's the storefront. Your personal data (email, phone) stays private." },
        ],
      },
      {
        id: 'explore',
        icon: 'fa-compass',
        title: 'Explore & Discover',
        desc: 'One catalog for the whole platform — filter by what you need.',
        paragraphs: [
          'Explore is the front door of Atelnyo. One search covers the entire platform: courses, music, talents for hire, jobs, events, products, communities, and spotlights — all published by independent creators.',
          'Use the filter chips to narrow by type, category, price, or language, and follow creators to build a feed that matches your interests.',
        ],
        guides: [
          {
            title: 'Find any content type',
            steps: [
              'Open Explore from the main menu or at atelnyo.site/explore.',
              'Switch the type filter: Music, Courses, Talents, Jobs, Events, Products, or Communities.',
              'Open a card to see the full page — every item links back to its creator profile.',
              'Save favorites and follow creators to personalize your feed.',
            ],
          },
        ],
        links: [
          { label: 'Open Explore', path: '/explore', icon: 'fa-compass' },
          { label: 'Find creators', path: '#profile', icon: 'fa-id-card' },
        ],
        questions: [
          { q: 'How do I find courses, music, or products?', a: "Open Explore and type a keyword, or switch the type filter: Music, Courses, Talents, Jobs, Events, or Products." },
          { q: 'How do Explore filters work?', a: "The filter chips combine type, category, price, and language to narrow results as you browse." },
          { q: 'What content types exist on Atelnyo?', a: "Courses, music, talents for hire, jobs, events, products, communities, and spotlights — all published by independent creators." },
          { q: 'How do I personalize my feed?', a: "Follow creators and save favorites — your feed then reflects what you actually like." },
        ],
      },
      {
        id: 'wallet',
        icon: 'fa-wallet',
        title: 'Billing & Payouts',
        desc: 'Pricing, withdrawals, payout schedules, and payment problems — explained.',
        paragraphs: [
          'Earnings from courses, music, and products accumulate in your wallet. You can request a withdrawal once your balance passes the minimum payout threshold.',
          'Payouts are processed on a regular schedule; the exact timing depends on your payment provider and country.',
        ],
        guides: [
          {
            title: 'Withdraw your earnings',
            steps: [
              'Open your wallet from the profile menu to see your available balance.',
              'Add or confirm your payout method.',
              'Request a withdrawal and watch for the confirmation email.',
              'Track the payout status from the wallet history list.',
            ],
          },
          {
            title: 'Payment problems',
            steps: [
              'Declined payments: check with your bank first, then try another card or method.',
              'Missing receipt: search your inbox for emails from Atelnyo, including spam.',
              'Still stuck? Contact support with the order number and we will sort it out.',
            ],
          },
        ],
        links: [
          { label: 'Contact support', path: '/contact', icon: 'fa-headset' },
          { label: 'System status', path: '/status', icon: 'fa-signal' },
        ],
        questions: [
          { q: 'How do I withdraw my earnings?', a: "Open your wallet from the profile menu, check your available balance, add a payout method, and request a withdrawal." },
          { q: 'What are the payout schedules?', a: "Payouts follow a regular schedule; the exact timing depends on your payment provider and country." },
          { q: 'How do I update my payment method?', a: "In the wallet, update or confirm your payout method and save — future withdrawals use it automatically." },
          { q: 'Why was my payment declined?', a: "Check with your bank first, then try another card or method; if it still fails, contact support with the order number." },
        ],
      },
      {
        id: 'affiliate',
        icon: 'fa-bullhorn',
        title: 'Affiliate Program',
        desc: 'Earn commission by promoting creators and their content.',
        paragraphs: [
          'Anyone with an Atelnyo account can join the affiliate program. Share your unique links to courses, music, or products — when someone buys through your link, you earn a commission.',
          'It is a simple way for bloggers, communities, and fans to support creators they love while earning something back.',
        ],
        guides: [
          {
            title: 'Start earning in 3 steps',
            steps: [
              'Open the Affiliate page and opt in — it takes one tap.',
              'Copy your unique link from any course or product page.',
              'Share it on your blog, socials, or newsletter and watch referrals appear in the dashboard.',
            ],
          },
        ],
        links: [
          { label: 'Affiliate program', path: '/affiliate', icon: 'fa-bullhorn' },
          { label: 'Discover offers', path: '/affiliate/discover', icon: 'fa-compass' },
        ],
        questions: [
          { q: 'How do I join the affiliate program?', a: "Open the Affiliate page and opt in — it takes one tap and is free with any account." },
          { q: 'How much commission do I earn?', a: "You earn a percentage of every sale made through your link; the current rate is shown on the Affiliate page." },
          { q: 'When are affiliate payouts sent?', a: "Affiliate payouts follow the same schedule as creator payouts, once your balance passes the minimum." },
          { q: 'Where do I find my affiliate links?', a: "Copy your unique link from any course or product page — everything clicked through it is attributed to you." },
        ],
      },
      {
        id: 'account',
        icon: 'fa-user-gear',
        title: 'Account & Security',
        desc: 'Passwords, privacy, two-factor authentication, and account deletion.',
        paragraphs: [
          'Your account settings control everything about how Atelnyo works for you: email, password, privacy, notifications, and connected sign-in methods.',
          'We take security seriously — enable two-factor authentication for the strongest protection of your content and earnings.',
        ],
        guides: [
          {
            title: 'Update your credentials',
            steps: [
              'Open Settings from the profile menu.',
              'Use Change password or Change email and confirm with your current password.',
              'Check your inbox for the confirmation message to finalize the change.',
            ],
          },
          {
            title: 'Protect your account',
            steps: [
              'Turn on two-factor authentication in Settings → Security.',
              'Review active sessions and sign out devices you do not recognize.',
              'Never share your password or verification codes — Atelnyo staff will never ask for them.',
            ],
          },
        ],
        links: [
          { label: 'Trust Center', path: '/trust', icon: 'fa-shield-halved' },
          { label: 'Legal center', path: '/legal', icon: 'fa-scale-balanced' },
        ],
        questions: [
          { q: 'How do I change my password or email?', a: "Settings → Change password / email, confirm with your current password, then validate through the confirmation email we send." },
          { q: 'How do I manage my privacy settings?', a: "Settings → Privacy: notifications, visibility, and data preferences live in one place." },
          { q: 'How do I delete my account?', a: "Settings → Delete account; deletion is permanent after the confirmation period, and your public content is removed with it." },
          { q: 'How do I enable two-factor authentication?', a: "Settings → Security → enable two-factor authentication; never share your codes — Atelnyo staff will never ask for them." },
        ],
      },
      {
        id: 'tiktok',
        icon: 'fa-share-nodes',
        title: 'TikTok Integration',
        desc: 'Connect your TikTok account and publish your Atelnyo videos straight to TikTok from Creator Studio.',
        paragraphs: [
          'Creators can link one TikTok account to Atelnyo. Once connected, videos from your media engine can be posted directly to TikTok without leaving the studio — the progress, the status, and the final TikTok link all come back into the same Media → TikTok tab.',
          'Until TikTok approves the platform audit, posts are published privately (only you can see them on TikTok). Public posting unlocks automatically once the audit passes.',
        ],
        guides: [
          {
            title: 'Connect your TikTok account',
            steps: [
              'Open Creator Studio → Media → TikTok.',
              'Press "Connect your TikTok account" — a TikTok consent window opens.',
              'Approve the permissions; the window closes and your account appears on the card.',
              'Your TikTok link is added to your public profile automatically; disconnecting removes it.',
            ],
          },
          {
            title: 'Publish a video',
            steps: [
              'In the same TikTok tab, press "New TikTok post".',
              'Pick a video from your media library — captions and hashtags can be auto-generated with the AI button.',
              'Choose who can see the post, then confirm.',
              'TikTok processes the video; the status badge updates until the post is live with its TikTok link.',
            ],
          },
        ],
        links: [
          { label: 'Creator Studio', path: '/sheet/studio?section=media&mediaTab=tiktok', icon: 'fa-palette' },
        ],
        questions: [
          { q: 'Can I connect more than one TikTok account?', a: "One TikTok account per Atelnyo creator for now — disconnect and reconnect to switch accounts." },
          { q: 'Why is my TikTok post private?', a: "Until TikTok finishes the platform audit, all API posts go out privately (only you). Once the audit passes, public posting unlocks." },
          { q: 'Can I delete or edit a TikTok post from Atelnyo?', a: "No — TikTok\'s API does not allow editing or deleting published posts. Manage them in the TikTok app itself." },
        ],
      },
      {
        id: 'community',
        icon: 'fa-people-group',
        title: 'Community & Trust',
        desc: 'Reviews, following, reporting, and keeping Atelnyo safe for everyone.',
        paragraphs: [
          'Atelnyo is built on trust between learners and creators. Reviews, follower feeds, and creator verification help everyone find quality content — and report tools keep bad actors out.',
          'Be kind, be honest, and flag anything that breaks the rules. Our team reviews every report.',
        ],
        guides: [
          {
            title: 'Found your own community',
            steps: [
              'Publish something first — a course, a product, or a track. Founding is reserved for creators with content on the platform.',
              'In Explore, open the Communities chip and press "Found a Community".',
              'Pick a name, a category, and how people join: open to everyone, with approval, or invite-only.',
              'You become the founder — add rules, pin announcements, and moderate members from the community page.',
              'For approval-mode communities, join requests wait in Creator Studio → Communities until you approve or reject them.',
            ],
          },
          {
            title: 'Reviews that help',
            steps: [
              'After completing a course or buying a product, leave an honest rating and a few words.',
              'Mention who the content is best for — it helps other learners decide.',
              'Reviews are tied to real purchases, so they cannot be faked.',
            ],
          },
          {
            title: 'Report a problem',
            steps: [
              'Use the report link on any profile, course, track, or product.',
              'Tell us what is wrong — the more detail, the faster we can act.',
              'Serious issues can also go straight to support by email.',
            ],
          },
        ],
        links: [
          { label: 'Trust Center', path: '/trust', icon: 'fa-shield-halved' },
          { label: 'Accessibility', path: '/accessibility', icon: 'fa-universal-access' },
        ],
        questions: [
          { q: 'Who can found a community?', a: "Creators with at least one published course, product, or music upload — the button appears in Explore once you have content on the platform." },
          { q: 'How do reviews work?', a: "Reviews are tied to real purchases, so they can't be faked — leave honest, specific feedback after completing a course or buying." },
          { q: 'How do I report inappropriate content?', a: "Use the report link on any profile, course, track, or product and describe the problem with as much detail as you can." },
          { q: 'What happens after I report something?', a: "Our team reviews every report and acts per the rules; serious cases go straight to support and can mean suspension or removal." },
          { q: 'How do verified badges work?', a: "Verified badges are granted after a creator's identity is checked — a trust signal that the person is real." },
        ],
      },
      {
        id: 'troubleshooting',
        icon: 'fa-screwdriver-wrench',
        title: 'Troubleshooting',
        desc: 'Quick fixes for loading, playback, and payment hiccups.',
        paragraphs: [
          'Most problems have a quick fix. Work through these steps before contacting support — they solve the majority of issues in under two minutes.',
        ],
        guides: [
          {
            title: 'The app will not load',
            steps: [
              'Check the status page to see whether Atelnyo is having an incident.',
              'Refresh the page with a hard reload (Ctrl/Cmd + Shift + R).',
              'Clear your browser cache or try a private window.',
              'On mobile, update the app to the latest version.',
            ],
          },
          {
            title: 'Audio or video will not play',
            steps: [
              'Check your internet connection and try another network if possible.',
              'Make sure the tab is not muted and the volume is up.',
              'Log out and back in — expired sessions can block playback.',
              'Still broken? Send us the track or course link and what device you use.',
            ],
          },
        ],
        links: [
          { label: 'System status', path: '/status', icon: 'fa-signal' },
          { label: 'Developers', path: '/developers', icon: 'fa-code' },
          { label: 'Contact support', path: '/contact', icon: 'fa-headset' },
        ],
        questions: [
          { q: 'Why is the app slow?', a: "Check the Status page for incidents, hard-reload (Ctrl/Cmd + Shift + R), or try a private window." },
          { q: 'Why will my audio not play?', a: "Check your connection and tab volume, then log out and back in — expired sessions block playback." },
          { q: 'Why did my payment fail?', a: "Check with your bank, try another card or method, then contact support with the order number for a fast fix." },
          { q: 'How do I clear the app cache?', a: "Clear your browser cache or try a private window; on mobile, update the app to the latest version." },
        ],
      },
    ],

    faqTitle: 'Frequently Asked Questions',
    contactNav: 'Contact',
    contactTitle: "Didn't find what you're looking for?",
    contactDesc: 'Our support team is ready to help you with any questions or issues.',
    contactBtn: 'Contact Support',
    contactAlt: 'Or reach us by email at',
    contactEmail: 'support@atelnyo.site',

    relatedTitle: 'Related Pages',
    relatedItems: [
      { label: 'About Atelnyo', path: '/about', icon: 'fa-circle-info' },
      { label: 'Trust Center', path: '/trust', icon: 'fa-shield-halved' },
      { label: 'FAQ', path: '/faq', icon: 'fa-circle-question' },
      { label: 'Legal', path: '/legal', icon: 'fa-scale-balanced' },
      { label: 'Accessibility', path: '/accessibility', icon: 'fa-universal-access' },
      { label: 'System status', path: '/status', icon: 'fa-signal' },
      { label: 'Developers', path: '/developers', icon: 'fa-code' },
      { label: 'Themes', path: '/themes', icon: 'fa-palette' },
      { label: 'Verify certificate', path: '/verify', icon: 'fa-certificate' },
      { label: 'Affiliate program', path: '/affiliate', icon: 'fa-bullhorn' },
    ],
  },
  ht: {
    heroTitle: 'Kijan nou ka ede?',
    heroSubtitle: 'Chèche nan sant èd nou oswa gade sou tèm ki anba a',
    searchPlaceholder: 'Chèche èd...',
    clearSearch: 'Efase rechèch la',

    onThisPage: 'Nan paj sa a',
    topicsIndex: 'Tout tòpik èd yo',
    popularSearches: 'Rechèch ki popilè',
    commonQuestions: 'Kesyon komen',
    backToTop: 'Anwo',
    noResults: 'Anyen pa mache ak rechèch ou. Eseye yon lòt mo oswa kontakte sipò.',
    faqLoadError: 'Pa t kapab chaje FAQ yo.',
    faqEmpty: 'Pa gen FAQ ankò.',
    faqNoMatch: 'Pa gen kesyon ki mache.',

    sections: [
      {
        id: 'getting-started',
        icon: 'fa-rocket',
        title: 'Kòmanse',
        desc: 'Tout sa ou bezwen pou kreye yon kont epi jwenn wozòf ou nan Atelnyo.',
        paragraphs: [
          'Atelnyo se yon platfòm entènasyonal kote kreyatè anseye kou sou entènèt, pataje mizik, epi vann pwodwi, pandan aprèyan ap dekouvri konpetans nouvo. Tout bagay anba yon sèl twati: katalog Explore a, pwofil kreyatè, ak bibliyotè pèsonèl ou.',
          'Ou ka sèvi ak Atelnyo an anglè, kreyòl ayisyen, franse, oswa panyòl — chwazi lang ou nan Paramèt epi tout aplikasyon an swiv.',
        ],
        guides: [
          {
            title: 'Kreye kont ou',
            steps: [
              'Ouvri paj Enskripsyon an epi chwazi imèl, Google, oswa telefòn pou enskri.',
              'Verifye adrès imèl ou avèk lyen an nou voye ba ou.',
              'Ranpli pwofil ou: non ou parèt ak, foto, ak yon ti biyografi.',
              'Chwazi lang ak mache ou vle wè kontni pou.',
            ],
          },
          {
            title: 'Mòd aprèyan kont mòd kreyatè',
            steps: [
              'Chak kont kòmanse kòm aprèyan: enskri nan kou, koute mizik, epi achte pwodwi.',
              'Lè ou pibliye premye kou, trake, oswa pwodwi ou, zouti kreyatè ou debloke otomatikman.',
              'Chanje ant de mòd yo nenpòt lè nan meni pwofil ou — done ou rete nan yon sèl plas.',
            ],
          },
        ],
        links: [
          { label: 'Enskri', path: '/signup', icon: 'fa-user-plus' },
          { label: 'Eksplore katalog la', path: '/explore', icon: 'fa-compass' },
          { label: 'Sou Atelnyo', path: '/about', icon: 'fa-circle-info' },
        ],
        questions: [
          { q: 'Kijan mwen kreye yon kont?', a: "Ouvri paj Enskripsyon an, chwazi imèl, Google, oswa telefòn — apre sa verifye adrès ou epi ranpli pwofil ou." },
          { q: 'Kijan mwen mete pwofil kreyatè mwen?', a: "Ranpli pwofil ou, pibliye premye kou, trake, oswa pwodwi ou, epi zouti kreyatè ou debloke otomatikman nan estidyo a." },
          { q: 'Kijan mwen chanje ant mòd aprantisaj ak kreyatè?', a: "Chak kont kòmanse kòm aprèyan. Lè w pibliye premye kontni ou, mòd kreyatè a debloke — chanje nenpòt lè depi meni pwofil ou san pèdi done." },
          { q: 'Ki lang Atelnyo sipòte?', a: "Atelnyo mache an anglè, kreyòl ayisyen, franse, ak panyòl — chwazi lang ou nan Paramèt epi tout aplikasyon an swiv." },
        ],
      },
      {
        id: 'courses',
        icon: 'fa-graduation-cap',
        title: 'Kou & Aprantisaj',
        desc: 'Gade, enskri, epi konplete kou — apre sa montre sifika ou yo.',
        paragraphs: [
          'Kou yo bati pa kreyatè endepandan epi yo òganize pa kategori, nivo, ak lang. Paj Explore a se pòt devan an: filtre pa sa ou vle aprann epi louvri nenpòt kou pou wè deskripsyon konplè, pwogram, ak avi yo.',
          'Pwogrè ou sove otomatikman, kidonk ou ka tounen sou nenpòt aparèy epi kontinye kote ou te rete a.',
        ],
        guides: [
          {
            title: 'Jwenn epi enskri nan yon kou',
            steps: [
              'Ouvri Explore epi sèvi ak bouton filtè yo pou diminye pa kategori, pri, oswa lang.',
              'Ouvri yon kou pou li pwogram nan, gade apèsi a, epi tcheke avi yo.',
              'Peze Enskri — kou gratis kòmanse touswit, kou k ap peye pase nan kasye a.',
              'Jwenn tout kou ou enskri yo nan bibliyotè ou nan meni pwofil la.',
            ],
          },
          {
            title: 'Sifika & pwogrè',
            steps: [
              'Chak leson ou konplete mete ajou ba pwogrè ou touswit.',
              'Lè ou rive 100% ou ka telechaje sifika ou kòm PDF.',
              'Chak sifika gen yon kòd inik — nenpòt moun ka konfime l sou paj Verifye a.',
              'Kreyatè wè ki elèv ki konplete kou yo nan tablodbò estidyo a.',
            ],
          },
        ],
        links: [
          { label: 'Gade kou', path: '/explore', icon: 'fa-compass' },
          { label: 'Verifye yon sifika', path: '/verify', icon: 'fa-certificate' },
        ],
        questions: [
          { q: 'Kijan mwen jwenn epi enskri nan yon kou?', a: "Ouvri Explore, filtre pa kategori, pri, oswa lang, ouvri yon kou epi peze Enskri — kou gratis yo kòmanse touswit, kou k ap peye yo pase nan kasye a." },
          { q: 'Kijan mwen swiv pwogrè aprantisaj mwen?', a: "Pwogrè ou sove otomatikman ak chak leson ou konplete, epi senkronize sou tout aparèy ou." },
          { q: 'Kijan sifika yo fonksyone?', a: "Lè ou rive 100% ou ka telechaje sifika ou kòm PDF; chak sifika gen yon kòd inik ou ka verifye sou paj Verifye a." },
          { q: 'Èske mwen ka telechaje kontni kou pou itilize san entènèt?', a: "Difizyon an vini premye: leson ou rete disponib sou entènèt sou nenpòt aparèy ak pwogrè ou sove — pa gen mòd san entènèt ankò." },
        ],
      },
      {
        id: 'music',
        icon: 'fa-music',
        title: 'Mizik & Medya',
        desc: 'Chaje, pataje, epi dekouvri mizik ak kontni medya soti nan kreyatè toutotou lemond.',
        paragraphs: [
          'Atelnyo se tou yon lakay difizyon pou atis endepandan. Trake yo viv sou pwofil kreyatè ak nan katalog Explore a anba filtè Mizik la.',
          'Difizyon mache nan navigatè a epi nan aplikasyon mobil la — pa bezwen telechaje, epi odyo a kontinye jwe pandan ou ap navige.',
        ],
        guides: [
          {
            title: 'Chaje premye trake ou',
            steps: [
              'Konekte epi ouvri estidyo a nan meni pwofil ou.',
              'Chwazi Mizik → Chaje epi mete yon fichye MP3, WAV, M4A, oswa FLAC.',
              'Ajoute yon tit, jan, kouvèti, ak deskripsyon, apre sa pibliye.',
              'Pataje lyen trake a nenpòt kote — li louvri dirèkteman sou mizik ou.',
            ],
          },
          {
            title: 'Dekouvri atis nouvo',
            steps: [
              'Ouvri Explore epi chanje filtè a sou Mizik.',
              'Swiv kreyatè pou resevwa nouvo mizik yo nan fil ou.',
              'Bati lis difizyon soti nan meni nenpòt trake pou òganize sa ou renmen.',
            ],
          },
        ],
        links: [
          { label: 'Dekouvri mizik', path: '/explore', icon: 'fa-compass' },
        ],
        questions: [
          { q: 'Kijan mwen chaje mizik sou Atelnyo?', a: "Depi estidyo a chwazi Mizik → Chaje, mete fichye a, ajoute tit, jan, ak kouvèti, apre sa pibliye — paj trake a ka pataje touswit." },
          { q: 'Ki fòma odyo ki sipòte?', a: "MP3, WAV, M4A, ak FLAC sipòte pou chajman." },
          { q: 'Kijan mwen dekouvri atis nouvo?', a: "Ouvri Explore ak filtè Mizik la epi swiv atis — nouvo mizik yo rive nan fil ou." },
          { q: 'Èske mwen ka kreye lis difizyon?', a: "Wi — bati lis difizyon depi meni nenpòt trake pou òganize sa ou renmen." },
        ],
      },
      {
        id: 'marketplace',
        icon: 'fa-shopping-bag',
        title: 'Mache & Pwodwi',
        desc: 'Achte epi vann pwodwi dijital, sèvis, ak byen fizik.',
        paragraphs: [
          'Mache a konekte kreyatè ak achte: telechajman dijital, sèvis, ak byen fizik. Chak paj pwodwi montre pri a, sa ki gen ladan l, ak avi achte reyèl yo.',
          'Peman yo trete an sekirite — Atelnyo pa jamès estoke detay kat ou yo.',
        ],
        guides: [
          {
            title: 'Achte ak konfyans',
            steps: [
              'Ouvri Explore epi filtre sou Pwodwi, oswa swiv yon lyen pwodwi yon kreyatè pataje.',
              'Li deskripsyon an, fichye ki gen ladan yo, ak avi achte yo.',
              'Peze Kasye ak metòd peman ou pito — ou resevwa yon resi pa imèl.',
              'Telechajman ak sèvis ou achte yo rete disponib nan bibliyotè ou.',
            ],
          },
          {
            title: 'Vann premye pwodwi ou',
            steps: [
              'Nan estidyo a, chwazi Pwodwi → Nouvo pwodwi.',
              'Chaje fichye oswa foto yo, ekri yon deskripsyon klè, epi mete pri ou.',
              'Publiye — pwodwi ou parèt sou pwofil ou ak nan Explore.',
              'Swiv kòmand, mesaj, ak lajan ou fè nan tablodbò estidyo a.',
            ],
          },
        ],
        links: [
          { label: 'Gade pwodwi', path: '/explore', icon: 'fa-compass' },
          { label: 'Retrè & frè', path: '#wallet', icon: 'fa-wallet' },
        ],
        questions: [
          { q: 'Kijan mwen mete yon pwodwi pou vann?', a: "Depi estidyo a chwazi Pwodwi → Nouvo pwodwi, mete fichye oswa foto, ekri yon deskripsyon klè, fiks pri ou, epi pibliye." },
          { q: 'Ki metòd peman yo aksepte?', a: "Kat bankè ak metòd peman lokal dapre peyi ou — Atelnyo pa jam estoke done kat ou." },
          { q: 'Kijan retounen ak rembousman yo fonksyone?', a: "Kontakte kreyatè a premye; si sa pa rezoud, sipò a egzamine chak ka ak nimewo kòmand ou epi rembouse kote règleman yo pèmèt." },
          { q: 'Ki frè komisyon yo?', a: "Yon sèl komisyon lè ou vann — pa gen frè fiks pou mete pwodwi." },
        ],
      },
      {
        id: 'creator',
        icon: 'fa-pen-nib',
        title: 'Estidyo Kreyatè',
        desc: 'Publiye kou, mizik, ak pwodwi — epi fè odyans ou grandi.',
        paragraphs: [
          'Estidyo a se espas travay kreyatè a: publiye kontni, gade statistik, reponn kesyon elèv, epi jere lajan ou. Pwofil piblik ou se magazen ou.',
          'Pa gen frè pou vin kreyatè — ou sèlman pataje yon komisyon lè ou fè yon vant.',
        ],
        guides: [
          {
            title: 'Vin kreyatè',
            steps: [
              'Kreye kont gratis ou epi ranpli pwofil ou.',
              'Ouvri estidyo a epi ajoute non ou, biyografi ou, ak lyen ou yo.',
              'Publiye premye kou, trake, oswa pwodwi ou — youn sèlman sufizan pou ale an liy.',
              'Pataje lyen pwofil ou sou rezo sosyal yo pou rale odyans ou vini.',
            ],
          },
          {
            title: 'Grandi ak statistik',
            steps: [
              'Tablodbò a montre wè, vant, ak pwogrè elèv yon sèl kou dèy.',
              'Mete ajou kontni ki fin vye dapre kesyon ak avi.',
              'Sèvi ak pwogram afilyasyon an pou lòt moun ka pwomote travay ou pou yon pòsyon.',
            ],
          },
        ],
        links: [
          { label: 'Pwogram afilyasyon', path: '/affiliate', icon: 'fa-bullhorn' },
          { label: 'Kontakte sipò kreyatè', path: '/contact', icon: 'fa-headset' },
        ],
        questions: [
          { q: 'Kijan mwen vin kreyatè?', a: "Kreye yon kont gratis, ranpli pwofil ou, epi pibliye premye kou, trake, oswa pwodwi ou — se tout sa ou bezwen." },
          { q: 'Ki sa mwen ka publiye sou Atelnyo?', a: "Kou, mizik, pwodwi, sèvis, ak evènman — tout kontni orijinal ki gen dwa ou." },
          { q: 'Konbyen komisyon Atelnyo pran?', a: "Yon sèl komisyon sou vant ou — gade paj pri a pou pousantaj aktyèl la." },
          { q: 'Kijan peman kreyatè yo mache?', a: "Lajan ou akimile nan biy ou; mande yon retrè lè ou depase minèm peman an (gade Biy ak Peman)." },
        ],
      },
      {
        id: 'profile',
        icon: 'fa-id-card',
        title: 'Pwofil Piblik',
        desc: 'Fasad ou sou Atelnyo: swiv, tab, revi, ak pataj.',
        paragraphs: [
          'Chak kreyatè gen yon pwofil piblik — fasad ou sou Atelnyo. Li rasanble kou ou, pwodwi ou, pòtfolyo ou, revi ou, ak istwa ou nan yon sèl paj ou ka pataje ak lyen pa l.',
          'Aprèyan ka swiv ou pou wè nouvo sa ou soti ak yo nan fil yo, kite revi ki mare ak achte reyèl, epi voye mesaj ba ou — pandan ou kontwole sa ki parèt depi estidyo a.',
        ],
        guides: [
          {
            title: 'Jwenn epi pataje yon pwofil piblik',
            steps: [
              'Chak pwofil gen adrès pa l: atelnyo.site/c/non-itilizatè — pa egzanp /c/maria.',
              'Ouvri nenpòt kou, pwodwi, oswa trake pou rive nan pwofil kreyatè a ak yon sèl kout tape sou non an oswa avatar la.',
              'Sèvi ak bouton Pataje a sou pwofil la pou kopye lyen an oswa voye l dirèkteman nan aplikasyon ou.',
              'Swiv yon kreyatè pou resevwa nouvo kou, trake, ak pwodwi pa l nan fil ou.',
            ],
          },
          {
            title: 'Sa chak tab montre',
            steps: [
              'Apèsi — tout imaj la: estatistik, kontni ki fin chwazi, ak pwen enpòtan.',
              'Picks — kontni kreyatè a rekòmande epi seleksyone.',
              'Kou, Pwodwi, Pòtfolyo — tout sa kreyatè a pibliye, òganize pa tip.',
              'Revi — nòt ak kòmantè soti nan achte reyèl; Sou nou — istwa kreyatè a ak lyen yo.',
            ],
          },
        ],
        links: [
          { label: 'Sant Konfyans', path: '/trust', icon: 'fa-shield-halved' },
          { label: 'Règ kominotè a', path: '#community', icon: 'fa-people-group' },
        ],
        questions: [
          { q: 'Kijan mwen pataje pwofil mwen?', a: "Peze Pataje sou nenpòt pwofil pou kopye lyen atelnyo.site/c/non-itilizatè a, oswa voye l dirèkteman nan aplikasyon ou." },
          { q: 'Kijan mwen swiv yon kreyatè?', a: "Peze Swiv sou nenpòt pwofil — nouvo kou, trake, ak pwodwi pa l ap rive nan fil ou." },
          { q: 'Kijan mwen personnalisé sa ki parèt sou pwofil mwen?', a: "Depi estidyo a: chanje biy ou, kouvèti ou, ak lyen ou, epi jere sa chak tab montre sou paj piblik ou." },
          { q: 'Kisa ki ka wè pwofil mwen?', a: "Pwofil piblik yo vizib pou tout moun — se fasad la. Done pèsonèl ou (imèl, telefòn) rete prive." },
        ],
      },
      {
        id: 'explore',
        icon: 'fa-compass',
        title: 'Eksplore & Dekouvèt',
        desc: 'Yon sèl katalog pou tout platfòm nan — filtre pa sa ou bezwen.',
        paragraphs: [
          'Explore se pòt devan Atelnyo. Yon sèl rechèch kouvri tout platfòm nan: kou, mizik, talan pou angajman, travay, evènman, pwodwi, kominote, ak spotlight — tout pibliye pa kreyatè endepandan.',
          'Sèvi ak bouton filtè yo pou diminye pa tip, kategori, pri, oswa lang, epi swiv kreyatè pou bati yon fil ki sanble ak enterè ou.',
        ],
        guides: [
          {
            title: 'Jwenn nenpòt tip kontni',
            steps: [
              'Ouvri Explore depi meni prensipal la oswa nan atelnyo.site/explore.',
              'Chanje filtè tip la: Mizik, Kou, Talan, Travay, Evènman, Pwodwi, oswa Kominote.',
              'Ouvri yon kat pou wè paj konplè a — chak atik mene tounen nan pwofil kreyatè a.',
              'Sove favori epi swiv kreyatè pou personnalisé fil ou.',
            ],
          },
        ],
        links: [
          { label: 'Ouvri Explore', path: '/explore', icon: 'fa-compass' },
          { label: 'Jwenn kreyatè', path: '#profile', icon: 'fa-id-card' },
        ],
        questions: [
          { q: 'Kijan mwen jwenn kou, mizik, oswa pwodwi?', a: "Ouvri Explore epi tape yon mo kle, oswa chanje filtè tip la: Mizik, Kou, Talan, Travay, Evènman, oswa Pwodwi." },
          { q: 'Kijan filtè Explore yo mache?', a: "Bouton filtè yo konbine tip, kategori, pri, ak lang pou diminye rezilta yo pandan w ap navige." },
          { q: 'Ki tip kontni ki genyen sou Atelnyo?', a: "Kou, mizik, talan pou angajman, travay, evènman, pwodwi, kominote, ak spotlight — tout pibliye pa kreyatè endepandan." },
          { q: 'Kijan mwen personnalisé fil mwen?', a: "Swiv kreyatè epi sove favori — fil ou ap reflete sa ou renmen vre." },
        ],
      },
      {
        id: 'wallet',
        icon: 'fa-wallet',
        title: 'Biy ak Peman',
        desc: 'Pri, retrè, orè peman, ak pwoblèm peman — tout eksplike.',
        paragraphs: [
          'Lajan soti nan kou, mizik, ak pwodwi akimile nan biy ou. Ou ka mande yon retrè yon fwa balans ou depase minèm retreti a.',
          'Retrè yo trete sou yon orè regilye; tan egzak la depann de founisè peman ou ak peyi ou.',
        ],
        guides: [
          {
            title: 'Retire lajan ou genyen',
            steps: [
              'Ouvri biy ou nan meni pwofil la pou wè balans disponib ou.',
              'Ajoute oswa konfime metòd retreti ou.',
              'Mande yon retrè epi tann imèl konfimasyon an.',
              'Swivi estati retreti a nan lis istwa biy la.',
            ],
          },
          {
            title: 'Pwoblèm peman',
            steps: [
              'Peman refize: tcheke ak bank ou an premye, apre sa eseye yon lòt kat oswa metòd.',
              'Resi ki manke: chache nan bwat imèl ou pou imèl soti nan Atelnyo, gen ladan spam.',
              'Ankò bloke? Kontakte sipò ak nimewo kòmandman an epi n ap klere sa.',
            ],
          },
        ],
        links: [
          { label: 'Kontakte sipò', path: '/contact', icon: 'fa-headset' },
          { label: 'Estati sistèm', path: '/status', icon: 'fa-signal' },
        ],
        questions: [
          { q: 'Kijan mwen retire lajan mwen genyen?', a: "Ouvri biy ou depi meni pwofil la, tcheke balans disponib ou, ajoute yon metòd peman, epi mande yon retrè." },
          { q: 'Ki orè peman yo?', a: "Peman yo swiv yon kalandrye regilye; delè egzak la depann de pwovizè peman ou ak peyi ou." },
          { q: 'Kijan mwen mete ajou metòd peman mwen?', a: "Nan biy ou a, mete ajou oswa konfime metòd peman ou epi sove — retrè ki vin apre yo sèvi ak li otomatikman." },
          { q: 'Poukisa peman mwen te refize?', a: "Tcheke ak bank ou premye, apre sa eseye yon lòt kat oswa metòd; si l toujou echwe, kontakte sipò ak nimewo kòmand lan." },
        ],
      },
      {
        id: 'affiliate',
        icon: 'fa-bullhorn',
        title: 'Pwogram Afilyasyon',
        desc: 'Fè kòmisyon nan pwomote kreyatè ak kontni yo.',
        paragraphs: [
          'Nenpòt moun ki gen yon kont Atelnyo ka rantre nan pwogram afilyasyon an. Pataje lyen inik ou pou kou, mizik, oswa pwodwi — lè yon moun achte atravè lyen ou, ou fè yon kòmisyon.',
          'Se yon fason senp pou blòg, kominote, ak fan pwomote kreyatè yo renmen pandan y ap fè yon bagay tounen.',
        ],
        guides: [
          {
            title: 'Kòmanse fè lajan nan 3 etap',
            steps: [
              'Ouvri paj Afilyasyon an epi opte — yon sèl kout pye.',
              'Kopye lyen inik ou soti nan nenpòt paj kou oswa pwodwi.',
              'Pataje l sou blòg ou, rezo sosyal ou, oswa bilten ou epi gade referal yo parèt nan tablodbò a.',
            ],
          },
        ],
        links: [
          { label: 'Pwogram afilyasyon', path: '/affiliate', icon: 'fa-bullhorn' },
          { label: 'Dekouvri òf', path: '/affiliate/discover', icon: 'fa-compass' },
        ],
        questions: [
          { q: 'Kijan mwen rantre nan pwogram afilyasyon an?', a: "Ouvri paj Afilye a epi aktive pwogram nan — yon sèl kout tape, gratis ak nenpòt kont." },
          { q: 'Konbyen kòmisyon mwen fè?', a: "Ou fè yon pousantaj sou chak vant ki fèt ak lyen ou; pousantaj aktyèl la afiche sou paj Afilye a." },
          { q: 'Ki lè peman afilyasyon yo voye?', a: "Peman afilyasyon yo swiv menm kalandrye ak peman kreyatè yo, lè balans ou depase minèm nan." },
          { q: 'Kote mwen jwenn lyen afilyasyon mwen?', a: "Kopye lyen inik ou depi nenpòt paj kou oswa pwodwi — tout klike ki soti nan li atribiye ba ou." },
        ],
      },
      {
        id: 'account',
        icon: 'fa-user-gear',
        title: 'Kont & Sekirite',
        desc: 'Modpas, konfidansyalite, otantifikasyon de-faktè, ak efase kont.',
        paragraphs: [
          'Paramèt kont ou kontwole tout kijan Atelnyo mache pou ou: imèl, modpas, konfidansyalite, notifikasyon, ak metòd koneksyon ki konekte yo.',
          'Nou pran sekirite oerye — aktive otantifikasyon de-faktè pou pi fò pwoteksyon kontni ou ak lajan ou.',
        ],
        guides: [
          {
            title: 'Mete ajou idantifyan ou',
            steps: [
              'Ouvri Paramèt nan meni pwofil la.',
              'Sèvi ak Chanje modpas oswa Chanje imèl epi konfime ak modpas aktyèl ou.',
              'Tcheke bwat imèl ou pou mesaj konfimasyon an pou finalize chanjman an.',
            ],
          },
          {
            title: 'Pwoteje kont ou',
            steps: [
              'Aktive otantifikasyon de-faktè nan Paramèt → Sekirite.',
              'Revi sesyon aktif yo epi dekonekte aparèy ou pa rekonèt.',
              'Jamès pataje modpas ou oswa kòd verifikasyon — anplwaye Atelnyo pap jamès mande pou yo.',
            ],
          },
        ],
        links: [
          { label: 'San Konfyans', path: '/trust', icon: 'fa-shield-halved' },
          { label: 'Sant legal', path: '/legal', icon: 'fa-scale-balanced' },
        ],
        questions: [
          { q: 'Kijan mwen chanje modpas oswa imèl mwen?', a: "Paramèt → Chanje modpas / imèl, konfime ak modpas aktyèl ou, apre sa valide ak imèl konfimasyon an nou voye." },
          { q: 'Kijan mwen jere paramèt konfidansyalite mwen?', a: "Paramèt → Konfidansyalite: notifikasyon, vizibilite, ak preferans done nan yon sèl plas." },
          { q: 'Kijan mwen efase kont mwen?', a: "Paramèt → Efase kont; efase a definitif apre peryòd konfimasyon an, epi kontni piblik ou retire avè l." },
          { q: 'Kijan mwen aktive otantifikasyon de-faktè?', a: "Paramèt → Sekirite → aktive otantifikasyon de-faktè; pa jam pataje kòd ou — ekip Atelnyo pa jam ap mande pou yo." },
        ],
      },
      {
        id: 'tiktok',
        icon: 'fa-share-nodes',
        title: 'Entegrasyon TikTok',
        desc: 'Konekte kont TikTok ou epi pibliye videyo Atelnyo ou yo dirèkteman sou TikTok depi Creator Studio a.',
        paragraphs: [
          'Kreyatè yo ka lyen yon sèl kont TikTok ak Atelnyo. Yon fwa konekte, videyo ki nan medya ou yo ka ale dirèkteman sou TikTok san ou pa kite studio a — pwogresyon, estati a, ak lyen TikTok final la tounen nan menm tab Medya → TikTok la.',
          'Jiskaske TikTok apwouve audit platfòm nan, pòs yo sòti prive (se oumenm ki ka wè yo sou TikTok). Piblikasyon piblik la vin disponib otomatikman lè audit la pase.',
        ],
        guides: [
          {
            title: 'Konekte kont TikTok ou',
            steps: [
              'Ouvri Creator Studio → Medya → TikTok.',
              'Peze "Konekte kont TikTok ou" — yon fenèt konsantman TikTok ap louvri.',
              'Apwouve pèmisyon yo; fenèt la ap fèmen epi kont ou a ap parèt sou kat la.',
              'Lyen TikTok ou a vin ajoute sou profil piblik ou otomatikman; dekoneksyon an retire l.',
            ],
          },
          {
            title: 'Pibliye yon videyo',
            steps: [
              'Nan menm tab TikTok la, peze "Nouvo pòs TikTok".',
              'Chwazi yon videyo nan librairi medya ou — kaptyen ak hashtag ka jenere ak bouton AI a.',
              'Chwazi kiyès ka wè pòs la, apre sa konfime.',
              'TikTok ap trete videyo a; badje estati a ap mete ajou jiskaske pòs la vin an liy ak lyen TikTok li.',
            ],
          },
        ],
        links: [
          { label: 'Creator Studio', path: '/sheet/studio?section=media&mediaTab=tiktok', icon: 'fa-palette' },
        ],
        questions: [
          { q: 'Èske m ka konekte plizyè kont TikTok?', a: "Yon sèl kont TikTok pa kreyatè Atelnyo kounye a — dekonekte epi rekonekte pou chanje kont." },
          { q: 'Poukisa pòs TikTok mwen an prive?', a: "Jiskaske TikTok fini audit platfòm nan, tout pòs API sòti prive (se oumenm). Lè audit la pase, piblikasyon piblik la ap louvri." },
          { q: 'Èske m ka efase oswa modifye yon pòs TikTok depi Atelnyo?', a: "Non — API TikTok la pa pèmèt modifye oswa efase pòs ki deja pibliye. Jere yo nan app TikTok la menm." },
        ],
      },
      {
        id: 'community',
        icon: 'fa-people-group',
        title: 'Kominote & Konfyans',
        desc: 'Avi, swiv, rapòte, ak kenbe Atelnyo an sekirite pou tout moun.',
        paragraphs: [
          'Atelnyo bati sou konfyans ant aprèyan ak kreyatè. Avi, fil swiv, ak verifikasyon kreyatè ede tout moun jwenn kontni bon kalite — epi zouti rapò kenbe mòvèt deyò.',
          'Soy janti, soy onèt, epi siyen tout sa ki pa respekte règ yo. Ekip nou an revize chak rapò.',
        ],
        guides: [
          {
            title: 'Fonde pwòp kominote ou',
            steps: [
              'Pibliye yon bagay anvan — yon kou, yon pwodwi, oswa yon trake. Fondasyon an rezève pou kreyatè ki gen kontni sou platfòm nan.',
              'Nan Explore, louvri chip Kominote a epi peze "Fonde yon Kominote".',
              'Chwazi yon non, yon kategori, ak kijan moun antre: louvri pou tout moun, ak apwobasyon, oswa sèlman ak envitasyon.',
              'Ou vin fondatè a — ajoute règleman, fikse anons, epi modere manm yo depi paj kominote a.',
              'Pou kominote ki mande apwobasyon, demann antre yo tann nan Creator Studio → Kominote jiskaske ou apwouve oswa rejte yo.',
            ],
          },
          {
            title: 'Avi ki ede',
            steps: [
              'Apre ou konplete yon kou oswa achte yon pwodwi, kite yon nòt onèt ak kèk mo.',
              'Di pou ki moun kontni an pi bon — sa ede lòt aprèyan deside.',
              'Avi yo tache ak achte reyèl, kidonk yo pa ka fo.',
            ],
          },
          {
            title: 'Rapòte yon pwoblèm',
            steps: [
              'Sèvi ak lyen rapò a sou nenpòt pwofil, kou, trake, oswa pwodwi.',
              'Di nou sa ki pa bon — plis detay, pi vit nou ka aji.',
              'Pwoblèm grav ka ale dirèkteman nan sipò pa imèl tou.',
            ],
          },
        ],
        links: [
          { label: 'San Konfyans', path: '/trust', icon: 'fa-shield-halved' },
          { label: 'Aksesibilite', path: '/accessibility', icon: 'fa-universal-access' },
        ],
        questions: [
          { q: 'Kiyès ki ka fonde yon kominote?', a: "Kreyatè ki gen omwen yon kou, yon pwodwi, oswa yon mizik pibliye — bouton nan parèt nan Explore lesgèt ou gen kontni sou platfòm nan." },
          { q: 'Kijan avi yo mache?', a: "Revi yo mare ak achte reyèl, kidonk yo pa ka fo — kite yon fidbak onèt epi presi apre ou konplete yon kou oswa achte." },
          { q: 'Kijan mwen rapòte kontni ki pa apwopriye?', a: "Sèvi ak lyen Rapòte a sou nenpòt pwofil, kou, trake, oswa pwodwi epi dekri pwoblèm nan ak plis detay ou ka." },
          { q: 'Ki sa ki rive apre mwen rapòte yon bagay?', a: "Ekip nou an revize chak rapò epi aji dapre règleman yo; ka grav yo ale dirèkteman nan sipò epi ka mennen sispansyon oswa retire." },
          { q: 'Kijan badge verifye yo mache?', a: "Badge verifye yo bay apre idantite kreyatè a verifye — yon siy konfyans ke moun nan reyèl." },
        ],
      },
      {
        id: 'troubleshooting',
        icon: 'fa-screwdriver-wrench',
        title: 'Depanaj',
        desc: 'Repons rapid pou pwoblèm chajman, lekti, ak peman.',
        paragraphs: [
          'Pi fò pwoblèm gen yon solisyon rapid. Fè etap sa yo anvan kontakte sipò — yo rezone pi fò pwoblèm nan mwens pase de minit.',
        ],
        guides: [
          {
            title: 'Aplikasyon an pa chaje',
            steps: [
              'Tcheke paj estati a pou wè si Atelnyo gen yon ensidan.',
              'Rafrechi paj la ak yon rechajman di (Ctrl/Cmd + Shift + R).',
              'Efase kach navigatè ou oswa eseye yon fenèt prive.',
              'Sou mobil, mete aplikasyon an ajou dènye vèsyon.',
            ],
          },
          {
            title: 'Odyo oswa videyo pa jwe',
            steps: [
              'Tcheke koneksyon entènèt ou epi eseye yon lòt rezo si posib.',
              'Asire w ong la pa mute epi volim wo.',
              'Dekonekte epi rekonekte — sesyon ekspire ka bloke lekti.',
              'Ankò kase? Voye nou lyen trake oswa kou a ak aparèy ou sèvi a.',
            ],
          },
        ],
        links: [
          { label: 'Estati sistèm', path: '/status', icon: 'fa-signal' },
          { label: 'Devlopè', path: '/developers', icon: 'fa-code' },
          { label: 'Kontakte sipò', path: '/contact', icon: 'fa-headset' },
        ],
        questions: [
          { q: 'Poukisa aplikasyon an lè?', a: "Tcheke paj Estati a pou ensidan, fè yon rechaje fòse (Ctrl/Cmd + Shift + R), oswa eseye yon fenèt prive." },
          { q: 'Poukisa odyo mwen pa jwe?', a: "Tcheke koneksyon ou ak volim tab la, apre sa dekonekte epi rekonekte — yon sesyon ekspire bloke difizyon an." },
          { q: 'Poukisa peman mwen echwe?', a: "Tcheke ak bank ou premye, eseye yon lòt kat oswa metòd, apre sa kontakte sipò ak nimewo kòmand lan pou yon solisyon rapid." },
          { q: 'Kijan mwen efase kach aplikasyon an?', a: "Efase kach navigatè a oswa eseye yon fenèt prive; sou mobil, mete aplikasyon an ajou a dènye vèsyon." },
        ],
      },
    ],

    faqTitle: 'Kesyon yo Poze Souvan',
    contactNav: 'Kontak',
    contactTitle: 'Ou pa jwenn sa ou chèche?',
    contactDesc: 'Ekip sipò nou an pare pou ede ou ak nenpòt kesyon oswa pwoblèm.',
    contactBtn: 'Kontakte Sipò',
    contactAlt: 'Oswa kontakte nou pa imèl nan',
    contactEmail: 'support@atelnyo.site',

    relatedTitle: 'Paj Ki Gen Rapò',
    relatedItems: [
      { label: 'Sou Atelnyo', path: '/about', icon: 'fa-circle-info' },
      { label: 'San Konfyans', path: '/trust', icon: 'fa-shield-halved' },
      { label: 'FAQ', path: '/faq', icon: 'fa-circle-question' },
      { label: 'Legal', path: '/legal', icon: 'fa-scale-balanced' },
      { label: 'Aksesibilite', path: '/accessibility', icon: 'fa-universal-access' },
      { label: 'Estati Sistèm', path: '/status', icon: 'fa-signal' },
      { label: 'Devlopè', path: '/developers', icon: 'fa-code' },
      { label: 'Tèm', path: '/themes', icon: 'fa-palette' },
      { label: 'Verifye Sifika', path: '/verify', icon: 'fa-certificate' },
      { label: 'Pwogram Afilyasyon', path: '/affiliate', icon: 'fa-bullhorn' },
    ],
  },
  fr: {
    heroTitle: 'Comment pouvons-nous aider?',
    heroSubtitle: "Recherchez dans notre centre d'aide ou parcourez les sujets ci-dessous",
    searchPlaceholder: "Rechercher de l'aide...",
    clearSearch: 'Effacer la recherche',

    onThisPage: 'Sur cette page',
    topicsIndex: 'Tous les sujets d\'aide',
    popularSearches: 'Recherches populaires',
    commonQuestions: 'Questions courantes',
    backToTop: 'Haut',
    noResults: 'Aucun résultat pour votre recherche. Essayez un autre mot ou contactez le support.',
    faqLoadError: 'Impossible de charger les FAQ.',
    faqEmpty: 'Pas encore de FAQ.',
    faqNoMatch: 'Aucune question correspondante.',

    sections: [
      {
        id: 'getting-started',
        icon: 'fa-rocket',
        title: 'Pour Commencer',
        desc: 'Tout ce qu il faut pour créer un compte et vous repérer sur Atelnyo.',
        paragraphs: [
          'Atelnyo est une plateforme internationale où des créateurs enseignent des cours en ligne, partagent de la musique et vendent des produits, pendant que les apprenants découvrent de nouvelles compétences. Tout est réuni au même endroit: le catalogue Explore, les profils de créateurs et votre bibliothèque personnelle.',
          "Vous pouvez utiliser Atelnyo en anglais, en créole haïtien, en français ou en espagnol — choisissez votre langue dans les Paramètres et toute l'application suit.",
        ],
        guides: [
          {
            title: 'Créer votre compte',
            steps: [
              "Ouvrez la page d'inscription et choisissez email, Google ou téléphone pour vous enregistrer.",
              'Vérifiez votre adresse email avec le lien que nous vous envoyons.',
              'Complétez votre profil: nom affiché, photo et une courte biographie.',
              "Choisissez les langues et les marchés pour lesquels vous voulez voir du contenu.",
            ],
          },
          {
            title: 'Mode apprenant vs mode créateur',
            steps: [
              'Chaque compte commence en apprenant: inscrivez-vous à des cours, écoutez de la musique et achetez des produits.',
              'Quand vous publiez votre premier cours, titre ou produit, vos outils créateur se débloquent automatiquement.',
              'Basculez entre les deux à tout moment depuis le menu de profil — vos données restent au même endroit.',
            ],
          },
        ],
        links: [
          { label: "S'inscrire", path: '/signup', icon: 'fa-user-plus' },
          { label: 'Explorer le catalogue', path: '/explore', icon: 'fa-compass' },
          { label: "À propos d'Atelnyo", path: '/about', icon: 'fa-circle-info' },
        ],
        questions: [
          { q: 'Comment créer un compte?', a: "Créez un compte gratuit avec email, Google ou téléphone, vérifiez votre adresse, puis complétez votre profil." },
          { q: 'Comment configurer mon profil créateur?', a: "Complétez votre profil et publiez votre premier cours, piste ou produit : vos outils créateurs s'activent automatiquement dans le studio." },
          { q: 'Comment basculer entre les modes apprenant et créateur?', a: "Chaque compte commence en mode apprenant. Dès votre première publication, le mode créateur se débloque — basculez quand vous voulez depuis le menu profil, sans perdre vos données." },
          { q: 'Quelles langues Atelnyo supporte-t-il?', a: "Atelnyo est disponible en anglais, créole haïtien, français et espagnol — choisissez dans Paramètres et toute l'application suit." },
        ],
      },
      {
        id: 'courses',
        icon: 'fa-graduation-cap',
        title: 'Cours & Apprentissage',
        desc: 'Parcourez, inscrivez-vous et terminez des cours — puis affichez vos certificats.',
        paragraphs: [
          'Les cours sont créés par des créateurs indépendants et organisés par catégorie, niveau et langue. La page Explore est la porte d entrée: filtrez par ce que vous voulez apprendre et ouvrez n importe quel cours pour une description complète, le programme et les avis.',
          'Votre progression est sauvegardée automatiquement — revenez sur n importe quel appareil et reprenez où vous en étiez.',
        ],
        guides: [
          {
            title: "Trouver et s'inscrire à un cours",
            steps: [
              'Ouvrez Explore et utilisez les filtres pour affiner par catégorie, prix ou langue.',
              'Ouvrez un cours pour lire le programme, voir l aperçu et consulter les avis.',
              "Touchez S'inscrire — les cours gratuits démarrent aussitôt, les cours payants passent par le paiement.",
              'Retrouvez tous vos cours dans votre bibliothèque depuis le menu de profil.',
            ],
          },
          {
            title: 'Certificats & progression',
            steps: [
              'Chaque leçon terminée met à jour votre barre de progression en temps réel.',
              'À 100%, vous pouvez télécharger votre certificat en PDF.',
              'Chaque certificat possède un code unique — n importe qui peut le confirmer sur la page Vérifier.',
              'Les créateurs voient quels étudiants ont terminé leurs cours dans le tableau de bord du studio.',
            ],
          },
        ],
        links: [
          { label: 'Parcourir les cours', path: '/explore', icon: 'fa-compass' },
          { label: 'Vérifier un certificat', path: '/verify', icon: 'fa-certificate' },
        ],
        questions: [
          { q: "Comment trouver et s'inscrire à un cours?", a: "Ouvrez Explore, filtrez par catégorie, prix ou langue, ouvrez un cours et appuyez sur S'inscrire — les cours gratuits commencent immédiatement, les payants passent par le paiement." },
          { q: 'Comment suivre mes progrès?', a: "Votre progression se sauvegarde automatiquement à chaque leçon terminée et se synchronise sur tous vos appareils." },
          { q: 'Comment fonctionnent les certificats?', a: "À 100 %, téléchargez votre certificat en PDF ; chaque certificat possède un code unique vérifiable sur la page Vérifier." },
          { q: 'Puis-je télécharger le contenu hors ligne?', a: "Le streaming priorise : vos leçons restent disponibles en ligne sur tout appareil, progression sauvegardée — pas encore de mode hors ligne." },
        ],
      },
      {
        id: 'music',
        icon: 'fa-music',
        title: 'Musique & Média',
        desc: 'Téléchargez, partagez et découvrez de la musique et du contenu média du monde entier.',
        paragraphs: [
          'Atelnyo est aussi une maison de streaming pour les artistes indépendants. Les titres vivent sur les profils de créateurs et dans le catalogue Explore sous le filtre Musique.',
          'La lecture fonctionne dans le navigateur et dans l application mobile — sans téléchargement, et l audio continue pendant que vous naviguez.',
        ],
        guides: [
          {
            title: 'Publier votre premier titre',
            steps: [
              'Connectez-vous et ouvrez le studio depuis le menu de profil.',
              'Choisissez Musique → Téléverser et déposez un fichier MP3, WAV, M4A ou FLAC.',
              'Ajoutez un titre, un genre, une pochette et une description, puis publiez.',
              'Partagez le lien du titre partout — il ouvre directement votre musique.',
            ],
          },
          {
            title: 'Découvrir de nouveaux artistes',
            steps: [
              'Ouvrez Explore et basculez le filtre sur Musique.',
              'Suivez des créateurs pour recevoir leurs nouveautés dans votre fil.',
              'Créez des playlists depuis le menu de n importe quel titre pour organiser vos favoris.',
            ],
          },
        ],
        links: [
          { label: 'Découvrir la musique', path: '/explore', icon: 'fa-compass' },
        ],
        questions: [
          { q: 'Comment télécharger de la musique sur Atelnyo?', a: "Depuis le studio, choisissez Musique → Télécharger, déposez votre fichier, ajoutez titre, genre et couverture, puis publiez — la page de la piste est partageable aussitôt." },
          { q: 'Quels formats audio sont supportés?', a: "MP3, WAV, M4A et FLAC sont pris en charge." },
          { q: 'Comment découvrir de nouveaux artistes?', a: "Ouvrez Explore avec le filtre Musique et suivez des artistes — leurs nouveautés arrivent dans votre fil." },
          { q: 'Puis-je créer des playlists?', a: "Oui — créez des playlists depuis le menu de n'importe quelle piste pour organiser vos favoris." },
        ],
      },
      {
        id: 'marketplace',
        icon: 'fa-shopping-bag',
        title: 'Marketplace & Produits',
        desc: 'Achetez et vendez des produits numériques, des services et des biens.',
        paragraphs: [
          'La marketplace connecte créateurs et acheteurs: téléchargements numériques, services et biens physiques. Chaque page produit affiche le prix, ce qui est inclus et les avis de vrais acheteurs.',
          'Les paiements sont traités de façon sécurisée — Atelnyo ne stocke jamais vos données de carte.',
        ],
        guides: [
          {
            title: 'Acheter en confiance',
            steps: [
              'Ouvrez Explore et filtrez par Produits, ou suivez un lien produit partagé par un créateur.',
              'Lisez la description, les fichiers inclus et les avis des acheteurs.',
              'Payez avec votre mode de paiement préféré — vous recevez un reçu par email.',
              'Vos téléchargements et services achetés restent disponibles dans votre bibliothèque.',
            ],
          },
          {
            title: 'Vendre votre premier produit',
            steps: [
              'Depuis le studio, choisissez Produits → Nouveau produit.',
              'Téléversez les fichiers ou photos, rédigez une description claire et fixez votre prix.',
              'Publiez — votre produit apparaît sur votre profil et dans Explore.',
              'Suivez commandes, messages et revenus depuis le tableau de bord du studio.',
            ],
          },
        ],
        links: [
          { label: 'Parcourir les produits', path: '/explore', icon: 'fa-compass' },
          { label: 'Retraits & frais', path: '#wallet', icon: 'fa-wallet' },
        ],
        questions: [
          { q: 'Comment mettre un produit en vente?', a: "Depuis le studio, choisissez Produits → Nouveau produit, ajoutez fichiers ou photos, rédigez une description claire, fixez votre prix et publiez." },
          { q: 'Quels modes de paiement sont acceptés?', a: "Cartes bancaires et méthodes locales selon votre pays — Atelnyo ne stocke jamais vos données de carte." },
          { q: 'Comment fonctionnent les retours et remboursements?', a: "Contactez d'abord le créateur ; sans résolution, le support examine chaque cas avec votre numéro de commande et rembourse lorsque les règles le permettent." },
          { q: 'Quels sont les frais de commission?', a: "Une commission n'est prélevée qu'à la vente — aucun frais fixe pour lister un produit." },
        ],
      },
      {
        id: 'creator',
        icon: 'fa-pen-nib',
        title: 'Studio Créateur',
        desc: 'Publiez des cours, de la musique et des produits — et développez votre audience.',
        paragraphs: [
          'Le studio est l espace de travail du créateur: publier du contenu, voir les statistiques, répondre aux questions des élèves et gérer vos revenus. Votre profil public est votre vitrine.',
          'Devenir créateur est gratuit — vous ne partagez une commission que lorsque vous vendez.',
        ],
        guides: [
          {
            title: 'Devenir créateur',
            steps: [
              'Créez votre compte gratuit et complétez votre profil.',
              'Ouvrez le studio et ajoutez votre nom affiché, votre bio et vos liens.',
              'Publiez votre premier cours, titre ou produit — un seul suffit pour être en ligne.',
              'Partagez le lien de votre profil sur les réseaux pour attirer votre audience.',
            ],
          },
          {
            title: 'Grandir avec les statistiques',
            steps: [
              'Le tableau de bord montre vues, ventes et progression des élèves en un coup d œil.',
              'Mettez à jour les contenus anciens selon les questions et les avis.',
              'Utilisez le programme d affiliation pour laisser d autres promouvoir votre travail contre une commission.',
            ],
          },
        ],
        links: [
          { label: "Programme d'affiliation", path: '/affiliate', icon: 'fa-bullhorn' },
          { label: 'Support créateur', path: '/contact', icon: 'fa-headset' },
        ],
        questions: [
          { q: 'Comment devenir créateur?', a: "Créez un compte gratuit, complétez votre profil et publiez votre premier cours, piste ou produit — c'est tout." },
          { q: 'Que puis-je publier sur Atelnyo?', a: "Cours, musique, produits, services et événements — tout contenu original dont vous détenez les droits." },
          { q: 'Quelle commission prend Atelnyo?', a: "Une commission n'est prélevée que sur vos ventes — consultez la page des tarifs pour le taux actuel." },
          { q: 'Comment fonctionnent les paiements créateurs?', a: "Vos gains s'accumulent dans votre portefeuille ; demandez un retrait dès le seuil minimum atteint (voir Facturation & Paiements)." },
        ],
      },
      {
        id: 'profile',
        icon: 'fa-id-card',
        title: 'Profil Public',
        desc: 'Votre vitrine sur Atelnyo : abonnement, onglets, avis et partage.',
        paragraphs: [
          'Chaque créateur dispose d\'un profil public — votre vitrine sur Atelnyo. Il rassemble vos cours, produits, portfolio, avis et votre histoire en une seule page partageable avec son propre lien.',
          'Les apprenants peuvent s\'abonner à vous pour voir vos nouveautés dans leur fil, laisser des avis liés à des achats réels et vous écrire — pendant que vous contrôlez ce qui apparaît depuis le studio.',
        ],
        guides: [
          {
            title: 'Trouver et partager un profil public',
            steps: [
              'Chaque profil a sa propre adresse : atelnyo.site/c/nom-d-utilisateur — par exemple /c/maria.',
              'Ouvrez n\'importe quel cours, produit ou piste pour accéder au profil du créateur en un clic sur le nom ou l\'avatar.',
              'Utilisez le bouton Partager sur le profil pour copier le lien ou l\'envoyer directement à vos applications.',
              'Abonnez-vous à un créateur pour recevoir ses nouveaux cours, pistes et produits dans votre fil.',
            ],
          },
          {
            title: 'Ce que montre chaque onglet',
            steps: [
              'Aperçu — l\'ensemble : statistiques, contenus en vedette et points forts.',
              'Picks — les contenus que le créateur recommande et sélectionne.',
              'Cours, Produits, Portfolio — tout ce que le créateur a publié, organisé par type.',
              'Avis — notes et commentaires d\'acheteurs réels ; À propos — l\'histoire du créateur et ses liens.',
            ],
          },
        ],
        links: [
          { label: 'Centre de Confiance', path: '/trust', icon: 'fa-shield-halved' },
          { label: 'Règles de communauté', path: '#community', icon: 'fa-people-group' },
        ],
        questions: [
          { q: 'Comment partager mon profil ?', a: "Appuyez sur Partager sur n'importe quel profil pour copier le lien atelnyo.site/c/nom-d-utilisateur, ou envoyez-le à vos applications." },
          { q: 'Comment m\'abonner à un créateur ?', a: "Appuyez sur Suivre sur n'importe quel profil — ses nouveaux cours, pistes et produits arrivent dans votre fil." },
          { q: 'Comment personnaliser ce qui apparaît sur mon profil ?', a: "Depuis le studio : modifiez votre bio, votre couverture et vos liens, et gérez ce que chaque onglet affiche sur votre page publique." },
          { q: 'Qui peut voir mon profil ?', a: "Les profils publics sont visibles de tous — c'est la vitrine. Vos données personnelles (email, téléphone) restent privées." },
        ],
      },
      {
        id: 'explore',
        icon: 'fa-compass',
        title: 'Explorer & Découvrir',
        desc: 'Un seul catalogue pour toute la plateforme — filtrez selon vos besoins.',
        paragraphs: [
          'Explore est la porte d\'entrée d\'Atelnyo. Une seule recherche couvre toute la plateforme : cours, musique, talents à louer, emplois, événements, produits, communautés et spots lumineux — le tout publié par des créateurs indépendants.',
          'Utilisez les filtres pour affiner par type, catégorie, prix ou langue, et abonnez-vous aux créateurs pour construire un fil qui correspond à vos intérêts.',
        ],
        guides: [
          {
            title: 'Trouver n\'importe quel type de contenu',
            steps: [
              'Ouvrez Explore depuis le menu principal ou sur atelnyo.site/explore.',
              'Changez le filtre de type : Musique, Cours, Talents, Emplois, Événements, Produits ou Communautés.',
              'Ouvrez une carte pour voir la page complète — chaque article renvoie au profil du créateur.',
              'Enregistrez vos favoris et abonnez-vous aux créateurs pour personnaliser votre fil.',
            ],
          },
        ],
        links: [
          { label: 'Ouvrir Explore', path: '/explore', icon: 'fa-compass' },
          { label: 'Trouver des créateurs', path: '#profile', icon: 'fa-id-card' },
        ],
        questions: [
          { q: 'Comment trouver des cours, de la musique ou des produits ?', a: "Ouvrez Explore et tapez un mot-clé, ou changez le filtre de type : Musique, Cours, Talents, Emplois, Événements ou Produits." },
          { q: 'Comment fonctionnent les filtres d\'Explore ?', a: "Les puces de filtre combinent type, catégorie, prix et langue pour affiner les résultats pendant la navigation." },
          { q: 'Quels types de contenu existent sur Atelnyo ?', a: "Cours, musique, talents à louer, emplois, événements, produits, communautés et spots — tout publié par des créateurs indépendants." },
          { q: 'Comment personnaliser mon fil ?', a: "Abonnez-vous à des créateurs et enregistrez des favoris — votre fil reflète alors vos goûts." },
        ],
      },
      {
        id: 'wallet',
        icon: 'fa-wallet',
        title: 'Facturation & Paiements',
        desc: 'Tarifs, retraits, calendriers de paiement et problèmes de paiement — expliqués.',
        paragraphs: [
          'Les revenus des cours, de la musique et des produits s accumulent dans votre portefeuille. Vous pouvez demander un retrait dès que votre solde dépasse le seuil minimum.',
          'Les paiements sont traités selon un calendrier régulier; le délai exact dépend de votre prestataire et de votre pays.',
        ],
        guides: [
          {
            title: 'Retirer vos gains',
            steps: [
              'Ouvrez votre portefeuille depuis le menu de profil pour voir votre solde disponible.',
              'Ajoutez ou confirmez votre mode de paiement.',
              'Demandez un retrait et surveillez l email de confirmation.',
              'Suivez le statut du paiement dans la liste d historique du portefeuille.',
            ],
          },
          {
            title: 'Problèmes de paiement',
            steps: [
              'Paiement refusé: vérifiez d abord avec votre banque, puis essayez une autre carte ou méthode.',
              'Reçu manquant: cherchez dans votre boîte mail les emails d Atelnyo, spam inclus.',
              'Toujours bloqué? Contactez le support avec le numéro de commande et nous réglons cela.',
            ],
          },
        ],
        links: [
          { label: 'Contacter le support', path: '/contact', icon: 'fa-headset' },
          { label: 'État du système', path: '/status', icon: 'fa-signal' },
        ],
        questions: [
          { q: 'Comment retirer mes gains?', a: "Ouvrez votre portefeuille depuis le menu profil, vérifiez votre solde, ajoutez un moyen de paiement et demandez un retrait." },
          { q: 'Quels sont les calendriers de paiement?', a: "Les paiements suivent un calendrier régulier ; le délai exact dépend de votre prestataire et de votre pays." },
          { q: 'Comment mettre à jour mon mode de paiement?', a: "Dans le portefeuille, mettez à jour ou confirmez votre moyen de paiement et enregistrez — les retraits suivants l'utilisent automatiquement." },
          { q: 'Pourquoi mon paiement a été refusé?', a: "Vérifiez d'abord auprès de votre banque, essayez une autre carte ou méthode ; si l'échec persiste, contactez le support avec le numéro de commande." },
        ],
      },
      {
        id: 'affiliate',
        icon: 'fa-bullhorn',
        title: "Programme d'Affiliation",
        desc: 'Gagnez des commissions en faisant la promotion des créateurs et de leur contenu.',
        paragraphs: [
          'Toute personne avec un compte Atelnyo peut rejoindre le programme d affiliation. Partagez vos liens uniques vers des cours, de la musique ou des produits — quand quelqu un achète via votre lien, vous gagnez une commission.',
          'C est un moyen simple pour les blogs, les communautés et les fans de soutenir les créateurs qu ils aiment tout en gagnant quelque chose.',
        ],
        guides: [
          {
            title: 'Commencer à gagner en 3 étapes',
            steps: [
              'Ouvrez la page Affiliation et activez — un seul geste.',
              'Copiez votre lien unique depuis n importe quelle page de cours ou de produit.',
              'Partagez-le sur votre blog, vos réseaux ou votre newsletter et voyez les recommandations apparaître dans le tableau de bord.',
            ],
          },
        ],
        links: [
          { label: "Programme d'affiliation", path: '/affiliate', icon: 'fa-bullhorn' },
          { label: 'Découvrir les offres', path: '/affiliate/discover', icon: 'fa-compass' },
        ],
        questions: [
          { q: 'Comment rejoindre le programme d affiliation?', a: "Ouvrez la page Affiliés et activez le programme — un seul clic, gratuit avec tout compte." },
          { q: 'Quelle commission puis-je gagner?', a: "Vous gagnez un pourcentage de chaque vente via votre lien ; le taux actuel figure sur la page Affiliés." },
          { q: 'Quand les paiements d affiliation sont-ils envoyés?', a: "Les paiements d'affiliation suivent le même calendrier que les paiements créateurs, une fois le minimum atteint." },
          { q: 'Où trouver mes liens d affiliation?', a: "Copiez votre lien unique depuis n'importe quelle page de cours ou de produit — chaque clic via ce lien vous est attribué." },
        ],
      },
      {
        id: 'account',
        icon: 'fa-user-gear',
        title: 'Compte & Sécurité',
        desc: 'Mots de passe, confidentialité, authentification à deux facteurs et suppression de compte.',
        paragraphs: [
          'Les paramètres de votre compte contrôlent tout: email, mot de passe, confidentialité, notifications et méthodes de connexion associées.',
          "La sécurité est prise au sérieux — activez l'authentification à deux facteurs pour la protection maximale de votre contenu et de vos revenus.",
        ],
        guides: [
          {
            title: 'Mettre à jour vos identifiants',
            steps: [
              'Ouvrez les Paramètres depuis le menu de profil.',
              'Utilisez Changer le mot de passe ou Changer l email et confirmez avec votre mot de passe actuel.',
              'Vérifiez votre boîte mail pour le message de confirmation afin de finaliser le changement.',
            ],
          },
          {
            title: 'Protéger votre compte',
            steps: [
              "Activez l'authentification à deux facteurs dans Paramètres → Sécurité.",
              'Passez en revue les sessions actives et déconnectez les appareils que vous ne reconnaissez pas.',
              'Ne partagez jamais votre mot de passe ni vos codes — l équipe Atelnyo ne les demandera jamais.',
            ],
          },
        ],
        links: [
          { label: 'Centre de Confiance', path: '/trust', icon: 'fa-shield-halved' },
          { label: 'Centre légal', path: '/legal', icon: 'fa-scale-balanced' },
        ],
        questions: [
          { q: 'Comment changer mon mot de passe ou email?', a: "Paramètres → Changer le mot de passe / l'email, confirmez avec votre mot de passe actuel, puis validez via l'email de confirmation envoyé." },
          { q: 'Comment gérer mes paramètres de confidentialité?', a: "Paramètres → Confidentialité : notifications, visibilité et préférences de données réunies au même endroit." },
          { q: 'Comment supprimer mon compte?', a: "Paramètres → Supprimer le compte ; la suppression est définitive après le délai de confirmation, et votre contenu public disparaît avec." },
          { q: "Comment activer l'authentification à deux facteurs?", a: "Paramètres → Sécurité → activez la 2FA ; ne partagez jamais vos codes — l'équipe Atelnyo ne les demandera jamais." },
        ],
      },
      {
        id: 'tiktok',
        icon: 'fa-share-nodes',
        title: "Intégration TikTok",
        desc: "Connectez votre compte TikTok et publiez vos vidéos Atelnyo directement sur TikTok depuis le Creator Studio.",
        paragraphs: [
          "Les créateurs peuvent lier un seul compte TikTok à Atelnyo. Une fois connecté, les vidéos de votre moteur média peuvent être publiées directement sur TikTok sans quitter le studio — progression, statut et lien TikTok final reviennent dans le même onglet Médias → TikTok.",
          "Jusqu'à ce que TikTok approuve l'audit de la plateforme, les publications sortent en privé (vous seul les voyez sur TikTok). La publication publique se débloque automatiquement une fois l'audit validé.",
        ],
        guides: [
          {
            title: "Connecter votre compte TikTok",
            steps: [
              "Ouvrez Creator Studio → Médias → TikTok.",
              "Appuyez sur « Connecter votre compte TikTok » — une fenêtre de consentement TikTok s'ouvre.",
              "Approuvez les permissions ; la fenêtre se ferme et votre compte apparaît sur la carte.",
              "Votre lien TikTok est ajouté automatiquement à votre profil public ; la déconnexion le retire.",
            ],
          },
          {
            title: "Publier une vidéo",
            steps: [
              "Dans le même onglet TikTok, appuyez sur « Nouveau post TikTok ».",
              "Choisissez une vidéo dans votre bibliothèque média — la légende et les hashtags peuvent être générés par le bouton IA.",
              "Choisissez qui peut voir la publication, puis confirmez.",
              "TikTok traite la vidéo ; le badge de statut se met à jour jusqu'à la mise en ligne avec son lien TikTok.",
            ],
          },
        ],
        links: [
          { label: 'Creator Studio', path: '/sheet/studio?section=media&mediaTab=tiktok', icon: 'fa-palette' },
        ],
        questions: [
          { q: "Puis-je connecter plusieurs comptes TikTok ?", a: "Un seul compte TikTok par créateur Atelnyo pour l'instant — déconnectez puis reconnectez pour changer de compte." },
          { q: "Pourquoi mon post TikTok est-il privé ?", a: "Jusqu'à ce que TikTok termine l'audit de la plateforme, toutes les publications API sortent en privé (vous seul). Une fois l'audit validé, la publication publique se débloque." },
          { q: "Puis-je supprimer ou modifier un post TikTok depuis Atelnyo ?", a: "Non — l'API TikTok ne permet pas de modifier ou supprimer des posts publiés. Gérez-les dans l'application TikTok elle-même." },
        ],
      },
      {
        id: 'community',
        icon: 'fa-people-group',
        title: 'Communauté & Confiance',
        desc: 'Avis, abonnements, signalements — et la sécurité de tous sur Atelnyo.',
        paragraphs: [
          'Atelnyo repose sur la confiance entre apprenants et créateurs. Les avis, les fils d abonnement et la vérification des créateurs aident chacun à trouver du contenu de qualité — et les outils de signalement écartent les mauvais acteurs.',
          'Soyez bienveillant, honnête, et signalez tout ce qui enfreint les règles. Notre équipe examine chaque signalement.',
        ],
        guides: [
          {
            title: 'Fonder votre communauté',
            steps: [
              'Publiez d abord quelque chose — un cours, un produit ou un titre. La création est réservée aux créateurs ayant du contenu sur la plateforme.',
              'Dans Explore, ouvrez la puce Communautés et appuyez sur « Fonder une Communauté ».',
              'Choisissez un nom, une catégorie et le mode d adhésion : ouvert à tous, sur approbation ou sur invitation.',
              'Vous devenez le fondateur — ajoutez des règles, épinglez des annonces et modérez depuis la page de la communauté.',
              'Pour les communautés sur approbation, les demandes attendent dans Creator Studio → Communautés jusqu\'à votre décision.',
            ],
          },
          {
            title: 'Des avis utiles',
            steps: [
              'Après avoir terminé un cours ou acheté un produit, laissez une note honnête et quelques mots.',
              'Précisez à qui le contenu convient le mieux — cela aide les autres apprenants.',
              'Les avis sont liés à de vrais achats, ils ne peuvent pas être falsifiés.',
            ],
          },
          {
            title: 'Signaler un problème',
            steps: [
              'Utilisez le lien de signalement sur n importe quel profil, cours, titre ou produit.',
              'Dites-nous ce qui ne va pas — plus il y a de détails, plus vite nous pouvons agir.',
              'Les problèmes graves peuvent aussi aller directement au support par email.',
            ],
          },
        ],
        links: [
          { label: 'Centre de Confiance', path: '/trust', icon: 'fa-shield-halved' },
          { label: 'Accessibilité', path: '/accessibility', icon: 'fa-universal-access' },
        ],
        questions: [
          { q: 'Qui peut fonder une communauté?', a: "Les créateurs ayant au moins un cours, un produit ou une musique publiée — le bouton apparaît dans Explore dès que vous avez du contenu sur la plateforme." },
          { q: 'Qui peut fonder une communauté?', a: "Les créateurs ayant au moins un cours, un produit ou une musique publiée — le bouton apparaît dans Explore dès que vous avez du contenu sur la plateforme." },
          { q: 'Comment fonctionnent les avis?', a: "Les avis sont liés à des achats réels, donc infalsifiables — laissez un retour honnête et précis après un cours terminé ou un achat." },
          { q: 'Comment signaler un contenu inapproprié?', a: "Utilisez le lien Signaler sur n'importe quel profil, cours, piste ou produit, en décrivant le problème avec un maximum de détails." },
          { q: 'Que se passe-t-il après un signalement?', a: "Notre équipe examine chaque signalement et agit selon les règles ; les cas graves vont directement au support et peuvent mener à une suspension ou un retrait." },
          { q: 'Comment fonctionnent les badges vérifiés?', a: "Les badges vérifiés sont accordés après vérification de l'identité du créateur — un signal de confiance que la personne est réelle." },
        ],
      },
      {
        id: 'troubleshooting',
        icon: 'fa-screwdriver-wrench',
        title: 'Dépannage',
        desc: 'Solutions rapides pour les soucis de chargement, de lecture et de paiement.',
        paragraphs: [
          'La plupart des problèmes ont une solution rapide. Suivez ces étapes avant de contacter le support — elles règlent la majorité des cas en moins de deux minutes.',
        ],
        guides: [
          {
            title: "L'application ne se charge pas",
            steps: [
              'Consultez la page de statut pour savoir si Atelnyo rencontre un incident.',
              'Rechargez la page avec un rechargement forcé (Ctrl/Cmd + Shift + R).',
              'Videz le cache de votre navigateur ou essayez une fenêtre privée.',
              'Sur mobile, mettez l application à jour vers la dernière version.',
            ],
          },
          {
            title: 'Audio ou vidéo qui ne se lance pas',
            steps: [
              'Vérifiez votre connexion internet et essayez un autre réseau si possible.',
              "Assurez-vous que l'onglet n'est pas en sourdine et que le volume est monté.",
              'Déconnectez-vous puis reconnectez-vous — une session expirée peut bloquer la lecture.',
              'Toujours cassé? Envoyez-nous le lien du titre ou du cours et votre appareil.',
            ],
          },
        ],
        links: [
          { label: 'État du système', path: '/status', icon: 'fa-signal' },
          { label: 'Développeurs', path: '/developers', icon: 'fa-code' },
          { label: 'Contacter le support', path: '/contact', icon: 'fa-headset' },
        ],
        questions: [
          { q: "Pourquoi l'application est-elle lente?", a: "Consultez la page Statut pour les incidents, faites un rechargement forcé (Ctrl/Cmd + Shift + R) ou essayez une fenêtre privée." },
          { q: 'Pourquoi mon audio ne se lance pas?', a: "Vérifiez votre connexion et le volume de l'onglet, puis déconnectez/reconnectez-vous — une session expirée bloque la lecture." },
          { q: 'Pourquoi mon paiement a échoué?', a: "Vérifiez auprès de votre banque, essayez une autre carte ou méthode, puis contactez le support avec le numéro de commande pour une résolution rapide." },
          { q: 'Comment vider le cache de l application?', a: "Videz le cache du navigateur ou essayez une fenêtre privée ; sur mobile, mettez l'application à jour." },
        ],
      },
    ],

    faqTitle: 'Questions Fréquentes',
    contactNav: 'Contact',
    contactTitle: "Vous n'avez pas trouvé ce que vous cherchiez?",
    contactDesc: 'Notre équipe de support est prête à vous aider avec vos questions.',
    contactBtn: 'Contacter le Support',
    contactAlt: 'Ou contactez-nous par email à',
    contactEmail: 'support@atelnyo.site',

    relatedTitle: 'Pages Connexes',
    relatedItems: [
      { label: "À propos d'Atelnyo", path: '/about', icon: 'fa-circle-info' },
      { label: 'Centre de Confiance', path: '/trust', icon: 'fa-shield-halved' },
      { label: 'FAQ', path: '/faq', icon: 'fa-circle-question' },
      { label: 'Légal', path: '/legal', icon: 'fa-scale-balanced' },
      { label: 'Accessibilité', path: '/accessibility', icon: 'fa-universal-access' },
      { label: 'État du système', path: '/status', icon: 'fa-signal' },
      { label: 'Développeurs', path: '/developers', icon: 'fa-code' },
      { label: 'Thèmes', path: '/themes', icon: 'fa-palette' },
      { label: 'Vérifier un certificat', path: '/verify', icon: 'fa-certificate' },
      { label: "Programme d'affiliation", path: '/affiliate', icon: 'fa-bullhorn' },
    ],
  },
  es: {
    heroTitle: '¿Cómo podemos ayudarte?',
    heroSubtitle: 'Busca en nuestro centro de ayuda o explora los temas a continuación',
    searchPlaceholder: 'Buscar ayuda...',
    clearSearch: 'Borrar la búsqueda',

    onThisPage: 'En esta página',
    topicsIndex: 'Todos los temas de ayuda',
    popularSearches: 'Búsquedas populares',
    commonQuestions: 'Preguntas frecuentes',
    backToTop: 'Arriba',
    noResults: 'Nada coincide con tu búsqueda. Prueba otra palabra o contacta al soporte.',
    faqLoadError: 'No se pudieron cargar las FAQ.',
    faqEmpty: 'Aún no hay FAQ.',
    faqNoMatch: 'No hay preguntas coincidentes.',

    sections: [
      {
        id: 'getting-started',
        icon: 'fa-rocket',
        title: 'Primeros Pasos',
        desc: 'Todo lo que necesitas para crear una cuenta y orientarte en Atelnyo.',
        paragraphs: [
          'Atelnyo es una plataforma internacional donde los creadores enseñan cursos en línea, comparten música y venden productos, mientras los estudiantes descubren nuevas habilidades. Todo está bajo un mismo techo: el catálogo Explore, los perfiles de creadores y tu biblioteca personal.',
          'Puedes usar Atelnyo en inglés, criollo haitiano, francés o español — elige tu idioma en Configuración y toda la app lo sigue.',
        ],
        guides: [
          {
            title: 'Crea tu cuenta',
            steps: [
              'Abre la página de registro y elige email, Google o teléfono para inscribirte.',
              'Verifica tu dirección de email con el enlace que te enviamos.',
              'Completa tu perfil: nombre visible, foto y una breve biografía.',
              'Elige los idiomas y mercados cuyo contenido quieres ver.',
            ],
          },
          {
            title: 'Modo estudiante vs modo creador',
            steps: [
              'Toda cuenta empieza como estudiante: inscríbete en cursos, escucha música y compra productos.',
              'Al publicar tu primer curso, pista o producto, tus herramientas de creador se desbloquean automáticamente.',
              'Cambia entre ambos en cualquier momento desde el menú de perfil — tus datos quedan en un solo lugar.',
            ],
          },
        ],
        links: [
          { label: 'Registrarse', path: '/signup', icon: 'fa-user-plus' },
          { label: 'Explorar catálogo', path: '/explore', icon: 'fa-compass' },
          { label: 'Sobre Atelnyo', path: '/about', icon: 'fa-circle-info' },
        ],
        questions: [
          { q: '¿Cómo creo una cuenta?', a: "Crea una cuenta gratis con email, Google o teléfono, verifica tu dirección y completa tu perfil." },
          { q: '¿Cómo configuro mi perfil de creador?', a: "Completa tu perfil y publica tu primer curso, pista o producto: tus herramientas de creador se activan automáticamente en el estudio." },
          { q: '¿Cómo cambio entre modo estudiante y creador?', a: "Cada cuenta empieza como estudiante. Al publicar tu primer contenido se desbloquea el modo creador — cambia cuando quieras desde el menú de perfil, sin perder datos." },
          { q: '¿Qué idiomas soporta Atelnyo?', a: "Atelnyo funciona en inglés, criollo haitiano, francés y español — elige tu idioma en Configuración y toda la app te sigue." },
        ],
      },
      {
        id: 'courses',
        icon: 'fa-graduation-cap',
        title: 'Cursos y Aprendizaje',
        desc: 'Explora, inscríbete y completa cursos — luego presume tus certificados.',
        paragraphs: [
          'Los cursos son creados por creadores independientes y organizados por categoría, nivel e idioma. La página Explore es la puerta de entrada: filtra por lo que quieres aprender y abre cualquier curso para ver la descripción completa, el temario y las reseñas.',
          'Tu progreso se guarda automáticamente — vuelve desde cualquier dispositivo y continúa donde lo dejaste.',
        ],
        guides: [
          {
            title: 'Encuentra e inscríbete en un curso',
            steps: [
              'Abre Explore y usa los filtros para acotar por categoría, precio o idioma.',
              'Abre un curso para leer el temario, ver la vista previa y revisar las reseñas.',
              'Toca Inscribirse — los cursos gratis empiezan al instante, los de pago pasan por el checkout.',
              'Encuentra todos tus cursos inscritos en tu biblioteca desde el menú de perfil.',
            ],
          },
          {
            title: 'Certificados y progreso',
            steps: [
              'Cada lección completada actualiza tu barra de progreso en tiempo real.',
              'Al llegar al 100% puedes descargar tu certificado en PDF.',
              'Cada certificado tiene un código único — cualquiera puede confirmarlo en la página Verificar.',
              'Los creadores ven qué estudiantes completaron sus cursos en el panel del estudio.',
            ],
          },
        ],
        links: [
          { label: 'Explorar cursos', path: '/explore', icon: 'fa-compass' },
          { label: 'Verificar certificado', path: '/verify', icon: 'fa-certificate' },
        ],
        questions: [
          { q: '¿Cómo encuentro e inscribo en un curso?', a: "Abre Explore, filtra por categoría, precio o idioma, abre un curso y toca Inscribirte — los cursos gratis empiezan al instante, los de pago pasan por el checkout." },
          { q: '¿Cómo sigo mi progreso?', a: "Tu progreso se guarda automáticamente con cada lección completada y se sincroniza en todos tus dispositivos." },
          { q: '¿Cómo funcionan los certificados?', a: "Al llegar al 100%, descarga tu certificado en PDF; cada certificado tiene un código único verificable en la página Verificar." },
          { q: '¿Puedo descargar contenido sin conexión?', a: "El streaming va primero: tus lecciones quedan disponibles en línea en cualquier dispositivo con el progreso guardado — aún no hay modo sin conexión." },
        ],
      },
      {
        id: 'music',
        icon: 'fa-music',
        title: 'Música y Medios',
        desc: 'Sube, comparte y descubre música y contenido multimedia de creadores de todo el mundo.',
        paragraphs: [
          'Atelnyo también es un hogar de streaming para artistas independientes. Las pistas viven en los perfiles de creadores y en el catálogo Explore bajo el filtro Música.',
          'La reproducción funciona en el navegador y en la app móvil — sin descargas, y el audio sigue sonando mientras navegas.',
        ],
        guides: [
          {
            title: 'Sube tu primera pista',
            steps: [
              'Inicia sesión y abre el estudio desde el menú de perfil.',
              'Elige Música → Subir y arrastra un archivo MP3, WAV, M4A o FLAC.',
              'Añade título, género, portada y descripción, y publica.',
              'Comparte el enlace de la pista donde quieras — abre directamente tu música.',
            ],
          },
          {
            title: 'Descubre nuevos artistas',
            steps: [
              'Abre Explore y cambia el filtro a Música.',
              'Sigue a creadores para recibir sus lanzamientos en tu feed.',
              'Crea listas de reproducción desde el menú de cualquier pista para organizar lo que amas.',
            ],
          },
        ],
        links: [
          { label: 'Descubrir música', path: '/explore', icon: 'fa-compass' },
        ],
        questions: [
          { q: '¿Cómo subo música a Atelnyo?', a: "Desde el estudio elige Música → Subir, arrastra tu archivo, añade título, género y portada, y publica — la página de la pista se puede compartir de inmediato." },
          { q: '¿Qué formatos de audio se soportan?', a: "Se admiten MP3, WAV, M4A y FLAC." },
          { q: '¿Cómo descubro nuevos artistas?', a: "Abre Explore con el filtro Música y sigue a artistas — sus lanzamientos llegan a tu feed." },
          { q: '¿Puedo crear listas de reproducción?', a: "Sí — crea listas de reproducción desde el menú de cualquier pista para organizar tus favoritos." },
        ],
      },
      {
        id: 'marketplace',
        icon: 'fa-shopping-bag',
        title: 'Marketplace y Productos',
        desc: 'Compra y vende productos digitales, servicios y bienes físicos.',
        paragraphs: [
          'El marketplace conecta creadores con compradores: descargas digitales, servicios y bienes físicos. Cada página de producto muestra el precio, qué incluye y reseñas de compradores reales.',
          'Los pagos se procesan de forma segura — Atelnyo nunca almacena los datos de tu tarjeta.',
        ],
        guides: [
          {
            title: 'Compra con confianza',
            steps: [
              'Abre Explore y filtra por Productos, o sigue un enlace de producto compartido por un creador.',
              'Revisa la descripción, los archivos incluidos y las reseñas de compradores.',
              'Paga con tu método preferido — recibes un recibo por email.',
              'Las descargas y servicios comprados quedan disponibles en tu biblioteca.',
            ],
          },
          {
            title: 'Vende tu primer producto',
            steps: [
              'Desde el estudio, elige Productos → Nuevo producto.',
              'Sube los archivos o fotos, escribe una descripción clara y fija tu precio.',
              'Publica — tu producto aparece en tu perfil y en Explore.',
              'Sigue pedidos, mensajes y ganancias desde el panel del estudio.',
            ],
          },
        ],
        links: [
          { label: 'Explorar productos', path: '/explore', icon: 'fa-compass' },
          { label: 'Retiros y comisiones', path: '#wallet', icon: 'fa-wallet' },
        ],
        questions: [
          { q: '¿Cómo publico un producto en venta?', a: "Desde el estudio elige Productos → Nuevo producto, sube archivos o fotos, escribe una descripción clara, fija tu precio y publica." },
          { q: '¿Qué métodos de pago se aceptan?', a: "Tarjetas bancarias y métodos locales según tu país — Atelnyo nunca almacena los datos de tu tarjeta." },
          { q: '¿Cómo funcionan las devoluciones y reembolsos?', a: "Contacta primero al creador; si no se resuelve, el soporte revisa cada caso con tu número de pedido y reembolsa cuando las reglas lo permiten." },
          { q: '¿Cuáles son las comisiones?', a: "Solo se cobra comisión cuando vendes — no hay cuota fija por publicar productos." },
        ],
      },
      {
        id: 'creator',
        icon: 'fa-pen-nib',
        title: 'Estudio de Creador',
        desc: 'Publica cursos, música y productos — y haz crecer tu audiencia.',
        paragraphs: [
          'El estudio es el espacio de trabajo del creador: publica contenido, ve estadísticas, responde preguntas de estudiantes y gestiona tus ingresos. Tu perfil público es tu escaparate.',
          'No hay costo por ser creador — solo compartes una comisión cuando vendes.',
        ],
        guides: [
          {
            title: 'Conviértete en creador',
            steps: [
              'Crea tu cuenta gratis y completa tu perfil.',
              'Abre el estudio y añade tu nombre visible, bio y enlaces.',
              'Publica tu primer curso, pista o producto — con uno basta para estar en línea.',
              'Comparte el enlace de tu perfil en redes sociales para traer a tu audiencia.',
            ],
          },
          {
            title: 'Crece con estadísticas',
            steps: [
              'El panel muestra vistas, ventas y progreso de estudiantes de un vistazo.',
              'Actualiza el contenido antiguo según las preguntas y reseñas.',
              'Usa el programa de afiliados para que otros promuevan tu trabajo a cambio de una parte.',
            ],
          },
        ],
        links: [
          { label: 'Programa de afiliados', path: '/affiliate', icon: 'fa-bullhorn' },
          { label: 'Soporte para creadores', path: '/contact', icon: 'fa-headset' },
        ],
        questions: [
          { q: '¿Cómo me convierto en creador?', a: "Crea una cuenta gratis, completa tu perfil y publica tu primer curso, pista o producto — eso es todo." },
          { q: '¿Qué puedo publicar en Atelnyo?', a: "Cursos, música, productos, servicios y eventos — todo contenido original del que tengas los derechos." },
          { q: '¿Cuánta comisión cobra Atelnyo?', a: "Solo se cobra comisión sobre tus ventas — consulta la página de precios para la tasa actual." },
          { q: '¿Cómo funcionan los pagos a creadores?', a: "Tus ganancias se acumulan en tu cartera; solicita un retiro al superar el mínimo (ver Facturación y Pagos)." },
        ],
      },
      {
        id: 'profile',
        icon: 'fa-id-card',
        title: 'Perfil Público',
        desc: 'Tu escaparate en Atelnyo: seguir, pestañas, reseñas y compartir.',
        paragraphs: [
          'Cada creador tiene un perfil público — tu escaparate en Atelnyo. Reúne tus cursos, productos, portafolio, reseñas e historia en una sola página con su propio enlace para compartir.',
          'Los estudiantes pueden seguirte para ver tus novedades en su feed, dejar reseñas ligadas a compras reales y escribirte — mientras tú controlas qué aparece desde el estudio.',
        ],
        guides: [
          {
            title: 'Encontrar y compartir un perfil público',
            steps: [
              'Cada perfil tiene su propia dirección: atelnyo.site/c/nombre-de-usuario — por ejemplo /c/maria.',
              'Abre cualquier curso, producto o pista para llegar al perfil del creador con un toque en el nombre o el avatar.',
              'Usa el botón Compartir del perfil para copiar el enlace o enviarlo directo a tus apps.',
              'Sigue a un creador para recibir sus nuevos cursos, pistas y productos en tu feed.',
            ],
          },
          {
            title: 'Qué muestra cada pestaña',
            steps: [
              'Resumen — el cuadro completo: estadísticas, contenido destacado y momentos clave.',
              'Picks — el contenido que el creador recomienda y selecciona.',
              'Cursos, Productos, Portafolio — todo lo que el creador publicó, organizado por tipo.',
              'Reseñas — valoraciones y comentarios de compradores reales; Acerca de — la historia del creador y sus enlaces.',
            ],
          },
        ],
        links: [
          { label: 'Centro de Confianza', path: '/trust', icon: 'fa-shield-halved' },
          { label: 'Normas de comunidad', path: '#community', icon: 'fa-people-group' },
        ],
        questions: [
          { q: '¿Cómo comparto mi perfil?', a: "Toca Compartir en cualquier perfil para copiar su enlace atelnyo.site/c/nombre-de-usuario, o envíalo a tus apps." },
          { q: '¿Cómo sigo a un creador?', a: "Toca Seguir en cualquier perfil — sus nuevos cursos, pistas y productos llegan a tu feed." },
          { q: '¿Cómo personalizo qué aparece en mi perfil?', a: "Desde el estudio: edita tu bio, portada y enlaces, y gestiona qué muestra cada pestaña en tu página pública." },
          { q: '¿Quién puede ver mi perfil?', a: "Los perfiles públicos son visibles para todos — es el escaparate. Tus datos personales (email, teléfono) quedan privados." },
        ],
      },
      {
        id: 'explore',
        icon: 'fa-compass',
        title: 'Explorar y Descubrir',
        desc: 'Un solo catálogo para toda la plataforma — filtra según lo que necesites.',
        paragraphs: [
          'Explore es la puerta de entrada de Atelnyo. Una sola búsqueda cubre toda la plataforma: cursos, música, talentos para contratar, empleos, eventos, productos, comunidades y spots destacados — todo publicado por creadores independientes.',
          'Usa los filtros para acotar por tipo, categoría, precio o idioma, y sigue a creadores para construir un feed que coincida con tus intereses.',
        ],
        guides: [
          {
            title: 'Encontrar cualquier tipo de contenido',
            steps: [
              'Abre Explore desde el menú principal o en atelnyo.site/explore.',
              'Cambia el filtro de tipo: Música, Cursos, Talentos, Empleos, Eventos, Productos o Comunidades.',
              'Abre una tarjeta para ver la página completa — cada artículo enlaza al perfil del creador.',
              'Guarda favoritos y sigue a creadores para personalizar tu feed.',
            ],
          },
        ],
        links: [
          { label: 'Abrir Explore', path: '/explore', icon: 'fa-compass' },
          { label: 'Encontrar creadores', path: '#profile', icon: 'fa-id-card' },
        ],
        questions: [
          { q: '¿Cómo encuentro cursos, música o productos?', a: "Abre Explore y escribe una palabra clave, o cambia el filtro de tipo: Música, Cursos, Talentos, Empleos, Eventos o Productos." },
          { q: '¿Cómo funcionan los filtros de Explore?', a: "Los filtros combinan tipo, categoría, precio e idioma para afinar los resultados mientras navegas." },
          { q: '¿Qué tipos de contenido existen en Atelnyo?', a: "Cursos, música, talentos para contratar, empleos, eventos, productos, comunidades y spots — todo publicado por creadores independientes." },
          { q: '¿Cómo personalizo mi feed?', a: "Sigue a creadores y guarda favoritos — tu feed reflejará lo que realmente te gusta." },
        ],
      },
      {
        id: 'wallet',
        icon: 'fa-wallet',
        title: 'Facturación y Pagos',
        desc: 'Precios, retiros, calendarios de pago y problemas de pago — explicados.',
        paragraphs: [
          'Las ganancias de cursos, música y productos se acumulan en tu cartera. Puedes solicitar un retiro cuando tu saldo supere el mínimo.',
          'Los pagos se procesan según un calendario regular; el plazo exacto depende de tu proveedor y país.',
        ],
        guides: [
          {
            title: 'Retira tus ganancias',
            steps: [
              'Abre tu cartera desde el menú de perfil para ver tu saldo disponible.',
              'Añade o confirma tu método de pago.',
              'Solicita un retiro y espera el email de confirmación.',
              'Sigue el estado del pago en el historial de la cartera.',
            ],
          },
          {
            title: 'Problemas de pago',
            steps: [
              'Pago rechazado: consulta primero con tu banco y prueba otra tarjeta o método.',
              'Recibo perdido: busca en tu bandeja los correos de Atelnyo, incluido spam.',
              '¿Sigues atascado? Contacta al soporte con el número de pedido y lo resolvemos.',
            ],
          },
        ],
        links: [
          { label: 'Contactar soporte', path: '/contact', icon: 'fa-headset' },
          { label: 'Estado del sistema', path: '/status', icon: 'fa-signal' },
        ],
        questions: [
          { q: '¿Cómo retiro mis ganancias?', a: "Abre tu cartera desde el menú de perfil, revisa tu saldo, añade un método de pago y solicita un retiro." },
          { q: '¿Cuáles son los calendarios de pago?', a: "Los pagos siguen un calendario regular; el plazo exacto depende de tu proveedor y país." },
          { q: '¿Cómo actualizo mi método de pago?', a: "En la cartera, actualiza o confirma tu método de pago y guarda — los retiros siguientes lo usan automáticamente." },
          { q: '¿Por qué fue rechazado mi pago?', a: "Consulta primero con tu banco, prueba otra tarjeta o método; si sigue fallando, contacta al soporte con el número de pedido." },
        ],
      },
      {
        id: 'affiliate',
        icon: 'fa-bullhorn',
        title: 'Programa de Afiliados',
        desc: 'Gana comisiones promocionando creadores y su contenido.',
        paragraphs: [
          'Cualquier persona con cuenta Atelnyo puede unirse al programa de afiliados. Comparte tus enlaces únicos de cursos, música o productos — cuando alguien compra con tu enlace, ganas una comisión.',
          'Es una forma simple de que blogs, comunidades y fans apoyen a los creadores que aman mientras ganan algo a cambio.',
        ],
        guides: [
          {
            title: 'Empieza a ganar en 3 pasos',
            steps: [
              'Abre la página de Afiliados y activa — un solo toque.',
              'Copia tu enlace único desde cualquier página de curso o producto.',
              'Compártelo en tu blog, redes o newsletter y mira las referencias aparecer en el panel.',
            ],
          },
        ],
        links: [
          { label: 'Programa de afiliados', path: '/affiliate', icon: 'fa-bullhorn' },
          { label: 'Descubrir ofertas', path: '/affiliate/discover', icon: 'fa-compass' },
        ],
        questions: [
          { q: '¿Cómo me uno al programa de afiliados?', a: "Abre la página de Afiliados y activa el programa — un solo toque, gratis con cualquier cuenta." },
          { q: '¿Cuánta comisión gano?', a: "Ganas un porcentaje de cada venta hecha con tu enlace; la tasa actual se muestra en la página de Afiliados." },
          { q: '¿Cuándo se envían los pagos de afiliados?', a: "Los pagos de afiliados siguen el mismo calendario que los pagos a creadores, una vez superado el mínimo." },
          { q: '¿Dónde encuentro mis enlaces de afiliado?', a: "Copia tu enlace único desde cualquier página de curso o producto — cada clic a través de él se te atribuye." },
        ],
      },
      {
        id: 'account',
        icon: 'fa-user-gear',
        title: 'Cuenta y Seguridad',
        desc: 'Contraseñas, privacidad, autenticación de dos factores y eliminación de cuenta.',
        paragraphs: [
          'La configuración de tu cuenta controla todo: email, contraseña, privacidad, notificaciones y métodos de inicio de sesión conectados.',
          'La seguridad va en serio — activa la autenticación de dos factores para la máxima protección de tu contenido y ganancias.',
        ],
        guides: [
          {
            title: 'Actualiza tus credenciales',
            steps: [
              'Abre Configuración desde el menú de perfil.',
              'Usa Cambiar contraseña o Cambiar email y confirma con tu contraseña actual.',
              'Revisa tu bandeja para el mensaje de confirmación y finaliza el cambio.',
            ],
          },
          {
            title: 'Protege tu cuenta',
            steps: [
              'Activa la autenticación de dos factores en Configuración → Seguridad.',
              'Revisa las sesiones activas y cierra dispositivos que no reconozcas.',
              'Nunca compartas tu contraseña ni tus códigos — el equipo de Atelnyo jamás los pedirá.',
            ],
          },
        ],
        links: [
          { label: 'Centro de Confianza', path: '/trust', icon: 'fa-shield-halved' },
          { label: 'Centro legal', path: '/legal', icon: 'fa-scale-balanced' },
        ],
        questions: [
          { q: '¿Cómo cambio mi contraseña o email?', a: "Configuración → Cambiar contraseña / email, confirma con tu contraseña actual y valida con el email de confirmación que enviamos." },
          { q: '¿Cómo gestiono mi privacidad?', a: "Configuración → Privacidad: notificaciones, visibilidad y preferencias de datos en un solo lugar." },
          { q: '¿Cómo elimino mi cuenta?', a: "Configuración → Eliminar cuenta; la eliminación es definitiva tras el período de confirmación, y tu contenido público desaparece con ella." },
          { q: '¿Cómo activo la autenticación de dos factores?', a: "Configuración → Seguridad → activa la 2FA; nunca compartas tus códigos — el equipo de Atelnyo jamás los pedirá." },
        ],
      },
      {
        id: 'tiktok',
        icon: 'fa-share-nodes',
        title: 'Integración TikTok',
        desc: 'Conecta tu cuenta de TikTok y publica tus videos de Atelnyo directamente en TikTok desde el Creator Studio.',
        paragraphs: [
          'Los creadores pueden vincular una sola cuenta de TikTok a Atelnyo. Una vez conectada, los videos de tu motor de medios pueden publicarse directamente en TikTok sin salir del estudio: el progreso, el estado y el enlace final de TikTok vuelven a la misma pestaña Medios → TikTok.',
          'Hasta que TikTok apruebe la auditoría de la plataforma, las publicaciones salen en privado (solo tú las ves en TikTok). La publicación pública se desbloquea automáticamente cuando se aprueba la auditoría.',
        ],
        guides: [
          {
            title: 'Conectar tu cuenta de TikTok',
            steps: [
              'Abre Creator Studio → Medios → TikTok.',
              'Pulsa «Conectar tu cuenta de TikTok»: se abre una ventana de consentimiento de TikTok.',
              'Aprueba los permisos; la ventana se cierra y tu cuenta aparece en la tarjeta.',
              'Tu enlace de TikTok se añade automáticamente a tu perfil público; al desconectar, se elimina.',
            ],
          },
          {
            title: 'Publicar un video',
            steps: [
              'En la misma pestaña de TikTok, pulsa «Nuevo post de TikTok».',
              'Elige un video de tu biblioteca de medios: el botón de IA puede generar el título y los hashtags.',
              'Elige quién puede ver la publicación y confirma.',
              'TikTok procesa el video; la insignia de estado se actualiza hasta que se publique con su enlace de TikTok.',
            ],
          },
        ],
        links: [
          { label: 'Creator Studio', path: '/sheet/studio?section=media&mediaTab=tiktok', icon: 'fa-palette' },
        ],
        questions: [
          { q: '¿Puedo conectar más de una cuenta de TikTok?', a: 'Por ahora, una cuenta de TikTok por creador de Atelnyo: desconecta y vuelve a conectar para cambiar de cuenta.' },
          { q: '¿Por qué mi post de TikTok es privado?', a: 'Hasta que TikTok complete la auditoría de la plataforma, todas las publicaciones por API salen en privado (solo tú). Cuando la auditoría se apruebe, la publicación pública se desbloquea.' },
          { q: '¿Puedo eliminar o editar un post de TikTok desde Atelnyo?', a: 'No: la API de TikTok no permite editar ni eliminar publicaciones ya publicadas. Gestiónalas en la propia aplicación de TikTok.' },
        ],
      },
      {
        id: 'community',
        icon: 'fa-people-group',
        title: 'Comunidad y Confianza',
        desc: 'Reseñas, seguir, reportar — y mantener Atelnyo seguro para todos.',
        paragraphs: [
          'Atelnyo se basa en la confianza entre estudiantes y creadores. Las reseñas, los feeds de seguidores y la verificación de creadores ayudan a todos a encontrar contenido de calidad — y las herramientas de reporte mantienen fuera a los malos actores.',
          'Sé amable, sé honesto y reporta todo lo que rompa las reglas. Nuestro equipo revisa cada reporte.',
        ],
        guides: [
          {
            title: 'Funda tu comunidad',
            steps: [
              'Publica algo primero — un curso, un producto o una pista. Fundar está reservado a creadores con contenido en la plataforma.',
              'En Explore, abre el chip Comunidades y pulsa "Fundar una Comunidad".',
              'Elige nombre, categoría y forma de unirse: abierto a todos, con aprobación o solo por invitación.',
              'Te conviertes en fundador — añade normas, fija anuncios y modera desde la página de la comunidad.',
              'En comunidades con aprobación, las solicitudes esperan en Creator Studio → Comunidades hasta que las apruebes o rechaces.',
            ],
          },
          {
            title: 'Reseñas que ayudan',
            steps: [
              'Tras completar un curso o comprar un producto, deja una valoración honesta y unas palabras.',
              'Menciona para quién es mejor el contenido — ayuda a otros estudiantes a decidir.',
              'Las reseñas están ligadas a compras reales, no se pueden falsificar.',
            ],
          },
          {
            title: 'Reporta un problema',
            steps: [
              'Usa el enlace de reporte en cualquier perfil, curso, pista o producto.',
              'Dinos qué pasa — cuantos más detalles, más rápido podemos actuar.',
              'Los problemas graves también pueden ir directo al soporte por email.',
            ],
          },
        ],
        links: [
          { label: 'Centro de Confianza', path: '/trust', icon: 'fa-shield-halved' },
          { label: 'Accesibilidad', path: '/accessibility', icon: 'fa-universal-access' },
        ],
        questions: [
          { q: '¿Quién puede fundar una comunidad?', a: "Creadores con al menos un curso, producto o música publicada — el botón aparece en Explore en cuanto tienes contenido en la plataforma." },
          { q: '¿Cómo funcionan las reseñas?', a: "Las reseñas están ligadas a compras reales, así que no se pueden falsificar — deja una opinión honesta y concreta tras completar un curso o comprar." },
          { q: '¿Cómo reporto contenido inapropiado?', a: "Usa el enlace Reportar en cualquier perfil, curso, pista o producto, describiendo el problema con el mayor detalle posible." },
          { q: '¿Qué pasa después de reportar algo?', a: "Nuestro equipo revisa cada reporte y actúa según las normas; los casos graves van directo al soporte y pueden terminar en suspensión o eliminación." },
          { q: '¿Cómo funcionan las insignias verificadas?', a: "Las insignias verificadas se otorgan tras verificar la identidad del creador — una señal de confianza de que la persona es real." },
        ],
      },
      {
        id: 'troubleshooting',
        icon: 'fa-screwdriver-wrench',
        title: 'Solución de Problemas',
        desc: 'Arreglos rápidos para problemas de carga, reproducción y pagos.',
        paragraphs: [
          'La mayoría de problemas tienen una solución rápida. Sigue estos pasos antes de contactar al soporte — resuelven la mayoría de los casos en menos de dos minutos.',
        ],
        guides: [
          {
            title: 'La app no carga',
            steps: [
              'Consulta la página de estado para ver si Atelnyo tiene un incidente.',
              'Recarga la página con una recarga forzada (Ctrl/Cmd + Shift + R).',
              'Borra la caché del navegador o prueba una ventana privada.',
              'En móvil, actualiza la app a la última versión.',
            ],
          },
          {
            title: 'El audio o video no se reproduce',
            steps: [
              'Revisa tu conexión a internet y prueba otra red si es posible.',
              'Asegúrate de que la pestaña no esté silenciada y el volumen subido.',
              'Cierra sesión y vuelve a entrar — una sesión expirada puede bloquear la reproducción.',
              '¿Sigue fallando? Envíanos el enlace de la pista o curso y tu dispositivo.',
            ],
          },
        ],
        links: [
          { label: 'Estado del sistema', path: '/status', icon: 'fa-signal' },
          { label: 'Desarrolladores', path: '/developers', icon: 'fa-code' },
          { label: 'Contactar soporte', path: '/contact', icon: 'fa-headset' },
        ],
        questions: [
          { q: '¿Por qué la app va lenta?', a: "Revisa la página de Estado por incidentes, haz una recarga forzada (Ctrl/Cmd + Shift + R) o prueba una ventana privada." },
          { q: '¿Por qué mi audio no se reproduce?', a: "Revisa tu conexión y el volumen de la pestaña, luego cierra y vuelve a iniciar sesión — una sesión expirada bloquea la reproducción." },
          { q: '¿Por qué falló mi pago?', a: "Consulta con tu banco, prueba otra tarjeta o método, y contacta al soporte con el número de pedido para una solución rápida." },
          { q: '¿Cómo borro la caché de la app?', a: "Borra la caché del navegador o prueba una ventana privada; en móvil, actualiza la app a la última versión." },
        ],
      },
    ],

    faqTitle: 'Preguntas Frecuentes',
    contactNav: 'Contacto',
    contactTitle: '¿No encontraste lo que buscabas?',
    contactDesc: 'Nuestro equipo de soporte está listo para ayudarte.',
    contactBtn: 'Contactar Soporte',
    contactAlt: 'O contáctanos por email en',
    contactEmail: 'support@atelnyo.site',

    relatedTitle: 'Páginas Relacionadas',
    relatedItems: [
      { label: 'Sobre Atelnyo', path: '/about', icon: 'fa-circle-info' },
      { label: 'Centro de Confianza', path: '/trust', icon: 'fa-shield-halved' },
      { label: 'FAQ', path: '/faq', icon: 'fa-circle-question' },
      { label: 'Legal', path: '/legal', icon: 'fa-scale-balanced' },
      { label: 'Accesibilidad', path: '/accessibility', icon: 'fa-universal-access' },
      { label: 'Estado del sistema', path: '/status', icon: 'fa-signal' },
      { label: 'Desarrolladores', path: '/developers', icon: 'fa-code' },
      { label: 'Temas', path: '/themes', icon: 'fa-palette' },
      { label: 'Verificar certificado', path: '/verify', icon: 'fa-certificate' },
      { label: 'Programa de afiliados', path: '/affiliate', icon: 'fa-bullhorn' },
    ],
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ *//* eslint-disable react/prop-types -- the codebase defines no PropTypes anywhere; lang/market come from the router in App.jsx */

/* ── Search-term highlighting ──
   Splits text on the active search terms and wraps matches in <mark>.
   Longest terms first so phrases win over their individual words;
   regex-escaped; case-insensitive; only for non-trivial queries. */
function highlightTerms(text, terms) {
  if (!terms || !terms.length || !text) { return text; }
  const escaped = terms
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  let re;
  let isMatch;
  try {
    re = new RegExp(`(${escaped})`, 'gi');
    // Stateless tester: a global regex's lastIndex would make repeated
    // .test() calls skip matches. With a capture group, split() parts
    // are either a full alternative match or plain text in between.
    isMatch = new RegExp(`^(?:${escaped})$`, 'i');
  } catch {
    return text;
  }
  return text.split(re).map((part, i) => (
    // eslint-disable-next-line react/no-array-index-key -- split parts are derived fresh each render and never reorder
    part && isMatch.test(part) ? <mark key={i}>{part}</mark> : part
  ));
}
export default function HelpPage({ lang = 'en', market = '', topic: topicProp = '' }) {
  const navigate = useNavigate();
  const params = useParams();
  // /help/:topic route param (App.jsx renders <HelpPage /> without the prop).
  const topic = topicProp || params.topic || '';
  const t = PAGE[lang] || PAGE.en;
  const seo = SEO[lang] || SEO.en;
  // Per-locale canonical + hreflang alternates (same pattern as AboutPage).
  const locale = market ? `${lang}-${market}` : '';

  /* ── Deep-link aliases: friendly /help/<slug> URLs → section anchors ── */
  const TOPIC_ALIASES = {
    'getting-started': 'getting-started',
    courses: 'courses',
    music: 'music',
    marketplace: 'marketplace',
    explore: 'explore',
    discover: 'explore',
    jobs: 'explore',
    events: 'explore',
    creator: 'creator',
    profile: 'profile',
    wallet: 'wallet',
    billing: 'wallet',
    payouts: 'wallet',
    affiliate: 'affiliate',
    account: 'account',
    security: 'account',
    community: 'community',
    trust: 'community',
    troubleshooting: 'troubleshooting',
    faq: 'faq',
    contact: 'contact',
    support: 'contact',
    related: 'related',
  };

  // Search initializes from ?q= so /help?q=... (Google SearchAction
  // target) lands directly on pre-filtered results.
  const [search, setSearch] = useState(() => {
    try { return new URLSearchParams(window.location.search).get('q') || ''; } catch { return ''; }
  });
  const [faqs, setFaqs] = useState([]);
  const [faqLoading, setFaqLoading] = useState(true);
  const [faqError, setFaqError] = useState('');
  const [openFaq, setOpenFaq] = useState(null);
  const [openSectionFaq, setOpenSectionFaq] = useState(null);
  const [activeId, setActiveId] = useState('');
  const [tocOpen, setTocOpen] = useState(false);
  const [showTopBtn, setShowTopBtn] = useState(false);

  /* ── Popular searches: featured FAQ questions first, then top ones ──
     Mirrors the SSR suggestion list so users and crawlers see the same
     entry points into the ?q= search flow. */
  const popularSearches = [];
  {
    const seen = new Set();
    const ordered = [...faqs].sort(
      (a, b) => Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured)),
    );
    for (const f of ordered) {
      const question = (f.question || '').trim();
      const key = question.toLowerCase();
      if (question && !seen.has(key)) {
        seen.add(key);
        popularSearches.push(question);
      }
      if (popularSearches.length >= 4) { break; }
    }
  }

  const handlePopularClick = (question) => {
    setSearch(question);
    const match = faqs.find((f) => (f.question || '').trim() === question);
    setOpenFaq(match ? match.id : null);
  };

  /* ── Load FAQ ── */
  useEffect(() => {
    let cancelled = false;
    async function fetchFaq() {
      try {
        const res = await fetch(`${API_URL}platform-faqs/public/`);
        if (!res.ok) { throw new Error('Failed'); }
        const data = await res.json();
        if (!cancelled) {
          const allItems = (Array.isArray(data) ? data : []).flatMap((cat) =>
            (cat.items || []).map((item) => ({ ...item, category: cat.name })),
          );
          setFaqs(allItems);
          setFaqLoading(false);
        }
      } catch {
        if (!cancelled) {
          setFaqError(t.faqLoadError);
          setFaqLoading(false);
        }
      }
    }
    fetchFaq();
    return () => { cancelled = true; };
  }, [lang, t.faqLoadError]);

  /* ── Anchor table of contents ── */
  const toc = [
    { id: 'topics', title: t.topicsIndex },
    ...t.sections.map((s) => ({ id: s.id, title: s.title })),
    { id: 'faq', title: t.faqTitle },
    { id: 'contact', title: t.contactNav },
    { id: 'related', title: t.relatedTitle },
  ];

  /* ── Deep link: /help/<topic> or #hash scroll on mount ── */
  useEffect(() => {
    const hash = (window.location.hash || '').replace(/^#/, '').toLowerCase();
    // /help/<topic> wins over #hash; hashes may use aliases too (e.g. #billing).
    const fromTopic = topic ? TOPIC_ALIASES[topic.toLowerCase()] : null;
    const fromHash = hash ? (TOPIC_ALIASES[hash] ?? hash) : null;
    const target = fromTopic || fromHash || '';
    if (!target) { return undefined; }
    const timer = setTimeout(() => {
      const el = document.getElementById(target);
      if (el) {
        el.scrollIntoView({ block: 'start' });
        setActiveId(target);
      }
    }, 200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic]);

  /* ── Scroll-spy: highlight the TOC chip of the section in view ── */
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') { return undefined; }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { setActiveId(entry.target.id); }
      });
    }, { rootMargin: '-96px 0px -65% 0px', threshold: 0 });
    toc.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) { observer.observe(el); }
    });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  /* ── Show "back to top" button only after scrolling past the hero ── */
  useEffect(() => {
    const onScroll = () => { setShowTopBtn(window.scrollY > 600); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── Keep ?q= in the URL in sync with the search box ──
     Typing updates the URL (replaceState — no history spam) so any
     search is shareable/bookmarkable; clearing removes ?q=. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if ((params.get('q') || '') === search) { return; }
    if (search) { params.set('q', search); } else { params.delete('q'); }
    const qs = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
  }, [search]);

  /* ── Back/forward: re-read ?q= so the box matches the restored URL ── */
  useEffect(() => {
    const onPop = () => {
      const q = new URLSearchParams(window.location.search).get('q') || '';
      setSearch((prev) => (prev === q ? prev : q));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const jumpTo = (id) => {
    setActiveId(id);
    setTocOpen(false);
    const el = document.getElementById(id);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    if (window.history && window.history.replaceState) {
      const qs = search ? `?q=${encodeURIComponent(search)}` : '';
      window.history.replaceState(null, '', `${window.location.pathname}${qs}#${id}`);
    }
  };

  const jumpTop = () => {
    setActiveId('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (window.history && window.history.replaceState) {
      const qs = search ? `?q=${encodeURIComponent(search)}` : '';
      window.history.replaceState(null, '', `${window.location.pathname}${qs}`);
    }
  };

  /* ── Search filter (sections: title, desc, paragraphs, guides, questions, links) ── */
  const q = search.toLowerCase().trim();
  // Highlight terms: the full phrase first (if >= 2 chars — a single
  // letter would mark every occurrence), then individual words (>=2 chars).
  const highlightTermsList = q
    ? [...(q.length >= 2 ? [search.trim()] : []), ...q.split(/\s+/).filter((w) => w.length >= 2)]
    : [];
  const filteredSections = (q ? t.sections : t.sections).map((s) => {
    if (!q) { return s; }
    const hit = (str) => str.toLowerCase().includes(q);
    const matchSelf = hit(s.title) || hit(s.desc)
      || s.paragraphs.some(hit)
      || s.guides.some((g) => hit(g.title) || g.steps.some(hit))
      || s.questions.some((qa) => hit(qa.q) || hit(qa.a))
      || s.links.some((l) => hit(l.label));
    if (!matchSelf) { return null; }
    return {
      ...s,
      guides: s.guides.filter((g) => hit(g.title) || g.steps.some(hit)),
      questions: s.questions.filter((qa) => hit(qa.q) || hit(qa.a)),
    };
  }).filter(Boolean);

  const filteredFaqs = q
    ? faqs.filter((f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q))
    : faqs;

  /* ── Chip that navigates to a route (#-prefixed paths jump to anchors) ──
     Real <a href> keeps the links crawlable; onClick intercepts for SPA nav. */
  const renderChip = (item) => {
    const isAnchor = item.path.startsWith('#');
    return (
      <a
        key={item.path}
        href={item.path}
        className="help-chip"
        onClick={(e) => {
          e.preventDefault();
          if (isAnchor) { jumpTo(item.path.slice(1)); } else { navigate(item.path); }
        }}
      >
        <i className={`fas ${item.icon}`} />
        {item.label}
      </a>
    );
  };

  const activeTocTitle = toc.find((x) => x.id === activeId)?.title || toc[0]?.title || '';

  return (
    <div>
      <SEOHead
        title={seo.title}
        description={seo.description}
        url="/help"
        type="website"
        // Search-result URLs (?q=...) are session-specific: keep them
        // out of the index so only the canonical /help surfaces.
        noindex={Boolean(search)}
        lang={lang}
        locale={locale}
        breadcrumbs={[
          { label: 'Home', url: '/' },
          { label: 'Help Center', url: '/help' },
        ]}
        schema={faqs.length > 0 ? faqPageSchema(faqs) : undefined}
      />

      {/* ── Hero ── */}
      <div className="help-hero">
        <h1 className="help-hero-title">
          <i className="fas fa-life-ring" />
          {t.heroTitle}
        </h1>
        <p className="help-hero-sub">{t.heroSubtitle}</p>
      </div>

      <div className="help-shell">
        {/* ── Search ── */}
        <div className="help-search">
          <i className="fas fa-search help-search-icon" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setOpenFaq(null); }}
            placeholder={t.searchPlaceholder}
            className="help-search-input"
            aria-label={t.searchPlaceholder}
          />
          {search && (
            <button
              type="button"
              className="help-search-clear"
              onClick={() => { setSearch(''); setOpenFaq(null); }}
              aria-label={t.clearSearch}
            >
              <i className="fas fa-times" />
            </button>
          )}
        </div>

        {/* ── Popular searches → the ?q= deep-link flow ── */}
        {!search && popularSearches.length > 0 && (
          <div className="help-popular">
            <span className="help-popular-label">
              <i className="fas fa-arrow-trend-up" />
              {t.popularSearches}
            </span>
            {popularSearches.map((question) => (
              <button
                key={question}
                type="button"
                className="help-chip help-popular-chip"
                onClick={() => handlePopularClick(question)}
              >
                {question}
              </button>
            ))}
          </div>
        )}

        {/* ── On this page (anchor navigation) ──
            Desktop: always-visible chip row.
            Mobile: collapsed drawer toggled by the active section name. */}
        <nav className={`help-toc${tocOpen ? ' open' : ''}`} aria-label={t.onThisPage}>
          <button
            type="button"
            className="help-toc-toggle"
            onClick={() => setTocOpen((v) => !v)}
            aria-expanded={tocOpen}
            aria-controls="help-toc-list"
          >
            <i className="fas fa-anchor" />
            <span className="help-toc-current">{activeTocTitle}</span>
            <i className="fas fa-chevron-down" />
          </button>
          <div id="help-toc-list" className="help-toc-row">
            {toc.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`help-toc-chip${activeId === item.id && !q ? ' active' : ''}`}
                aria-current={activeId === item.id && !q ? 'true' : undefined}
                onClick={() => jumpTo(item.id)}
              >
                {item.title}
              </button>
            ))}
          </div>
        </nav>

        {/* ── All topics index (crawlable anchor target) ── */}
        <section id="topics" className="help-section">
          <h2 className="help-section-title" style={{ marginBottom: 10 }}>
            <i className="fas fa-list-ul" style={{ color: 'var(--pink-primary, #d81b60)', marginRight: 8 }} />
            {t.topicsIndex}
          </h2>
          <div className="help-topics-grid">
            {t.sections.map((s) => (
              <a
                key={s.id}
                href={`/help/${s.id}`}
                className="help-topic-card"
                onClick={(e) => { e.preventDefault(); jumpTo(s.id); }}
              >
                <i className={`fas ${s.icon}`} />
                <span>{s.title}</span>
              </a>
            ))}
          </div>
        </section>

        {/* ── Topic sections (anchor targets) ── */}
        {filteredSections.map((s) => (
          <section key={s.id} id={s.id} className="help-section">
            <div className="help-section-head">
              <div className="help-section-icon"><i className={`fas ${s.icon}`} /></div>
              <div>
                <h2 className="help-section-title">{s.title}</h2>
                <p className="help-section-desc">{s.desc}</p>
              </div>
            </div>

            {s.paragraphs.map((p) => (
              <p key={p.slice(0, 40)} className="help-para">{p}</p>
            ))}

            {s.guides.map((g) => (
              <div key={g.title} className="help-guide">
                <div className="help-guide-title">
                  <i className="fas fa-list-check" />
                  {g.title}
                </div>
                <ol className="help-steps">
                  {g.steps.map((st, si) => (
                    <li key={st.slice(0, 40)} className="help-step">
                      <span className="help-step-num">{si + 1}</span>
                      <span>{st}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}

            {s.questions.length > 0 && (
              <>
                <div className="help-mini-label">
                  <i className="fas fa-circle-question" />
                  {t.commonQuestions}
                </div>
                {s.questions.map((item) => {
                  const itemKey = `${s.id}:${item.q}`;
                  const isOpen = openSectionFaq === itemKey;
                  return (
                    <div key={itemKey} className={`help-faq-item${isOpen ? ' open' : ''}`}>
                      <button
                        type="button"
                        className="help-faq-btn"
                        onClick={() => setOpenSectionFaq(isOpen ? null : itemKey)}
                        aria-expanded={isOpen}
                      >
                        <span className="help-faq-question">{highlightTerms(item.q, highlightTermsList)}</span>
                        <i className={`fas fa-chevron-down help-faq-chevron${isOpen ? ' open' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="help-faq-answer">
                          <p>{highlightTerms(item.a, highlightTermsList)}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {s.links.length > 0 && (
              <div className="help-link-row">
                {s.links.map((l) => renderChip(l))}
              </div>
            )}
          </section>
        ))}

        {q && filteredSections.length === 0 && filteredFaqs.length === 0 && (
          <p className="help-empty">
            <i className="fas fa-face-frown" />
            {t.noResults}
          </p>
        )}

        {/* ── FAQ (anchor target) ── */}
        <section id="faq" className="help-section">
          <h2 className="help-section-title help-faq-title-bar">
            <i className="fas fa-circle-question" style={{ color: 'var(--pink-primary, #d81b60)', marginRight: 8 }} />
            {t.faqTitle}
          </h2>
          {faqLoading && (
            <div className="help-empty">
              <i className="fas fa-spinner fa-pulse fa-2x" style={{ color: 'var(--pink-primary, #d81b60)' }} />
            </div>
          )}
          {faqError && !faqLoading && (
            <p className="help-empty" style={{ padding: '1rem 0' }}>{faqError}</p>
          )}
          {!faqLoading && !faqError && filteredFaqs.length === 0 && (
            <p className="help-empty" style={{ padding: '1rem 0' }}>
              {q ? t.faqNoMatch : t.faqEmpty}
            </p>
          )}
          {filteredFaqs.map((faq) => {
            const isOpen = openFaq === faq.id;
            return (
              <div key={faq.id} className={`help-faq-item${isOpen ? ' open' : ''}`}>
                <button
                  type="button"
                  className="help-faq-btn"
                  onClick={() => setOpenFaq(isOpen ? null : faq.id)}
                  aria-expanded={isOpen}
                >
                  {faq.is_featured && <i className="fas fa-star" style={{ color: '#f59e0b', fontSize: '0.65rem' }} />}
                  <span className="help-faq-question">{highlightTerms(faq.question, highlightTermsList)}</span>
                  <i className={`fas fa-chevron-down help-faq-chevron${isOpen ? ' open' : ''}`} />
                </button>
                {isOpen && (
                  <div className="help-faq-answer">
                    <p>{highlightTerms(faq.answer, highlightTermsList)}</p>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* ── Contact CTA (anchor target) ── */}
        <section id="contact" className="help-section">
          <div className="help-contact">
            <h3 className="help-contact-title">{t.contactTitle}</h3>
            <p className="help-contact-desc">{t.contactDesc}</p>
            <button type="button" className="help-contact-btn" onClick={() => navigate('/contact')}>
              <i className="fas fa-envelope" />
              {t.contactBtn}
            </button>
            <p className="help-contact-alt">
              {t.contactAlt} <a href={`mailto:${t.contactEmail}`}>{t.contactEmail}</a>
            </p>
          </div>
        </section>

        {/* ── Related Pages (anchor target) ── */}
        <section id="related" className="help-section">
          <h2 className="help-section-title" style={{ marginBottom: 4 }}>
            <i className="fas fa-link" style={{ color: 'var(--pink-primary, #d81b60)', marginRight: 8 }} />
            {t.relatedTitle}
          </h2>
          <div className="help-related-grid">
            {t.relatedItems.map((item) => (
              <a key={item.path} href={item.path} className="help-chip" onClick={(e) => { e.preventDefault(); navigate(item.path); }}>
                <i className={`fas ${item.icon}`} />
                {item.label}
              </a>
            ))}
          </div>
        </section>
      </div>

      {/* ── Back to top (appears after scrolling past the hero) ── */}
      <button
        type="button"
        className={`help-top-btn${showTopBtn ? ' visible' : ''}`}
        onClick={jumpTop}
        aria-label={t.backToTop}
        title={t.backToTop}
        tabIndex={showTopBtn ? 0 : -1}
      >
        <i className="fas fa-arrow-up" />
      </button>
    </div>
  );
}
