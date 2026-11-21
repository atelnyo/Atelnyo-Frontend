/**
 * src/components/community/communityOnboarding.js
 *
 * Copy + logic for the three moments that decide whether a community
 * feels alive or empty:
 *
 *   1. a visitor deciding to join            → joinPlan()
 *   2. a member who just joined              → welcomeSteps()
 *   3. a member writing their first post     → buildIntroDraft()
 *
 * Everything here is pure so the wording can be tested without a
 * router or a DOM, and so the public page and the Studio preview can
 * quote the exact same sentences.
 */
import { t } from '../../utils/i18n';
import { countWithUnit } from '../../utils/plural';

const RULE_FORMS = {
  ht: { one: 'règ', many: 'règ' },
  en: { one: 'rule', many: 'rules' },
  fr: { one: 'règle', many: 'règles' },
  es: { one: 'regla', many: 'reglas' },
};

export const JOIN_MODES = ['public', 'approval', 'invite'];

/** Unknown/absent modes behave like a public community everywhere else in the app. */
export function normalizeJoinMode(mode) {
  return JOIN_MODES.includes(mode) ? mode : 'public';
}

/**
 * How joining this community works, in the reader's words.
 * ``pending`` is the "I already asked" state, so the copy stops
 * inviting the person to ask again.
 */
export function joinPlan(mode, lang, { pending = false } = {}) {
  const normalized = normalizeJoinMode(mode);

  if (normalized === 'approval') {
    return {
      mode: normalized,
      icon: 'fa-user-clock',
      badge: t(lang, 'Apwobasyon', 'Approval', 'Approbation'),
      short: t(lang, 'Demann yo tann fondatè a apwouve yo.', 'Requests wait for the founder to approve them.', 'Les demandes attendent l’approbation du fondateur.'),
      title: pending
        ? t(lang, 'Demann ou nan men fondatè a', 'Your request is with the founder', 'Votre demande est chez le fondateur')
        : t(lang, 'Antre sou apwobasyon', 'Join by approval', 'Adhésion sur approbation'),
      body: pending
        ? t(
          lang,
          'Ou pa bezwen fè anyen ankò. Fondatè a ap revize demann ou; lè li apwouve w, ou antre otomatikman.',
          'Nothing else to do. The founder is reviewing your request; once approved, you are in automatically.',
          'Rien d’autre à faire. Le fondateur examine votre demande ; une fois approuvée, vous entrez automatiquement.',
        )
        : t(
          lang,
          'Kominote sa a ouvè, men fondatè a vle konnen kiyès k ap antre. Ou voye yon demann epi li reponn.',
          'This community is open, but the founder wants to know who joins. You send a request and they answer.',
          'Cette communauté est ouverte, mais le fondateur veut savoir qui rejoint. Vous envoyez une demande et il répond.',
        ),
      bullets: [
        {
          icon: 'fa-paper-plane',
          text: t(lang, 'Ou voye yon demann ak yon kout mesaj si w vle.', 'You send a request, with a short note if you like.', 'Vous envoyez une demande, avec un court message si vous voulez.'),
        },
        {
          icon: 'fa-eye',
          text: t(lang, 'Pandan w ap tann, ou ka gade tout sa ki piblik.', 'While you wait, you can browse everything that is public.', 'Pendant l’attente, vous pouvez consulter tout ce qui est public.'),
        },
        {
          icon: 'fa-unlock',
          text: t(lang, 'Lè li apwouve, ou jwenn aksè ak pòs, evènman ak fichye yo.', 'Once approved, you get access to posts, events, and files.', 'Une fois approuvé, vous accédez aux publications, événements et fichiers.'),
        },
      ],
      cta: pending
        ? t(lang, 'Demann voye', 'Request sent', 'Demande envoyée')
        : t(lang, 'Mande pou antre', 'Request to join', 'Demander à rejoindre'),
    };
  }

  if (normalized === 'invite') {
    return {
      mode: normalized,
      icon: 'fa-lock',
      badge: t(lang, 'Envitasyon sèlman', 'Invite only', 'Sur invitation'),
      short: t(lang, 'Sèlman moun ki gen yon lyen envitasyon ka antre.', 'Only people with an invitation link can join.', 'Seules les personnes munies d’un lien d’invitation peuvent entrer.'),
      title: t(lang, 'Sou envitasyon', 'Invite only', 'Sur invitation'),
      body: t(
        lang,
        'Kominote sa a pa ouvè a tout moun. Yon manm oswa fondatè a dwe voye w yon lyen envitasyon pèsonèl.',
        'This community is not open to everyone. A member or the founder has to send you a personal invite link.',
        'Cette communauté n’est pas ouverte à tous. Un membre ou le fondateur doit vous envoyer un lien d’invitation personnel.',
      ),
      bullets: [
        {
          icon: 'fa-link',
          text: t(lang, 'Mande yon moun ou konnen nan kominote a pou l pataje lyen an avè w.', 'Ask someone you know in the community to share the link with you.', 'Demandez à une connaissance dans la communauté de partager le lien avec vous.'),
        },
        {
          icon: 'fa-shield-halved',
          text: t(lang, 'Lyen an ouvè aksè a pou kont ou — pa pibliye l.', 'The link opens access for you — do not post it publicly.', 'Le lien ouvre l’accès pour vous — ne le publiez pas.'),
        },
        {
          icon: 'fa-door-open',
          text: t(lang, 'Lè w antre, ou ka gade evènman ak pòs yo tankou tout lòt manm.', 'Once inside, you see events and posts like every other member.', 'Une fois entré, vous voyez les événements et publications comme les autres membres.'),
        },
      ],
      cta: t(lang, 'Envitasyon sèlman', 'Invite only', 'Sur invitation'),
    };
  }

  return {
    mode: 'public',
    icon: 'fa-door-open',
    badge: t(lang, 'Piblik', 'Public', 'Public'),
    short: t(lang, 'Nenpòt moun ka antre touswit.', 'Anyone can join instantly.', 'Tout le monde peut rejoindre immédiatement.'),
    title: t(lang, 'Pòt ouvè', 'Open door', 'Portes ouvertes'),
    body: t(
      lang,
      'Nenpòt moun ki gen yon kont ka antre touswit — pa gen demann, pa gen datant.',
      'Anyone with an account can join right away — no request, no waiting.',
      'Toute personne ayant un compte peut rejoindre immédiatement — sans demande ni attente.',
    ),
    bullets: [
      {
        icon: 'fa-bolt',
        text: t(lang, 'Yon sèl klik epi ou nan kominote a.', 'One click and you are in.', 'Un clic et vous êtes membre.'),
      },
      {
        icon: 'fa-comments',
        text: t(lang, 'Ou ka pibliye, kòmante, ak reponn evènman yo.', 'You can post, comment, and RSVP to events.', 'Vous pouvez publier, commenter et répondre aux événements.'),
      },
      {
        icon: 'fa-right-from-bracket',
        text: t(lang, 'Ou ka kite l nenpòt lè — san pèt done w.', 'You can leave at any time — nothing of yours is lost.', 'Vous pouvez partir à tout moment — rien de vous n’est perdu.'),
      },
    ],
    cta: t(lang, 'Antre kounye a', 'Join now', 'Rejoindre'),
  };
}

