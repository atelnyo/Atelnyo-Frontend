/**
 * src/components/AboutPage.jsx
 *
 * Atelnyo Official About Page — Trust & Digital Identity.
 *
 * Public, crawlable, stable URL: /about
 * English is the international/default version (x-default).
 * Localized versions use self-referencing canonical + hreflang.
 */
import React from 'react';
import SEOHead from './shared/SEOHead';

/* ═══════════════════════════════════════════════════════════════════════════
   MULTILINGUAL CONTENT
   ═══════════════════════════════════════════════════════════════════════════ */

const SEO = {
  en: {
    title: 'About Atelnyo — Learn, Create, Share',
    description: 'Atelnyo is an international platform empowering creators, educators, and entrepreneurs with courses, music, products, and business tools. Learn about our mission, vision, and commitment to trust and innovation.',
  },
  ht: {
    title: 'Sou Atelnyo — Aprann, Kreye, Pataje',
    description: 'Atelnyo se yon platfòm entènasyonal ki bay kreyatè, edikatè, ak antreprenè zouti pou kou, mizik, pwodwi, ak biznis. Aprann sou misyon nou, vizyon nou, ak angajman nou pou konfyans ak inovasyon.',
  },
  fr: {
    title: 'À propos d\'Atelnyo — Apprenez, Créez, Partagez',
    description: 'Atelnyo est une plateforme internationale qui autonomise les créateurs, les éducateurs et les entrepreneurs avec des cours, de la musique, des produits et des outils commerciaux.',
  },
  es: {
    title: 'Sobre Atelnyo — Aprende, Crea, Comparte',
    description: 'Atelnyo es una plataforma internacional que empodera a creadores, educadores y emprendedores con cursos, música, productos y herramientas de negocio.',
  },
};

