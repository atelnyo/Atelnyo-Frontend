/**
 * src/components/community/ruleTemplates.js
 *
 * One shared library of optional house-rule templates.
 *
 * The creator picks individual rules; nothing here is mandatory and
 * nothing is saved until the community (or the studio editor) is saved.
 * Both the creation modal and the Creator Studio rules editor read this
 * file, so the wording and the ordering cannot drift between surfaces.
 *
 * Every rule has a stable ``key`` (``categoryId:ruleId``) and copy in
 * the three interface languages the project supports (ht / en / fr).
 * User-selected copies become ordinary user content in ``CommunityRule``
 * rows — changing the interface language never rewrites them.
 */

export const RULE_TEMPLATE_CATEGORIES = [
  {
    id: 'respect',
    icon: 'fa-handshake-angle',
    label: { en: 'Respect & behavior', ht: 'Respè ak konpòtman', fr: 'Respect et comportement' },
    rules: [
      {
        id: 'be-respectful',
        title: { en: 'Be respectful', ht: 'Respekte tout moun', fr: 'Soyez respectueux' },
        description: {
          en: 'Treat every member with kindness, even when you disagree with their ideas.',
          ht: 'Trete chak manm ak jantiyès, menm lè w pa dakò ak lide yo.',
          fr: 'Traitez chaque membre avec bienveillance, même lorsque vous n’êtes pas d’accord.',
        },
      },
      {
        id: 'no-harassment',
        title: { en: 'No harassment', ht: 'Pa gen arasman', fr: 'Pas de harcèlement' },
        description: {
          en: 'Do not target, intimidate, or repeatedly contact someone against their wishes.',
          ht: 'Pa vize, entimide, oswa kontakte yon moun repete kont volonte li.',
          fr: 'Ne ciblez pas, n’intimidez pas et ne contactez pas une personne contre son gré.',
        },
      },
      {
        id: 'no-bullying',
        title: { en: 'No bullying', ht: 'Pa gen entimidasyon', fr: 'Pas d’intimidation' },
        description: {
          en: 'Mocking, humiliating, or ganging up on a member is not allowed.',
          ht: 'Pase moun nan betiz, imilye yo, oswa mete plizyè moun sou yon manm pa pèmèt.',
          fr: 'Se moquer, humilier ou s’acharner sur un membre n’est pas autorisé.',
        },
      },
      {
        id: 'no-discrimination',
        title: { en: 'No discrimination', ht: 'Pa gen diskriminasyon', fr: 'Pas de discrimination' },
        description: {
          en: 'No attacks based on race, ethnicity, gender, religion, disability, or origin.',
          ht: 'Pa gen atak sou baz ras, etnisite, sèks, relijyon, andikap, oswa orijin.',
          fr: 'Aucune attaque fondée sur la race, l’origine, le genre, la religion ou le handicap.',
        },
      },
      {
        id: 'no-threats',
        title: { en: 'No threats or personal attacks', ht: 'Pa gen menas oswa atak pèsonèl', fr: 'Pas de menaces ni d’attaques personnelles' },
        description: {
          en: 'Debate the idea, never the person. Threats are reported immediately.',
          ht: 'Debat lide a, pa janm moun nan. Menas yo rapòte touswit.',
          fr: 'Débattez des idées, jamais des personnes. Les menaces sont signalées immédiatement.',
        },
      },
    ],
  },
  {
    id: 'content',
    icon: 'fa-file-lines',
    label: { en: 'Content guidelines', ht: 'Gid pou kontni', fr: 'Règles de contenu' },
    rules: [
      {
        id: 'stay-on-topic',
        title: { en: 'Stay on topic', ht: 'Rete nan sijè a', fr: 'Restez dans le sujet' },
        description: {
          en: 'Share content relevant to this community so the feed stays useful.',
          ht: 'Pataje kontni ki gen rapò ak kominote sa a pou fil la rete itil.',
          fr: 'Partagez du contenu pertinent pour cette communauté afin que le fil reste utile.',
        },
      },
      {
        id: 'relevant-content',
        title: { en: 'Share relevant content', ht: 'Pataje kontni ki gen rapò', fr: 'Partagez du contenu pertinent' },
        description: {
          en: 'Post things members can use here — not unrelated links or off-topic chatter.',
          ht: 'Pibliye bagay manm yo ka sèvi isit — pa lyen san rapò ni pale de lòt bagay.',
          fr: 'Publiez des contenus utiles ici — pas de liens hors sujet ni de conversations sans rapport.',
        },
      },
      {
        id: 'appropriate-content',
        title: { en: 'No inappropriate content', ht: 'Pa gen kontni ki pa apwopriye', fr: 'Pas de contenu inapproprié' },
        description: {
          en: 'No sexual, violent, or otherwise unsafe content where it is not welcome.',
          ht: 'Pa gen kontni seksyèl, vyolan, oswa ki pa an sekirite kote li pa aksepte.',
          fr: 'Aucun contenu sexuel, violent ou dangereux là où il n’est pas accepté.',
        },
      },
      {
        id: 'intellectual-property',
        title: { en: 'Respect intellectual property', ht: 'Respekte pwopriyete entelektyèl', fr: 'Respectez la propriété intellectuelle' },
        description: {
          en: 'Credit creators and do not repost paid or copyrighted work without permission.',
          ht: 'Bay kreyatè kredi epi pa repibliye travay peye oswa ki gen dwadotè san pèmisyon.',
          fr: 'Créditez les créateurs et ne republiez pas de contenu payant ou protégé sans autorisation.',
        },
      },
      {
        id: 'accurate-information',
        title: { en: 'Avoid misleading information', ht: 'Evite enfòmasyon ki twonpe', fr: 'Évitez les informations trompeuses' },
        description: {
          en: 'Check before sharing. Label opinions and correct mistakes when you learn better.',
          ht: 'Verifye anvan w pataje. Make opinyon epi korije erè lè w aprann pi byen.',
          fr: 'Vérifiez avant de partager. Identifiez les opinions et corrigez vos erreurs.',
        },
      },
    ],
  },
  {
    id: 'spam',
    icon: 'fa-bullhorn',
    label: { en: 'Spam & promotion', ht: 'Spam ak pwomosyon', fr: 'Spam et promotion' },
    rules: [
      {
        id: 'no-spam',
        title: { en: 'No spam', ht: 'Pa gen spam', fr: 'Pas de spam' },
        description: {
          en: 'No repeated promotions, mass mentions, or unsolicited direct messages.',
          ht: 'Pa gen pwomosyon repetitif, mansyon an mas, ni mesaj prive san demand.',
          fr: 'Pas de promotions répétées, de mentions massives ni de messages privés non sollicités.',
        },
      },
      {
        id: 'no-fraudulent-offers',
        title: { en: 'No fraudulent offers', ht: 'Pa gen òf magouy', fr: 'Pas d’offres frauduleuses' },
        description: {
          en: 'Do not promise money, prizes, or investments you cannot prove are real.',
          ht: 'Pa pwomèt lajan, prim, oswa envestisman ou pa ka prouve ki reyèl.',
          fr: 'Ne promettez pas d’argent, de prix ou d’investissements dont vous ne pouvez prouver la réalité.',
        },
      },
      {
        id: 'no-repetitive-advertising',
        title: { en: 'No repetitive advertising', ht: 'Pa gen piblisite repetitif', fr: 'Pas de publicité répétitive' },
        description: {
          en: 'One clear promotion is enough. Do not repost the same offer across threads.',
          ht: 'Yon sèl pwomosyon klè sifi. Pa repibliye menm òf la nan plizyè fil.',
          fr: 'Une promotion claire suffit. Ne repostez pas la même offre dans plusieurs fils.',
        },
      },
      {
        id: 'promotion-guidelines',
        title: { en: 'Follow promotional guidelines', ht: 'Swiv gid pwomosyon yo', fr: 'Suivez les règles de promotion' },
        description: {
          en: 'Use the promotion space or day the community provides, and disclose affiliations.',
          ht: 'Sèvi ak espas oswa jou pwomosyon kominote a bay, epi deklare afilyasyon w.',
          fr: 'Utilisez l’espace ou le jour de promotion prévu, et déclarez vos affiliations.',
        },
      },
      {
        id: 'no-misleading-links',
        title: { en: 'No misleading links', ht: 'Pa gen lyen ki twonpe', fr: 'Pas de liens trompeurs' },
        description: {
          en: 'The link must lead where the post says it leads. No cloaking or fake downloads.',
          ht: 'Lyen an dwe mennen kote pòs la di li mennen. Pa gen kache ni telechajman fo.',
          fr: 'Le lien doit mener là où l’annonce l’indique. Pas de masquage ni de faux téléchargements.',
        },
      },
    ],
  },
  {
    id: 'privacy',
    icon: 'fa-shield-halved',
    label: { en: 'Privacy & safety', ht: 'Vi prive ak sekirite', fr: 'Confidentialité et sécurité' },
    rules: [
      {
        id: 'protect-personal-information',
        title: { en: 'Protect personal information', ht: 'Pwoteje enfòmasyon pèsonèl', fr: 'Protégez les informations personnelles' },
        description: {
          en: 'Do not post phone numbers, addresses, IDs, or other private details about anyone.',
          ht: 'Pa pibliye nimewo telefòn, adrès, pyès idantite, oswa lòt detay prive sou pèsonn.',
          fr: 'Ne publiez pas de numéros, d’adresses, de pièces d’identité ou d’autres données privées.',
        },
      },
      {
        id: 'no-private-content-sharing',
        title: { en: 'No unauthorized sharing of private content', ht: 'Pa pataje kontni prive san otorizasyon', fr: 'Pas de partage de contenu privé sans autorisation' },
        description: {
          en: 'Screenshots, DMs, and private files stay private unless everyone involved agrees.',
          ht: 'Captire ekran, mesaj prive, ak fichye prive rete prive sof si tout moun konsène dakò.',
          fr: 'Captures, messages privés et fichiers privés restent privés sans l’accord des personnes concernées.',
        },
      },
      {
        id: 'no-impersonation',
        title: { en: 'No impersonation', ht: 'Pa gen imitasyon idantite', fr: 'Pas d’usurpation d’identité' },
        description: {
          en: 'Do not pretend to be another member, creator, moderator, or brand.',
          ht: 'Pa pretann ou se yon lòt manm, kreyatè, moderatè, oswa mak.',
          fr: 'Ne vous faites pas passer pour un autre membre, créateur, modérateur ou une marque.',
        },
      },
      {
        id: 'report-suspicious-activity',
        title: { en: 'Report suspicious activity', ht: 'Siyale aktivite sispèk', fr: 'Signalez les activités suspectes' },
        description: {
          en: 'Use the report control instead of arguing publicly. Moderators will review it.',
          ht: 'Sèvi ak bouton siyale a olye w diskite an piblik. Moderatè yo ap revize l.',
          fr: 'Utilisez le bouton de signalement plutôt que d’argumenter publiquement. Les modérateurs examineront.',
        },
      },
    ],
  },
  {
    id: 'participation',
    icon: 'fa-people-group',
    label: { en: 'Community participation', ht: 'Patisipasyon nan kominote a', fr: 'Participation communautaire' },
    rules: [
      {
        id: 'respect-members',
        title: { en: 'Respect community members', ht: 'Respekte manm kominote a', fr: 'Respectez les membres' },
        description: {
          en: 'Assume good faith, ask before correcting, and thank people who help.',
          ht: 'Sipoze bon entansyon, mande anvan w korije, epi remèsye moun ki ede.',
          fr: 'Présumez la bonne foi, demandez avant de corriger et remerciez ceux qui aident.',
        },
      },
      {
        id: 'constructive-discussions',
        title: { en: 'Keep discussions constructive', ht: 'Kenbe diskisyon yo konstriktif', fr: 'Gardez des discussions constructives' },
        description: {
          en: 'Add context or a next step. “That is wrong” without a reason helps no one.',
          ht: 'Ajoute kontèks oswa yon pwochen etap. “Sa a mal” san rezon pa ede pèsonn.',
          fr: 'Ajoutez du contexte ou une prochaine étape. « C’est faux » sans raison n’aide personne.',
        },
      },
      {
        id: 'avoid-unnecessary-conflicts',
        title: { en: 'Avoid unnecessary conflicts', ht: 'Evite konfli ki pa nesesè', fr: 'Évitez les conflits inutiles' },
        description: {
          en: 'Take heated disagreements to a private message or ask a moderator to step in.',
          ht: 'Mete dezakò cho nan yon mesaj prive oswa mande yon moderatè antre.',
          fr: 'Déplacez les désaccords houleux en message privé ou demandez l’intervention d’un modérateur.',
        },
      },
      {
        id: 'follow-moderator-instructions',
        title: { en: 'Follow moderator instructions', ht: 'Swiv enstriksyon moderatè yo', fr: 'Suivez les instructions des modérateurs' },
        description: {
          en: 'If a moderator asks you to stop or move a thread, do it. Appeal privately, not in the feed.',
          ht: 'Si yon moderatè mande w sispann oswa deplase yon fil, fè l. Fè apèl an prive, pa nan fil la.',
          fr: 'Si un modérateur vous demande d’arrêter ou de déplacer un fil, faites-le. Contestez en privé.',
        },
      },
      {
        id: 'contribute-positively',
        title: { en: 'Contribute positively', ht: 'Kontribye pozitivman', fr: 'Contribuez positivement' },
        description: {
          en: 'Answer one question, welcome one new member, or share one useful resource.',
          ht: 'Reponn yon kesyon, akeyi yon nouvo manm, oswa pataje yon resous itil.',
          fr: 'Répondez à une question, accueillez un nouveau membre ou partagez une ressource utile.',
        },
      },
    ],
  },
  {
    id: 'commerce',
    icon: 'fa-bag-shopping',
    label: { en: 'Buying & selling', ht: 'Achte ak vann', fr: 'Achat et vente' },
    rules: [
      {
        id: 'no-fraudulent-transactions',
        title: { en: 'No fraudulent transactions', ht: 'Pa gen tranzaksyon magouy', fr: 'Pas de transactions frauduleuses' },
        description: {
          en: 'Only offer goods or services you can actually deliver, at the stated terms.',
          ht: 'Sèlman ofri byen oswa sèvis ou ka vrèman delivre, ak kondisyon w di yo.',
          fr: 'Ne proposez que des biens ou services que vous pouvez réellement fournir, aux conditions annoncées.',
        },
      },
      {
        id: 'accurate-product-information',
        title: { en: 'Provide accurate product information', ht: 'Bay enfòmasyon egzak sou pwodwi a', fr: 'Fournissez des informations exactes' },
        description: {
          en: 'Describe condition, price, delivery, and refund terms honestly.',
          ht: 'Dekri kondisyon, pri, livrezon, ak kondisyon ranbousman an onètman.',
          fr: 'Décrivez honnêtement l’état, le prix, la livraison et les conditions de remboursement.',
        },
      },
      {
        id: 'honor-agreed-terms',
        title: { en: 'Respect agreed transaction terms', ht: 'Respekte kondisyon tranzaksyon yo', fr: 'Respectez les conditions convenues' },
        description: {
          en: 'Once both sides agree, do not change the price or terms unilaterally.',
          ht: 'Yon fwa tou de bò dakò, pa chanje pri a oswa kondisyon yo poukont ou.',
          fr: 'Une fois l’accord conclu, ne modifiez pas unilatéralement le prix ou les conditions.',
        },
      },
      {
        id: 'no-trade-impersonation',
        title: { en: 'Do not impersonate sellers or buyers', ht: 'Pa imite vandè oswa achtè', fr: 'N’usurpez pas l’identité d’un vendeur ou acheteur' },
        description: {
          en: 'Do not pose as a trusted seller or use another person’s business identity.',
          ht: 'Pa pran pòz yon vandè yo fè konfyans oswa idantite biznis yon lòt moun.',
          fr: 'Ne vous faites pas passer pour un vendeur de confiance ni pour l’entreprise d’autrui.',
        },
      },
    ],
  },
];