/** What a member unlocks. Shown to visitors so the page is not only a wall. */
export function communityUnlocks(lang) {
  return [
    {
      key: 'posts',
      icon: 'fa-comments',
      label: t(lang, 'Pòs ak diskisyon', 'Posts & discussions', 'Publications et discussions'),
      hint: t(lang, 'Poze kesyon, pataje lyen, reponn lòt manm.', 'Ask questions, share links, reply to members.', 'Posez des questions, partagez des liens, répondez aux membres.'),
    },
    {
      key: 'events',
      icon: 'fa-calendar-days',
      label: t(lang, 'Evènman ak RSVP', 'Events & RSVP', 'Événements et RSVP'),
      hint: t(lang, 'Wè dat yo epi rezève plas ou.', 'See the dates and save your spot.', 'Voyez les dates et réservez votre place.'),
    },
    {
      key: 'library',
      icon: 'fa-folder-open',
      label: t(lang, 'Fichye ak kou', 'Files & courses', 'Fichiers et cours'),
      hint: t(lang, 'Telechaje resous fondatè a pataje.', 'Download the resources the founder shares.', 'Téléchargez les ressources partagées par le fondateur.'),
    },
    {
      key: 'announcements',
      icon: 'fa-bullhorn',
      label: t(lang, 'Anons ofisyèl', 'Official announcements', 'Annonces officielles'),
      hint: t(lang, 'Pa rate sa ki enpòtan pou kominote a.', 'Never miss what matters to the community.', 'Ne manquez rien d’important pour la communauté.'),
    },
  ];
}

/**
 * The next upcoming event in a list, or null.
 * Events without a usable start_time are ignored rather than crashing
 * the welcome card on half-filled drafts.
 */
export function nextEvent(events, now = new Date()) {
  const at = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const upcoming = (Array.isArray(events) ? events : [])
    .filter((ev) => {
      if (!ev?.start_time) {
        return false;
      }
      const ts = new Date(ev.start_time).getTime();
      return Number.isFinite(ts) && ts >= at;
    })
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  return upcoming[0] || null;
}