const PAGE = {
  en: {
    heroTitle: 'About Atelnyo',
    heroSubtitle: 'Learn, Create, Share',
    heroDesc: 'Atelnyo is a platform built to empower creators, educators, and entrepreneurs — especially in underserved communities — with the tools, knowledge, and digital infrastructure they need to thrive.',

    /* ── What is Atelnyo ── */
    whatTitle: 'What Is Atelnyo?',
    whatBody: [
      'Atelnyo is an international web platform that brings together education, creative expression, and digital commerce in one integrated ecosystem.',
      'Atelnyo provides online courses, music distribution, product marketplace tools, creator profiles, business pages, and community features — all designed to work together as a cohesive digital identity and growth platform.',
      'The platform is built with Haitian Creole and multilingual communities at its core, while remaining open and accessible to creators worldwide.',
    ],

    /* ── Why Atelnyo Exists ── */
    whyTitle: 'Why Atelnyo Exists',
    whyBody: [
      'Many talented creators, educators, and entrepreneurs in underserved regions lack access to modern digital infrastructure. They have knowledge, creativity, and ambition — but no integrated platform that understands their context.',
      'Atelnyo exists to close that gap. We believe that a creator in Port-au-Prince deserves the same quality of digital tools, global reach, and professional presence as anyone anywhere in the world.',
      'Atelnyo is not a charity project. It is a real platform, built with real technology, serving real people with real needs.',
    ],

    /* ── Vision ── */
    visionTitle: 'Our Vision',
    visionBody: 'A world where every creator, educator, and entrepreneur — regardless of geography, language, or background — has equal access to the digital tools and global audience they need to build something meaningful.',

    /* ── Mission ── */
    missionTitle: 'Our Mission',
    missionBody: 'To build and maintain an integrated, multilingual, and trustworthy platform that empowers creators and communities to educate, create, share, and grow — sustainably and on their own terms.',

    /* ── Who We Serve ── */
    serveTitle: 'Who We Serve',
    serveItems: [
      { heading: 'Creators & Artists', text: 'Musicians, designers, writers, photographers, and multimedia creators who want to distribute their work, build an audience, and earn revenue.' },
      { heading: 'Educators & Course Builders', text: 'Teachers, trainers, and knowledge-holders who want to create structured online courses and share their expertise with learners worldwide.' },
      { heading: 'Entrepreneurs & Small Businesses', text: 'Small business owners and aspiring entrepreneurs who need digital storefronts, product listings, and commerce infrastructure.' },
      { heading: 'Learners & Communities', text: 'Students, self-learners, and community members who want to access courses, discover talent, and engage with a trusted learning ecosystem.' },
    ],

    /* ── Ecosystem sections ── */
    ecosystemTitle: 'The Creator Ecosystem',
    coursesTitle: 'Education & Courses',
    coursesBody: 'Atelnyo supports structured online courses with modules, lessons, assessments, and progress tracking. Creators can build courses in any language, with rich content blocks including vocabulary, speaking practice, conversations, quizzes, and projects. The platform supports both internal hosting and external course links.',

    musicTitle: 'Music & Talent',
    musicBody: 'Atelnyo provides music distribution, streaming, and discovery features. Artists can upload tracks, organize albums, build talent profiles, and reach listeners across the platform. The music system supports multiple genres, languages, and licensing models.',

    productsTitle: 'Products & Business',
    productsBody: 'Atelnyo offers product marketplace tools, business profiles, and commerce infrastructure. Creators and entrepreneurs can list digital and physical products, manage orders, and build a professional online business presence.',

    techTitle: 'Technology & Innovation',
    techBody: 'Atelnyo is built on modern web technologies with a focus on performance, accessibility, and internationalization. The platform uses a React-based frontend, a Django REST API backend, PostgreSQL and MySQL databases, and deploys on Cloudflare and Render. Key technical features include real-time learning spaces, the DEIE evolution intelligence engine, multi-language support, and comprehensive SEO architecture.',

    /* ── Trust & Safety ── */
    trustTitle: 'Trust, Safety & Responsible Platform Practices',
    trustItems: [
      'Atelnyo is committed to maintaining a safe, respectful, and trustworthy environment for all users.',
      'Content moderation policies ensure that harmful, illegal, or deceptive content is identified and addressed.',
      'Creator and user accounts are protected by authentication systems, rate limiting, and abuse prevention mechanisms.',
      'The platform maintains clear content policies, acceptable use guidelines, and a transparent appeals process.',
      'E-commerce transactions are secured through established payment processors with standard buyer protections.',
    ],

    /* ── Privacy ── */
    privacyTitle: 'Privacy & Data Principles',
    privacyItems: [
      'Atelnyo collects only the data necessary to operate the platform and provide its services.',
      'User data is not sold to third parties.',
      'The platform provides account management tools including data access, export, and deletion.',
      'Atelnyo implements industry-standard security measures including encryption, authentication, and access controls.',
      'Detailed privacy practices are documented in the publicly available Privacy Policy.',
    ],

    /* ── Accessibility ── */
    accessibilityTitle: 'Accessibility',
    accessibilityBody: 'Atelnyo is designed to be accessible to users with diverse abilities. The platform follows web accessibility best practices including semantic HTML, keyboard navigation, screen reader support, adequate color contrast, and responsive design for mobile and assistive devices. We continuously work to improve accessibility across the platform.',

    /* ── Languages ── */
    languagesTitle: 'Supported Languages',
    languagesBody: 'Atelnyo is a multilingual platform. The primary supported languages are:',
    languagesList: [
      { lang: 'Haitian Creole', code: 'ht', note: 'Primary language' },
      { lang: 'English', code: 'en', note: 'International default' },
      { lang: 'French', code: 'fr', note: 'Supported' },
      { lang: 'Spanish', code: 'es', note: 'Supported' },
    ],
    languagesNote: 'Atelnyo\'s architecture is designed to support additional languages as the platform grows. Course creators can create content in any language.',

    /* ── Long-term Vision ── */
    longTermTitle: 'Long-Term Vision',
    longTermBody: [
      'Atelnyo is being built for the long term. Our goal is not short-term growth at the expense of quality or trust.',
      'We aim to build infrastructure that serves communities for years — educational content that remains relevant, creator tools that evolve with needs, and a platform identity that earns and maintains trust.',
      'We believe in sustainable growth, transparent practices, and building technology that serves people — not the other way around.',
    ],

    /* ── Footer CTA ── */
    ctaTitle: 'Want to Learn More?',
    ctaBody: 'Explore Atelnyo, or reach out to us directly.',
    ctaExplore: 'Explore Atelnyo',
    ctaContact: 'Contact Us',
  },

  ht: {
    heroTitle: 'Sou Atelnyo',
    heroSubtitle: 'Aprann, Kreye, Pataje',
    heroDesc: 'Atelnyo se yon platfòm ki bati pou bay kreyatè, edikatè, ak antreprenè — espesyalman nan kominote ki pa gen ase resous — zouti, konesans, ak enfrastrikti digital yo bezwen pou reyisi.',

    whatTitle: 'Kisa Atelnyo Ye?',
    whatBody: [
      'Atelnyo se yon platfòm entènasyonal ki ranmase edikasyon, ekspresyon kreyatif, ak komès digital nan yon ekosistem entegre.',
      'Atelnyo bay kou sou entènèt, distribye mizik, zouti makèt pwodwi, pwofil kreyatè, paj biznis, ak karaktè kominote — tout fèt pou travay ansanm kòm yon idantite digital ak platfòm kwasans kohéren.',
      'Platfòm la bati ak kreyòl ayisyen ak kominote multiling nan sans li, pandan li rete ouvè ak aksesib pou kreyatè nan tout mond lan.',
    ],

    whyTitle: 'Poukisa Atelnyo Egziste',
    whyBody: [
      'Anpil kreyatè, edikatè, ak antreprenè talan nan kominote ki pa gen ase resous manke aksesib nan enfrastrikti digital modèn. Yo gen konesans, kreyativite, ak ambiyon — men yo pa gen yon platfòm entegre ki konprann kontèks yo.',
      'Atelnyo egziste pou fème ke jan de fanton. N kwè ke yon kreyatè nan Pòtoprens merit menm kalite zouti digital, rive mondyal, ak prezans pwofesyonèl ak tout lòt moun nan mond lan.',
      'Atelnyo pa se yon pwojè charite. Li se yon platfòm reyèl, bati ak teknoloji reyèl, ki sèvi moun reyèl ak bezwen reyèl.',
    ],

    visionTitle: 'Vizyon Nou',
    visionBody: 'Yon mond kote chak kreyatè, edikatè, ak antreprenè — kèlkeswa jeyografi, lang, oswa background — gen akses egal nan zouti digital ak odyans mondyal yo bezwen pou bati yon bagay siyifikatif.',

    missionTitle: 'Misyon Nou',
    missionBody: 'Bati ak kenbe yon platfòm entegre, multiling, ak ki gen konfyans ki bay kreyatè ak kominote kapasite pou edike, kreye, pataje, ak grandi — ak yon fason ki dire ak sou tèm yo.',

    serveTitle: 'Kiyès Nou Sèvi',
    serveItems: [
      { heading: 'Kreyatè & Atis', text: 'Mizisyen, desinatè, ekri, fotograF, ak kreyatè multimedia ki vle distribye travay yo, bati yon odyans, ak gaène revni.' },
      { heading: 'Edikatè & Konstraktè Kou', text: 'PrOFèsè, fòmatè, ak moun ki gen konesans ki vle kreye kou sou entènèt estriktire epi pataje ekspètiz yo ak elèv nan tout mond lan.' },
      { heading: 'Antreprenè & Ti Biznis', text: 'Pwopriyè ti biznis ak antreprenè ki bezwen boutik digital, lis pwodwi, ak enfrastrikti komès.' },
      { heading: 'Elèv & Kominote', text: 'Elèv, moun k ap aprann poukont yo, ak manm kominote ki vle jwenn kou, dekouvri talan, ak angaje ak yon ekosistem aprantaj ki gen konfyans.' },
    ],

    ecosystemTitle: 'Ekosistem Kreyatè',
    coursesTitle: 'Edikasyon & Kou',
    coursesBody: 'Atelnyo sipòte kou sou entènèt estriktire ak modil, leson, evalyasyon, ak swiv pwogrè. Kreyatè ka bati kou nan nenpòt lang, ak blòk kontni rich ki enkli vokal, pratik pale, konvèsasyon, tès, ak pwojè.',

    musicTitle: 'Mizik & Talan',
    musicBody: 'Atelnyo bay distribye mizik, streamin, ak karakteristik dekouvèt. Atis ka chaje travay, òganize albòm, bati pwofil talan, ak rive jwenn tèt nan tout platfòm la.',

    productsTitle: 'Pwodwi & Biznis',
    productsBody: 'Atelnyo ofri zouti makèt pwodwi, pwofil biznis, ak enfrastrikti komès. Kreyatè ak antreprenè ka lis pwodwi digital ak fizik, jere lòd, ak bati yon prezans biznis digital pwofesyonèl.',

    techTitle: 'Teknoloji & Inovasyon',
    techBody: 'Atelnyo bati sou teknoloji entènèt modèn ak yon fokis sou pèfòmans, aksesibilite, ak entènasyonalizasyon. Platfòm la itilize yon frontend React, yon backend Django REST API, baz done PostgreSQL ak MySQL, ak deploche sou Cloudflare ak Render.',

    trustTitle: 'Konfyans, Sekirite & Pratik Platfòm Responsab',
    trustItems: [
      'Atelnyo angaje pou kenbe yon anviwònman ki an sekirite, ki respekte, ak ki gen konfyans pou tout itilizatè.',
      'Politik moderasyon kontni asire ke kontni ki mal, ilegal, oswa desevwa idantifye ak trete.',
      'Kompt kreyatè ak itilizatè pwoteje pa sistèm otentifikasyon, limit to, ak mekanis prevansyon abi.',
      'Platfòm la gen politik kontni klè, gid itilizasyon akseptab, ak yon pwosesis apèl ki transparent.',
      'Tranzaksyon e-commerce sekirize atravè pwosèsè paman standard ak pwoteksyon achete ki estanda.',
    ],

    privacyTitle: 'Vie Prive & Prensip Done',
    privacyItems: [
      'Atelnyo ranmase sèlman done ki nesesè pou opere platfòm la ak bay sèvis yo.',
      'Done itilizatè pa vann nan twazyèm pati.',
      'Platfòm la bay zouti jesyon kompt ki enkli aksesib done, ekspòtasyon, ak efase.',
      'Atelnyo implemente mezi sekirite ki estanda nan endistri ki enkli chifreman, otentifikasyon, ak kontwòl aksesib.',
      'Pratik vie prive detaye dokimante nan Politik Vie Prive ki disponib piblikman.',
    ],

    accessibilityTitle: 'Aksesibilite',
    accessibilityBody: 'Atelnyo fèt pou òt bezwen itilizatè ak divès kapasite. Platfòm la swiv pi bon pratik aksesibilite entènèt ki enkli HTML semantik, navigasyon ak kle, sipò lecteur ekran, kontras koulè adekwat, ak desen reponn pou mobil ak aparèl asistif.',

    languagesTitle: 'Lang ki Sipòte',
    languagesBody: 'Atelnyo se yon platfòm multiling. Lang primè ki sipòte yo se:',
    languagesList: [
      { lang: 'Kreyòl Ayisyen', code: 'ht', note: 'Lang primè' },
      { lang: 'English', code: 'en', note: 'Defò entènasyonal' },
      { lang: 'Français', code: 'fr', note: 'Sipòte' },
      { lang: 'Español', code: 'es', note: 'Sipòte' },
    ],
    languagesNote: 'Achitekti Atelnyo fèt pou sipòte plis lang pandan platfòm la grandi. Kreyatè kou ka kreye kontni nan nenpòt lang.',

    longTermTitle: 'Vizyon Lontèm',
    longTermBody: [
      'Atelnyo ap bati pou lontèm. Objektif nou pa se kwasans kout tèm nan depans kalite oswa konfyans.',
      'N vle bati enfrastrikti ki sèvi kominote pou ane — kontni edikasyon ki rete enpòtan, zouti kreyatè ki evolye ak bezwen, ak idantite platfòm ki genyen epi kenbe konfyans.',
      'N kwè nan kwasans ki dire, pratik ki transparent, ak bati teknoloji ki sèvi moun — pa lòt fason.',
    ],

    ctaTitle: 'Ou vle aprann plis?',
    ctaBody: 'Eksplore Atelnyo, oswa kontakte nou dirèkteman.',
    ctaExplore: 'Eksplore Atelnyo',
    ctaContact: 'Kontakte Nou',
  },

  fr: {
    heroTitle: 'À propos d\'Atelnyo',
    heroSubtitle: 'Apprenez, Créez, Partagez',
    heroDesc: 'Atelnyo est une plateforme construite pour autonomiser les créateurs, éducateurs et entrepreneurs — en particulier dans les communautés mal desservies — avec les outils, les connaissances et l\'infrastructure numérique dont ils ont besoin pour prospérer.',

    whatTitle: 'Qu\'est-ce qu\'Atelnyo ?',
    whatBody: [
      'Atelnyo est une plateforme web internationale qui réunit l\'éducation, l\'expression créative et le commerce numérique dans un écosystème intégré.',
      'Atelnyo propose des cours en ligne, la distribution musicale, des outils de marketplace, des profils créateurs, des pages entreprise et des fonctionnalités communautaires — le tout conçu pour fonctionner ensemble.',
      'La plateforme est construite avec le créole haïtien et les communautés multilingues au cœur, tout en restant ouverte et accessible aux créateurs du monde entier.',
    ],

    whyTitle: 'Pourquoi Atelnyo existe',
    whyBody: [
      'De nombreux créateurs, éducateurs et entrepreneurs talentueux dans les régions mal desservies n\'ont pas accès à une infrastructure numérique moderne.',
      'Atelnyo existe pour combler ce fossé. Nous croyons qu\'un créateur à Port-au-Prince mérite la même qualité d\'outils numériques, de portée mondiale et de présence professionnelle que n\'importe qui ailleurs dans le monde.',
      'Atelnyo n\'est pas un projet de charité. C\'est une vraie plateforme, construite avec de vraies technologies, servant de vraies personnes.',
    ],

    visionTitle: 'Notre vision',
    visionBody: 'Un monde où chaque créateur, éducateur et entrepreneur — quelle que soit sa géographie, sa langue ou ses origines — a un accès égal aux outils numériques et à l\'audience mondiale dont il a besoin pour construire quelque chose de significatif.',

    missionTitle: 'Notre mission',
    missionBody: 'Construire et maintenir une plateforme intégrée, multilingue et digne de confiance qui autonomise les créateurs et les communautés pour éduquer, créer, partager et croître — durablement et selon leurs propres termes.',

    serveTitle: 'À qui nous servons',
    serveItems: [
      { heading: 'Créateurs & Artistes', text: 'Musiciens, designers, écrivains, photographes et créateurs multimédia qui veulent distribuer leur travail, construire une audience et générer des revenus.' },
      { heading: 'Éducateurs & Créateurs de cours', text: 'Enseignants, formateurs et détenteurs de connaissances qui veulent créer des cours en ligne structurés et partager leur expertise.' },
      { heading: 'Entrepreneurs & Petites entreprises', text: 'Propriétaires de petites entreprises et entrepreneurs en herbe qui ont besoin de boutiques numériques et d\'infrastructure commerciale.' },
      { heading: 'Apprenants & Communautés', text: 'Étudiants et membres de communautés qui veulent accéder aux cours, découvrir des talents et s\'engager avec un écosystème d\'apprentissage de confiance.' },
    ],

    ecosystemTitle: 'L\'écosystème créateur',
    coursesTitle: 'Éducation & Cours',
    coursesBody: 'Atelnyo prend en charge les cours en ligne structurés avec des modules, leçons, évaluations et suivi de progression.',

    musicTitle: 'Musique & Talent',
    musicBody: 'Atelnyo offre la distribution musicale, le streaming et les fonctionnalités de découverte.',

    productsTitle: 'Produits & Entreprise',
    productsBody: 'Atelnyo propose des outils de marketplace, des profils entreprise et une infrastructure commerciale.',

    techTitle: 'Technologie & Innovation',
    techBody: 'Atelnyo est construit sur des technologies web modernes avec un accent sur la performance, l\'accessibilité et l\'internationalisation.',

    trustTitle: 'Confiance, sécurité & pratiques responsables',
    trustItems: [
      'Atelnyo s\'engage à maintenir un environnement sûr, respectueux et digne de confiance.',
      'Les politiques de modération garantissent que le contenu nuisible est identifié et traité.',
      'Les comptes sont protégés par des systèmes d\'authentification et de prévention des abus.',
      'La plateforme maintient des politiques de contenu claires et un processus d\'appel transparent.',
      'Les transactions e-commerce sont sécurisées par des processeurs de paiement établis.',
    ],

    privacyTitle: 'Vie privée & principes de données',
    privacyItems: [
      'Atelnyo ne collecte que les données nécessaires au fonctionnement.',
      'Les données des utilisateurs ne sont pas vendues à des tiers.',
      'La plateforme fournit des outils de gestion de compte incluant l\'accès, l\'exportation et la suppression.',
      'Atelnyo met en œuvre des mesures de sécurité standard.',
      'Des pratiques détaillées sont documentées dans la Politique de confidentialité.',
    ],

    accessibilityTitle: 'Accessibilité',
    accessibilityBody: 'Atelnyo est conçu pour être accessible aux utilisateurs capacités diverses. La plateforme suit les meilleures pratiques d\'accessibilité web.',

    languagesTitle: 'Langues supportées',
    languagesBody: 'Atelnyo est une plateforme multilingue. Les principales langues supportées sont :',
    languagesList: [
      { lang: 'Créole haïtien', code: 'ht', note: 'Langue principale' },
      { lang: 'English', code: 'en', note: 'Défaut international' },
      { lang: 'Français', code: 'fr', note: 'Supporté' },
      { lang: 'Español', code: 'es', note: 'Supporté' },
    ],
    languagesNote: 'L\'architecture d\'Atelnyo est conçue pour supporter des langues supplémentaires à mesure que la plateforme grandit.',

    longTermTitle: 'Vision à long terme',
    longTermBody: [
      'Atelnyo est construit pour durer. Notre objectif n\'est pas la croissance à court terme au détriment de la qualité ou de la confiance.',
      'Nous visons une infrastructure qui sert les communautés pendant des années.',
      'Nous croyons en une croissance durable, des pratiques transparentes et une technologie qui sert les gens.',
    ],

    ctaTitle: 'Vous voulez en savoir plus ?',
    ctaBody: 'Explorez Atelnyo, ou contactez-nous directement.',
    ctaExplore: 'Explorer Atelnyo',
    ctaContact: 'Nous contacter',
  },

  es: {
    heroTitle: 'Sobre Atelnyo',
    heroSubtitle: 'Aprende, Crea, Comparte',
    heroDesc: 'Atelnyo es una plataforma construida para empoderar a creadores, educadores y emprendedores con las herramientas, el conocimiento y la infraestructura digital que necesitan para prosperar.',
    whatTitle: '¿Qué es Atelnyo?', whatBody: ['Atelnyo es una plataforma web internacional que reúne educación, expresión creativa y comercio digital en un ecosystème integrado.','Atelnyo ofrece cursos en línea, distribución musical, herramientas de marketplace, perfiles de creador, páginas de negocio y funciones comunitarias.','La plataforma está construida con el criollo haitiano y las comunidades multilingües en su centro.'],
    whyTitle: 'Por qué existe Atelnyo', whyBody: ['Muchos creadores talentosos en regiones desatendidas carecen de acceso a infraestructura digital moderna.','Atelnyo existe para cerrar esa brecha. Creemos que un creador en Puerto Príncipe merece las mismas herramientas digitales.','Atelnyo no es un proyecto de caridad. Es una plataforma real, construida con tecnología real, sirviendo a personas reales.'],
    visionTitle: 'Nuestra visión', visionBody: 'Un mundo donde cada creador, educador y emprendedor — independientemente de su geografía, idioma u origen — tenga igual acceso a las herramientas digitales y la audiencia global que necesita.',
    missionTitle: 'Nuestra misión', missionBody: 'Construir y mantener una plataforma integrada, multilingüe y confiable que empodere a creadores y comunidades para educar, crear, compartir y crecer.',
    serveTitle: 'A quién servimos', serveItems: [
      { heading: 'Creadores y Artistas', text: 'Músicos, diseñadores, escritores y fotógrafos que quieren distribuir su trabajo.' },
      { heading: 'Educadores', text: 'Profesores y formadores que quieren crear cursos en línea estructurados.' },
      { heading: 'Emprendedores', text: 'Propietarios de pequeños negocios que necesitan infraestructura comercial digital.' },
      { heading: 'Aprendices', text: 'Estudiantes y miembros de la comunidad que quieren acceder a cursos y descubrir talento.' },
    ],
    ecosystemTitle: 'El ecosistema del creador',
    coursesTitle: 'Educación y Cursos', coursesBody: 'Atelnyo soporta cursos en línea estructurados con módulos, lecciones, evaluaciones y seguimiento de progreso.',
    musicTitle: 'Música y Talento', musicBody: 'Atelnyo ofrece distribución musical, streaming y funciones de descubrimiento.',
    productsTitle: 'Productos y Negocio', productsBody: 'Atelnyo ofrece herramientas de marketplace, perfiles de negocio e infraestructura de comercio.',
    techTitle: 'Tecnología e Innovación', techBody: 'Atelnyo está construido con tecnologías web modernas con enfoque en rendimiento, accesibilidad e internacionalización.',
    trustTitle: 'Confianza, seguridad y prácticas responsables', trustItems: ['Atelnyo se compromete a mantener un entorno seguro y respetuoso.','Las políticas de moderación garantizan que el contenido dañino sea identificado.','Las cuentas están protegidas por sistemas de autenticación y prevención de abuso.','Las transacciones de e-commerce están aseguradas por procesadores de pago establecidos.'],
    privacyTitle: 'Privacidad y principios de datos', privacyItems: ['Atelnyo solo recopila los datos necesarios.','Los datos de usuarios no se venden a terceros.','La plataforma proporciona herramientas de gestión de cuenta.','Atelnyo implementa medidas de seguridad estándar.'],
    accessibilityTitle: 'Accesibilidad', accessibilityBody: 'Atelnyo está diseñado para ser accesible a usuarios con diversas capacidades. La plataforma sigue las mejores prácticas de accesibilidad web.',
    languagesTitle: 'Idiomas soportados', languagesBody: 'Atelnyo es una plataforma multilingüe:', languagesList: [{lang:'Criollo haitiano',code:'ht',note:'Idioma principal'},{lang:'English',code:'en',note:'Defecto internacional'},{lang:'Français',code:'fr',note:'Soportado'},{lang:'Español',code:'es',note:'Soportado'}], languagesNote: 'La arquitectura de Atelnyo está diseñada para soportar idiomas adicionales.',
    longTermTitle: 'Visión a largo plazo', longTermBody: ['Atelnyo está construido para durar.','Nuestro objetivo es construir infraestructura que sirva a las comunidades por años.','Creemos en un crecimiento sostenible y prácticas transparentes.'],
    ctaTitle: '¿Quieres saber más?', ctaBody: 'Explora Atelnyo o contáctanos directamente.', ctaExplore: 'Explorar Atelnyo', ctaContact: 'Contáctanos',
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function AboutPage({ lang = 'en', market = '' }) {
  const t = PAGE[lang] || PAGE.en;
  const s = SEO[lang] || SEO.en;
  const locale = market ? `${lang}-${market}` : '';

  return (
    <>
      <SEOHead
        title={s.title}
        description={s.description}
        image="https://atelnyo.site/og-banner-en.svg"
        url="/about"
        type="website"
        lang={lang}
        locale={locale}
        breadcrumbs={[{ label: 'Home', url: '/' }, { label: 'About', url: '/about' }]}
      />

      <main style={styles.main}>

        {/* ── Hero ── */}
        <header style={styles.hero}>
          <h1 style={styles.heroTitle}>{t.heroTitle}</h1>
          <p style={styles.heroSubtitle}>{t.heroSubtitle}</p>
          <p style={styles.heroDesc}>{t.heroDesc}</p>
        </header>

        {/* ── What Is Atelnyo ── */}
        <section style={styles.section} id="what">
          <h2 style={styles.h2}>{t.whatTitle}</h2>
          {t.whatBody.map((p, i) => <p key={i} style={styles.p}>{p}</p>)}
        </section>

        {/* ── Why Atelnyo Exists ── */}
        <section style={styles.section} id="why">
          <h2 style={styles.h2}>{t.whyTitle}</h2>
          {t.whyBody.map((p, i) => <p key={i} style={styles.p}>{p}</p>)}
        </section>

        {/* ── Vision ── */}
        <section style={{...styles.section, ...styles.highlight}} id="vision">
          <h2 style={styles.h2}>{t.visionTitle}</h2>
          <p style={{...styles.p, ...styles.quote}}>{t.visionBody}</p>
        </section>

        {/* ── Mission ── */}
        <section style={{...styles.section, ...styles.highlight}} id="mission">
          <h2 style={styles.h2}>{t.missionTitle}</h2>
          <p style={{...styles.p, ...styles.quote}}>{t.missionBody}</p>
        </section>

        {/* ── Who We Serve ── */}
        <section style={styles.section} id="serve">
          <h2 style={styles.h2}>{t.serveTitle}</h2>
          <div style={styles.grid}>
            {t.serveItems.map((item, i) => (
              <div key={i} style={styles.card}>
                <h3 style={styles.cardH3}>{item.heading}</h3>
                <p style={styles.cardP}>{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Creator Ecosystem ── */}
        <section style={styles.section} id="ecosystem">
          <h2 style={styles.h2}>{t.ecosystemTitle}</h2>

          <div style={styles.ecoBlock}>
            <h3 style={styles.h3}>{t.coursesTitle}</h3>
            <p style={styles.p}>{t.coursesBody}</p>
          </div>

          <div style={styles.ecoBlock}>
            <h3 style={styles.h3}>{t.musicTitle}</h3>
            <p style={styles.p}>{t.musicBody}</p>
          </div>

          <div style={styles.ecoBlock}>
            <h3 style={styles.h3}>{t.productsTitle}</h3>
            <p style={styles.p}>{t.productsBody}</p>
          </div>

          <div style={styles.ecoBlock}>
            <h3 style={styles.h3}>{t.techTitle}</h3>
            <p style={styles.p}>{t.techBody}</p>
          </div>
        </section>

        {/* ── Trust & Safety ── */}
        <section style={styles.section} id="trust">
          <h2 style={styles.h2}>{t.trustTitle}</h2>
          <ul style={styles.ul}>
            {t.trustItems.map((item, i) => <li key={i} style={styles.li}>{item}</li>)}
          </ul>
        </section>

        {/* ── Privacy ── */}
        <section style={styles.section} id="privacy">
          <h2 style={styles.h2}>{t.privacyTitle}</h2>
          <ul style={styles.ul}>
            {t.privacyItems.map((item, i) => <li key={i} style={styles.li}>{item}</li>)}
          </ul>
        </section>

        {/* ── Accessibility ── */}
        <section style={styles.section} id="accessibility">
          <h2 style={styles.h2}>{t.accessibilityTitle}</h2>
          <p style={styles.p}>{t.accessibilityBody}</p>
        </section>

        {/* ── Supported Languages ── */}
        <section style={styles.section} id="languages">
          <h2 style={styles.h2}>{t.languagesTitle}</h2>
          <p style={styles.p}>{t.languagesBody}</p>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>{lang === 'ht' ? 'Lang' : 'Language'}</th>
                <th style={styles.th}>Code</th>
                <th style={styles.th}>{lang === 'ht' ? 'Estati' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {t.languagesList.map((l, i) => (
                <tr key={i} style={i % 2 === 0 ? styles.trEven : styles.trOdd}>
                  <td style={styles.td}>{l.lang}</td>
                  <td style={{...styles.td, fontFamily: 'monospace'}}>{l.code}</td>
                  <td style={styles.td}>{l.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{...styles.p, ...styles.note}}>{t.languagesNote}</p>
        </section>

        {/* ── Long-Term Vision ── */}
        <section style={{...styles.section, ...styles.highlight}} id="long-term">
          <h2 style={styles.h2}>{t.longTermTitle}</h2>
          {t.longTermBody.map((p, i) => <p key={i} style={styles.p}>{p}</p>)}
        </section>

        {/* ── CTA ── */}
        <section style={styles.ctaSection}>
          <h2 style={styles.h2}>{t.ctaTitle}</h2>
          <p style={styles.p}>{t.ctaBody}</p>
          <div style={styles.ctaButtons}>
            <a href="/" style={styles.ctaBtnPrimary}>{t.ctaExplore}</a>
            <a href="mailto:hello@atelnyo.site" style={styles.ctaBtnSecondary}>{t.ctaContact}</a>
          </div>
        </section>

      </main>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════════════════ */

const styles = {
  main: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '2rem 1.5rem 4rem',
    fontFamily: 'var(--font-body, system-ui, sans-serif)',
    color: 'var(--text-primary, #1a1a2e)',
    lineHeight: 1.7,
  },
  hero: {
    textAlign: 'center',
    padding: '3rem 0 2rem',
  },
  heroTitle: {
    fontSize: '2.5rem',
    fontWeight: 700,
    margin: '0 0 0.5rem',
    color: 'var(--text-primary, #1a1a2e)',
  },
  heroSubtitle: {
    fontSize: '1.3rem',
    fontWeight: 500,
    color: 'var(--pink-primary, #d81b60)',
    margin: '0 0 1rem',
  },
  heroDesc: {
    fontSize: '1.1rem',
    color: 'var(--text-secondary, #555)',
    maxWidth: '700px',
    margin: '0 auto',
  },
  section: {
    padding: '2rem 0',
    borderBottom: '1px solid var(--border-color, #e0e0e0)',
  },
  highlight: {
    background: 'var(--surface-secondary, #f8f9fa)',
    margin: '0 -1.5rem',
    padding: '2rem 1.5rem',
    borderRadius: '12px',
  },
  h2: {
    fontSize: '1.6rem',
    fontWeight: 700,
    margin: '0 0 1rem',
    color: 'var(--text-primary, #1a1a2e)',
  },
  h3: {
    fontSize: '1.2rem',
    fontWeight: 600,
    margin: '0 0 0.5rem',
    color: 'var(--text-primary, #1a1a2e)',
  },
  p: {
    fontSize: '1rem',
    margin: '0 0 1rem',
    color: 'var(--text-secondary, #555)',
  },
  quote: {
    fontSize: '1.15rem',
    fontStyle: 'italic',
    borderLeft: '4px solid var(--pink-primary, #d81b60)',
    paddingLeft: '1rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '1.5rem',
    marginTop: '1rem',
  },
  card: {
    background: 'var(--surface-primary, #fff)',
    border: '1px solid var(--border-color, #e0e0e0)',
    borderRadius: '12px',
    padding: '1.5rem',
  },
  cardH3: {
    fontSize: '1.1rem',
    fontWeight: 600,
    margin: '0 0 0.5rem',
    color: 'var(--pink-primary, #d81b60)',
  },
  cardP: {
    fontSize: '0.95rem',
    margin: 0,
    color: 'var(--text-secondary, #555)',
  },
  ecoBlock: {
    marginBottom: '1.5rem',
  },
  ul: {
    paddingLeft: '1.5rem',
    margin: '0.5rem 0',
  },
  li: {
    fontSize: '1rem',
    marginBottom: '0.5rem',
    color: 'var(--text-secondary, #555)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    margin: '1rem 0',
    fontSize: '0.95rem',
  },
  th: {
    textAlign: 'left',
    padding: '0.75rem',
    borderBottom: '2px solid var(--border-color, #e0e0e0)',
    fontWeight: 600,
    color: 'var(--text-primary, #1a1a2e)',
  },
  td: {
    padding: '0.75rem',
    borderBottom: '1px solid var(--border-color, #e0e0e0)',
  },
  trEven: { background: 'transparent' },
  trOdd: { background: 'var(--surface-secondary, #f8f9fa)' },
  note: {
    fontSize: '0.9rem',
    fontStyle: 'italic',
    marginTop: '0.5rem',
  },
  ctaSection: {
    textAlign: 'center',
    padding: '3rem 0 1rem',
  },
  ctaButtons: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: '1rem',
  },
  ctaBtnPrimary: {
    display: 'inline-block',
    padding: '12px 32px',
    background: 'var(--pink-primary, #d81b60)',
    color: '#fff',
    borderRadius: '50px',
    fontWeight: 600,
    textDecoration: 'none',
    fontSize: '1rem',
  },
  ctaBtnSecondary: {
    display: 'inline-block',
    padding: '12px 32px',
    background: 'transparent',
    color: 'var(--pink-primary, #d81b60)',
    border: '2px solid var(--pink-primary, #d81b60)',
    borderRadius: '50px',
    fontWeight: 600,
    textDecoration: 'none',
    fontSize: '1rem',
  },
};
