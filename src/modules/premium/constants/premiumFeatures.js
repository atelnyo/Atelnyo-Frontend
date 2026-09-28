/**
 * src/modules/premium/constants/premiumFeatures.js
 *
 * Premium feature definitions — single source of truth for what Premium
 * offers. Used by PremiumPreview to render the feature grid + plan cards.
 *
 * All features are aspirational (Stripe not yet integrated), but users
 * deserve to see what they're getting before checkout is live.
 */

export const PREMIUM_FEATURES = [
  {
    id: 'badge',
    icon: 'fa-crown',
    color: '#f59e0b',
    title: {
      ht: 'Badge Premium',
      en: 'Premium Badge',
      fr: 'Badge Premium',
      es: 'Insignia Premium',
    },
    description: {
      ht: 'Yon bèl badj an lò sou pwofil ou ak tout kat ou pou montre ou se yon manb Premium.',
      en: 'A gold badge on your profile and cards showing you are a Premium member.',
      fr: 'Un badge doré sur votre profil et vos cartes pour montrer que vous êtes membre Premium.',
      es: 'Una insignia dorada en tu perfil y tarjetas que muestra que eres miembro Premium.',
    },
  },
  {
    id: 'recommendation',
    icon: 'fa-chart-line',
    color: '#8b5cf6',
    title: {
      ht: 'Pi Vizib nan Rekòmandasyon',
      en: 'Higher Recommendation Ranking',
      fr: 'Meilleur classement dans les recommandations',
      es: 'Mayor clasificación en recomendaciones',
    },
    description: {
      ht: 'Kontni ou jwenn plis pwa nan algoritm rekòmandasyon an — plis moun wè sa w kreye.',
      en: 'Your content gets a boost in the recommendation algorithm — more people see your work.',
      fr: 'Votre contenu est boosté dans l\'algorithme de recommandation — plus de visibilité.',
      es: 'Tu contenido recibe un impulso en el algoritmo de recomendación — más personas ven tu trabajo.',
    },
  },
  {
    id: 'commission',
    icon: 'fa-percent',
    color: '#10b981',
    title: {
      ht: 'Pi gwo Komisyon Referans',
      en: 'Higher Referral Commission',
      fr: 'Commission de parrainage plus élevée',
      es: 'Comisión de referencia más alta',
    },
    description: {
      ht: '10% komisyon sou premye peman chak moun ou refere — doub pousantaj estanda a.',
      en: '10% commission on first payment of each person you refer — double the standard rate.',
      fr: '10% de commission sur le premier paiement de chaque personne référée — le double du taux standard.',
      es: '10% de comisión en el primer pago de cada persona referida — el doble de la tasa estándar.',
    },
  },
  {
    id: 'analytics',
    icon: 'fa-chart-bar',
    color: '#3b82f6',
    title: {
      ht: 'Analitik Avanse',
      en: 'Advanced Analytics',
      fr: 'Analytiques avancées',
      es: 'Analíticas avanzadas',
    },
    description: {
      ht: 'Statistik detaye sou odyans ou, tandans revni, ak pèfòmans chak kontni.',
      en: 'Detailed audience stats, revenue trends, and per-content performance metrics.',
      fr: 'Statistiques détaillées sur l\'audience, tendances des revenus et performances par contenu.',
      es: 'Estadísticas detalladas de audiencia, tendencias de ingresos y rendimiento por contenido.',
    },
  },
  {
    id: 'support',
    icon: 'fa-headset',
    color: '#ec4899',
    title: {
      ht: 'Sipò Priority',
      en: 'Priority Support',
      fr: 'Support prioritaire',
      es: 'Soporte prioritario',
    },
    description: {
      ht: 'Repons pi rapid nan chak demann — ou pa bezwen tann nan key la.',
      en: 'Faster responses on every request — skip the line.',
      fr: 'Réponses plus rapides à chaque demande — vous ne faites pas la queue.',
      es: 'Respuestas más rápidas en cada solicitud — no esperas en la fila.',
    },
  },
  {
    id: 'storage',
    icon: 'fa-database',
    color: '#06b6d4',
    title: {
      ht: 'Plis Espas Estòk',
      en: 'More Storage',
      fr: 'Plus d\'espace de stockage',
      es: 'Más espacio de almacenamiento',
    },
    description: {
      ht: 'Limit estòk medya pi wo — mete plis videyo, imaj ak fichye san pwoblèm.',
      en: 'Higher media storage limits — upload more videos, images, and files.',
      fr: 'Limites de stockage multimédia plus élevées — téléchargez plus de vidéos, d\'images et de fichiers.',
      es: 'Límites de almacenamiento multimedia más altos — sube más videos, imágenes y archivos.',
    },
  },
];

export const PREMIUM_PLANS = [
  {
    id: 'monthly',
    icon: 'fa-calendar-week',
    price: 4.99,
    currency: 'USD',
    period: {
      ht: '/ mwa',
      en: '/mo',
      fr: '/mois',
      es: '/mes',
    },
    label: {
      ht: 'Mansyèl',
      en: 'Monthly',
      fr: 'Mensuel',
      es: 'Mensual',
    },
    popular: false,
  },
  {
    id: 'quarterly',
    icon: 'fa-calendar-alt',
    price: 11.99,
    currency: 'USD',
    period: {
      ht: '/ 3 mwa',
      en: '/3mo',
      fr: '/3 mois',
      es: '/3 meses',
    },
    label: {
      ht: 'Trimèsyel',
      en: 'Quarterly',
      fr: 'Trimestriel',
      es: 'Trimestral',
    },
    popular: true,
    savings: {
      ht: 'Ekonomize 20%',
      en: 'Save 20%',
      fr: 'Économisez 20%',
      es: 'Ahorra 20%',
    },
  },
  {
    id: 'yearly',
    icon: 'fa-calendar-check',
    price: 39.99,
    currency: 'USD',
    period: {
      ht: '/ ane',
      en: '/yr',
      fr: '/an',
      es: '/año',
    },
    label: {
      ht: 'Anyèl',
      en: 'Yearly',
      fr: 'Annuel',
      es: 'Anual',
    },
    popular: false,
    savings: {
      ht: 'Ekonomize 33%',
      en: 'Save 33%',
      fr: 'Économisez 33%',
      es: 'Ahorra 33%',
    },
  },
  // lifetime plan is ADMIN-ONLY — not available for user purchase.
  // Only admins can grant it via the admin panel.
  /*
  {
    id: 'lifetime',
    icon: 'fa-infinity',
    price: 99.99,
    currency: 'USD',
    period: null,
    label: {
      ht: 'Lavi',
      en: 'Lifetime',
      fr: 'À vie',
      es: 'De por vida',
    },
    popular: false,
    savings: {
      ht: 'Pi bon valè',
      en: 'Best value',
      fr: 'Meilleur rapport qualité-prix',
      es: 'Mejor valor',
    },
  },
  */
];

export const PREMIUM_STATUS = {
  INACTIVE: 'inactive',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
};