function shortDate(iso, lang) {
  try {
    return new Date(iso).toLocaleDateString(lang === 'ht' ? 'fr-HT' : lang, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * The four (or three) first moves after joining. Each step carries the
 * ``action`` the UI wires up — keeping the wording and the wiring table
 * in one place means a new step cannot be added without an action.
 */
export function welcomeSteps(community, lang, upcoming = null) {
  const rulesCount = Array.isArray(community?.rules) ? community.rules.length : 0;
  const steps = [
    {
      key: 'intro',
      icon: 'fa-hand-sparkles',
      label: t(lang, 'Prezante w', 'Introduce yourself', 'Présentez-vous'),
      hint: t(lang, 'Yon kout pòs: ki moun ou ye, sa w vin chèche.', 'A short post: who you are, what you came for.', 'Un court message : qui vous êtes, ce que vous cherchez.'),
      action: 'intro',
    },
  ];

  if (rulesCount > 0) {
    steps.push({
      key: 'rules',
      icon: 'fa-scroll',
      label: t(lang, 'Li règleman yo', 'Read the rules', 'Lire les règles'),
      hint: t(lang, `${countWithUnit(lang, rulesCount, RULE_FORMS)} — de minit pou evite pwoblèm.`, `${countWithUnit(lang, rulesCount, RULE_FORMS)} — two minutes that save trouble.`, `${countWithUnit(lang, rulesCount, RULE_FORMS)} — deux minutes qui évitent des ennuis.`),
      action: 'rules',
    });
  }

  const next = upcoming || null;
  steps.push({
    key: 'events',
    icon: 'fa-calendar-days',
    label: t(lang, 'Wè evènman yo', 'See the events', 'Voir les événements'),
    hint: next
      ? t(lang, `Pwochen: ${next.title || ''} — ${shortDate(next.start_time, lang)}`, `Next: ${next.title || ''} — ${shortDate(next.start_time, lang)}`, `Prochain : ${next.title || ''} — ${shortDate(next.start_time, lang)}`)
      : t(lang, 'Pa gen anyen ki pwograme — ou ka pwopoze yon rankont.', 'Nothing scheduled yet — you can propose a meetup.', 'Rien de prévu — vous pouvez proposer une rencontre.'),
    action: 'events',
  });

  steps.push({
    key: 'invite',
    icon: 'fa-user-plus',
    label: t(lang, 'Envite yon zanmi', 'Invite a friend', 'Inviter un ami'),
    hint: t(lang, 'Yon kominote grandi ak moun ou konnen.', 'A community grows through people you know.', 'Une communauté grandit avec des gens que vous connaissez.'),
    action: 'invite',
  });

  return steps;
}

function displayName(user) {
  const full = user?.full_name || [user?.first_name, user?.last_name].filter(Boolean).join(' ');
  return (full || user?.username || '').trim();
}

/**
 * A ready-to-edit introduction post. It asks three concrete questions
 * instead of leaving the composer empty — the blank page is the main
 * reason a new member never posts.
 */
export function buildIntroDraft(community, user, lang) {
  const communityName = community?.name || t(lang, 'kominote a', 'this community', 'cette communauté');
  const name = displayName(user);
  const handle = user?.username ? `@${user.username}` : '';

  if (lang === 'en') {
    const who = name ? `${name}${handle && handle !== `@${name}` ? ` (${handle})` : ''}` : 'a new member';
    return [
      'Hi everyone 👋',
      '',
      `I'm ${who} and I just joined ${communityName}. Instead of lurking, here is a quick intro:`,
      '',
      '• What I do:',
      '• What I came here for:',
      '• One question I have:',
    ].join('\n');
  }

  if (lang === 'fr') {
    const who = name ? `${name}${handle && handle !== `@${name}` ? ` (${handle})` : ''}` : 'un nouveau membre';
    return [
      'Bonjour tout le monde 👋',
      '',
      `Je suis ${who} et je viens de rejoindre ${communityName}. Plutôt que de rester en silence, voici une courte présentation :`,
      '',
      '• Ce que je fais :',
      '• Ce que je viens chercher ici :',
      '• Une question que j’ai :',
    ].join('\n');
  }

  const who = name ? `${name}${handle && handle !== `@${name}` ? ` (${handle})` : ''}` : 'yon nouvo manm';
  return [
    'Bonjou tout moun 👋',
    '',
    `Mwen se ${who} e mwen fèk antre nan ${communityName}. Olye m rete an silans, men yon kout prezantasyon:`,
    '',
    '• Sa m fè:',
    '• Sa m vin chèche isit la:',
    '• Yon kesyon m genyen:',
  ].join('\n');
}
