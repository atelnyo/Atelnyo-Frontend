import { inlineText } from '../../../utils/inlineI18n';
/**
 * src/components/studio/editor/communityTemplates.js
 *
 * Starter templates for a brand-new community. Applying one fills the
 * parts a founder would otherwise stare at an empty form for: the
 * description, category, hashtags, join mode, and a first set of house
 * rules. The name always stays the founder's own — a template should
 * never name the community for them.
 *
 * Copy is written in both editor languages (ht/en) so switching the
 * Studio language does not leave half the template in English.
 */

export const COMMUNITY_TEMPLATES = [
  {
    id: 'discussion',
    icon: 'fa-comments',
    title: { en: 'Open discussion', ht: 'Diskisyon ouvè' },
    blurb: {
      en: 'A public room for questions, ideas, and links around one topic.',
      ht: 'Yon espas piblik pou kesyon, lide ak lyen alantou yon sèl sijè.',
    },
    category: 'other',
    categoryLabel: { en: 'Other', ht: 'Lòt' },
    join_mode: 'public',
    tags: ['#diskisyon', '#kominote', '#kesyon'],
    description: {
      en: 'A friendly place to ask questions, share ideas, and keep the conversation going. Everyone is welcome — introduce yourself and join in.',
      ht: 'Yon kote zanmitay pou poze kesyon, pataje lide, epi kontinye konvèsasyon an. Tout moun byenveni — prezante w epi patisipe.',
    },
    rules: [
      {
        title: { en: 'Be respectful', ht: 'Respekte tout moun' },
        description: {
          en: 'Disagree with ideas, never attack people. No harassment or hate speech.',
          ht: 'Pa dakò ak lide, pa atake moun. Pa gen arasman ni diskou rayisman.',
        },
      },
      {
        title: { en: 'Stay on topic', ht: 'Rete nan sijè a' },
        description: {
          en: 'Keep posts relevant to the community topic so the feed stays useful.',
          ht: 'Kenbe pòs yo nan sijè kominote a pou fil la rete itil.',
        },
      },
      {
        title: { en: 'No spam', ht: 'Pa gen spam' },
        description: {
          en: 'No repeated promotions, misleading links, or unsolicited DMs.',
          ht: 'Pa gen pwomosyon repetitif, lyen twonpe, ni mesaj prive san demand.',
        },
      },
    ],
  },
  {
    id: 'learning',
    icon: 'fa-graduation-cap',
    title: { en: 'Learning cohort', ht: 'Kowòt aprantisaj' },
    blurb: {
      en: 'A reviewed group that learns together, shares resources, and asks for help.',
      ht: 'Yon gwoup ki aprann ansanm, pataje resous, epi mande èd.',
    },
    category: 'education',
    categoryLabel: { en: 'Education', ht: 'Edikasyon' },
    join_mode: 'approval',
    tags: ['#aprann', '#kou', '#resous'],
    description: {
      en: 'We learn together, week by week. Share what you are studying, ask when you are stuck, and help the person one step behind you.',
      ht: 'Nou aprann ansanm, semèn pa semèn. Pataje sa w ap etidye, poze kesyon lè w bloke, epi ede moun ki dèyè w yon pa.',
    },
    rules: [
      {
        title: { en: 'Help others learn', ht: 'Ede lòt moun aprann' },
        description: {
          en: 'Explain clearly and meet members at their level. No shaming beginners.',
          ht: 'Eksplike klèman epi rankontre manm nan nivo yo. Pa wont debutan.',
        },
      },
      {
        title: { en: 'Give constructive feedback', ht: 'Bay fidbak konstriktif' },
        description: {
          en: 'Critique the work, not the person. Suggest a concrete next step.',
          ht: 'Kritike travay la, pa moun nan. Sijere yon pwochen etap konkè.',
        },
      },
      {
        title: { en: 'Share resources in the right place', ht: 'Pataje resous nan bon kote' },
        description: {
          en: 'Put files and links in the Files tab so they stay easy to find.',
          ht: 'Mete fichye ak lyen nan onglet Fichye pou yo rete fasil pou jwenn.',
        },
      },
    ],
  },
  {
    id: 'creator',
    icon: 'fa-star',
    title: { en: 'Creator fan club', ht: 'Fan club kreyatè' },
    blurb: {
      en: 'A public home for your audience: updates, early drops, and behind the scenes.',
      ht: 'Yon kay piblik pou odyans ou: nouvèl, lansman bonè, ak dèyè sèn.',
    },
    category: 'music',
    categoryLabel: { en: 'Music', ht: 'Mizik' },
    join_mode: 'public',
    tags: ['#fanclub', '#mizik', '#dèyè-sèn'],
    description: {
      en: 'The official fan space. Get updates first, see what happens behind the scenes, and meet other fans of the work.',
      ht: 'Espas ofisyèl fan yo. Jwenn nouvèl an premye, wè sa k ap pase dèyè sèn, epi rankontre lòt fan travay la.',
    },
    rules: [
      {
        title: { en: 'Keep it kind', ht: 'Rete janti' },
        description: {
          en: 'Support the work and each other. No drama, bullying, or personal attacks.',
          ht: 'Sipòte travay la ak lòt moun. Pa gen dram, entimidasyon, ni atak pèsonèl.',
        },
      },
      {
        title: { en: 'No leaks', ht: 'Pa gen fwit' },
        description: {
          en: 'Do not repost private links, unreleased files, or paid content.',
          ht: 'Pa repibliye lyen prive, fichye ki poko soti, oswa kontni peye.',
        },
      },
      {
        title: { en: 'Credit the creator', ht: 'Bay kreyatè a kredi' },
        description: {
          en: 'When you share fan art or clips, credit the creator and link the original.',
          ht: 'Lè w pataje fan art oswa klip, bay kreyatè a kredi epi mete lyen orijinal la.',
        },
      },
    ],
  },
  {
    id: 'project',
    icon: 'fa-diagram-project',
    title: { en: 'Project team', ht: 'Ekip pwojè' },
    blurb: {
      en: 'A private invite-only workspace for a team shipping one project together.',
      ht: 'Yon espas prive sou envitasyon pou yon ekip k ap mennen yon pwojè.',
    },
    category: 'business',
    categoryLabel: { en: 'Business', ht: 'Biznis' },
    join_mode: 'invite',
    tags: ['#pwojè', '#ekip', '#travay'],
    description: {
      en: 'A focused space for the people building this project. Share decisions, files, and blockers here instead of losing them in chat.',
      ht: 'Yon espas konsantre pou moun k ap bati pwojè a. Pataje desizyon, fichye ak blokaj isit olye pou yo pèdi nan chat.',
    },
    rules: [
      {
        title: { en: 'Decide in the open', ht: 'Deside aklè' },
        description: {
          en: 'Post decisions and changes here so everyone has the same context.',
          ht: 'Pibliye desizyon ak chanjman isit pou tout moun gen menm kontèks.',
        },
      },
      {
        title: { en: 'Share context, not just tasks', ht: 'Pataje kontèks, pa sèlman travay' },
        description: {
          en: 'Explain why something matters, not only what needs doing.',
          ht: 'Eksplike poukisa yon bagay enpòtan, pa sèlman sa ki dwe fèt.',
        },
      },
      {
        title: { en: 'Keep client work private', ht: 'Kenbe travay kliyan an prive' },
        description: {
          en: 'Do not forward client files or credentials outside this community.',
          ht: 'Pa voye fichye kliyan oswa idantifyan andeyò kominote sa a.',
        },
      },
    ],
  },
];

/**
 * Turns a template into the subset of editor form fields it owns.
 * `lang` picks the localized copy; unknown languages fall back to English.
 */
export function buildTemplateDraft(template, lang = 'en') {
  if (!template) {
    return null;
  }
  const key = lang === 'ht' ? 'ht' : inlineText(lang, 'en');
  return {
    description: template.description[key] || template.description.en,
    category: template.category,
    join_mode: template.join_mode,
    hashtags: (template.tags || []).join(' '),
    rules: (template.rules || []).map((rule) => ({
      title: rule.title[key] || rule.title.en,
      description: rule.description[key] || rule.description.en,
    })),
  };
}