const SUPPORTED = new Set(['ht', 'en', 'fr']);

/** Normalizes a language code to the three supported interface languages. */
export function ruleTemplateLang(lang) {
  const code = String(lang || '').trim().toLowerCase().split('-')[0];
  return SUPPORTED.has(code) ? code : 'en';
}

/** Stable key for one template rule. */
export function templateRuleKey(categoryId, ruleId) {
  return `${categoryId}:${ruleId}`;
}

/**
 * Flat, localized view of the library in its canonical order.
 * Keys are stable and unique, so selection survives re-renders.
 */
export function listTemplateRules(lang = 'en') {
  const key = ruleTemplateLang(lang);
  return RULE_TEMPLATE_CATEGORIES.flatMap((category) => (
    category.rules.map((rule) => ({
      key: templateRuleKey(category.id, rule.id),
      categoryId: category.id,
      categoryLabel: category.label[key],
      title: rule.title[key],
      description: rule.description[key],
    }))
  ));
}

/** Selected keys → rule objects, keeping library (not click) order. */
export function rulesFromSelection(selectedKeys, lang = 'en') {
  const selected = selectedKeys instanceof Set ? selectedKeys : new Set(selectedKeys || []);
  return listTemplateRules(lang).filter((rule) => selected.has(rule.key));
}

/** Comparison key used to avoid adding the same rule twice. */
export function normalizeRuleTitle(title) {
  return String(title || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Append-only merge: existing rules keep their position and meaning,
 * incoming duplicates are skipped, and nothing is ever deleted.
 */
export function mergeRuleLists(existing, additions) {
  const next = Array.isArray(existing) ? [...existing] : [];
  const seen = new Set(
    next.map((rule) => normalizeRuleTitle(rule?.title)).filter(Boolean),
  );
  for (const rule of Array.isArray(additions) ? additions : []) {
    const key = normalizeRuleTitle(rule?.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    next.push(rule);
  }
  return next;
}
