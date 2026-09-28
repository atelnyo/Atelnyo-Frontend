/**
 * src/components/FAQ.jsx
 *
 * Refactored — glassmorphism accordion with smooth animations,
 * full i18n, dark-mode support. All styles live in the
 * FAQ Accordion CSS block in index.css.
 */
import React, { useCallback, useState } from 'react';

// Platform-wide FALLBACK FAQ — shown only when a course has no
// creator-managed FAQ rows (see CourseFaqSection). Course-specific FAQ
// lives in the backend (CourseFAQ model) and is editable in the Creator
// Studio FAQ tab.
const FAQS_BY_LANG = {
  ht: [
    { q: 'Kijan mwen enskri nan yon kou?', a: 'Klike sou bouton Enskri sou paj kou a. Ou bezwen yon kont Atelnyo (gratis pou kreye). Lè ou enskri, kou a parèt nan seksyon Mwen epi ou ka kòmanse imedyatman.' },
    { q: 'Èske m ka aprann nan pwòp vitès mwen?', a: 'Wi! Kou yo otonòm — pa gen sesyon live, pa gen orè. Ou ka kòmanse, kanpe, epi retounen nenpòt lè.' },
    { q: 'Èske m bezwen yon òdinatè?', a: 'Non. Tout kou yo mache sou telefòn, tablèt, ak òdinatè. Gen kèk egzèsis (tankou ekri kòd) ki pi fasil sou òdinatè, men li pa obligatwa.' },
    { q: 'Èske m ap resevwa yon sètifika?', a: 'Wi! Lè ou fini tout modil yo (tout blòk kontni), ou resevwa yon sètifika konplèsyon ou ka pataje sou LinkedIn ak rezo sosyal.' },
    { q: 'Konbyen tan m ap bezwen?', a: 'Sa depann de kou a — anviwon 6-12 èdtan an total. Pa gen limit tan: ou ka pran 1 semèn oswa 1 mwa.' },
    { q: 'Èske kou yo gratis?', a: 'Gen kou 100% gratis ak kou ki gen ti pri. Pri a parèt klè sou paj kou a anvan ou enskri.' },
    { q: 'Kijan mwen jwenn èd si m gen pwoblèm?', a: 'Ou ka kontakte sipò a nan aplikasyon an, epi chak kou gen yon seksyon FAQ ak èd. Kominote Atelnyo a la pou w tou.' },
  ],
  en: [
    { q: 'How do I enroll in a course?', a: 'Click the Enroll button on the course page. You need a free Atelnyo account. Once enrolled, the course appears under Me and you can start right away.' },
    { q: 'Can I learn at my own pace?', a: 'Yes! Courses are self-paced — no live sessions, no schedule. You can start, pause, and come back anytime.' },
    { q: 'Do I need a computer?', a: 'No. All courses work on phone, tablet, and computer. Some exercises (like writing code) are easier on a computer, but it is not required.' },
    { q: 'Will I receive a certificate?', a: 'Yes! Once you complete all modules (all content blocks), you receive a completion certificate you can share on LinkedIn and social media.' },
    { q: 'How long will it take?', a: 'It depends on the course — about 6-12 hours total. There is no time limit: you can take 1 week or 1 month.' },
    { q: 'Are the courses free?', a: 'There are 100% free courses and paid courses. The price is clearly shown on the course page before you enroll.' },
    { q: 'How do I get help if I have a problem?', a: 'You can contact support from the app, and every course has an FAQ and help section. The Atelnyo community is also there for you.' },
  ],
  es: [
    { q: '¿Cómo me inscribo en un curso?', a: 'Haz clic en el botón Inscribirse en la página del curso. Necesitas una cuenta gratuita de Atelnyo. Una vez inscrito, el curso aparece en la sección Mis cursos y puedes empezar de inmediato.' },
    { q: '¿Puedo aprender a mi propio ritmo?', a: '¡Sí! Los cursos son autodidactas — sin sesiones en vivo, sin horario. Puedes empezar, pausar y volver cuando quieras.' },
    { q: '¿Necesito una computadora?', a: 'No. Todos los cursos funcionan en teléfono, tableta y computadora. Algunos ejercicios (como escribir código) son más fáciles en computadora, pero no es obligatorio.' },
    { q: '¿Recibiré un certificado?', a: '¡Sí! Al completar todos los módulos (todos los bloques de contenido), recibes un certificado de finalización que puedes compartir en LinkedIn y redes sociales.' },
    { q: '¿Cuánto tiempo necesito?', a: 'Depende del curso — unas 6-12 horas en total. No hay límite de tiempo.' },
    { q: '¿Los cursos son gratuitos?', a: 'Hay cursos 100% gratuitos y cursos de pago. El precio se muestra claramente en la página del curso.' },
    { q: '¿Cómo obtengo ayuda si tengo un problema?', a: 'Puedes contactar al soporte desde la aplicación y cada curso tiene una sección de ayuda y FAQ.' },
  ],
  fr: [
    { q: 'Comment m\'inscrire à un cours ?', a: 'Cliquez sur le bouton S\'inscrire sur la page du cours. Vous avez besoin d\'un compte Atelnyo gratuit. Une fois inscrit, le cours apparaît dans la section Mes cours et vous pouvez commencer immédiatement.' },
    { q: 'Puis-je apprendre à mon rythme ?', a: 'Oui ! Les cours sont autonomes — pas de sessions en direct, pas d\'horaire. Vous pouvez commencer, faire une pause et revenir à tout moment.' },
    { q: 'Ai-je besoin d\'un ordinateur ?', a: 'Non. Tous les cours fonctionnent sur téléphone, tablette et ordinateur. Certains exercices (comme écrire du code) sont plus faciles sur ordinateur, mais ce n\'est pas obligatoire.' },
    { q: 'Vais-je recevoir un certificat ?', a: 'Oui ! Une fois tous les modules terminés (tous les blocs de contenu), vous recevez un certificat de fin de parcours à partager sur LinkedIn et les réseaux sociaux.' },
    { q: 'Combien de temps cela prend-il ?', a: 'Cela dépend du cours — environ 6 à 12 heures au total. Il n\'y a pas de limite de temps.' },
    { q: 'Les cours sont-ils gratuits ?', a: 'Il y a des cours 100 % gratuits et des cours payants. Le prix est clairement affiché sur la page du cours.' },
    { q: 'Comment obtenir de l\'aide si j\'ai un problème ?', a: 'Vous pouvez contacter le support depuis l\'application et chaque cours a une section d\'aide et de FAQ.' },
  ],
};

export default function FAQ({ lang, translations, courseId }) {
  const t = translations?.[lang] || translations?.ht || {};
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = FAQS_BY_LANG[lang] || FAQS_BY_LANG.ht;
  const titleSuffix = courseId ? ` ${t.faq_course_suffix || ''}` : '';

  const toggleFaq = useCallback((index) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  }, []);

  return (
    <div className="faq-accordion">
      <h2 className="faq-accordion-title">
        <i className="fas fa-question-circle" aria-hidden="true" />
        {t.faq_title || 'FAQ'}{titleSuffix}
      </h2>

      <div className="faq-accordion-list">
        {faqs.map((faq, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={index}
              className={`faq-accordion-item ${isOpen ? 'faq-accordion-item--open' : ''}`}
            >
              <button
                type="button"
                className="faq-accordion-trigger"
                onClick={() => toggleFaq(index)}
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${index}`}
              >
                <span className="faq-accordion-question">{faq.q}</span>
                <i
                  className={`fas fa-chevron-down faq-accordion-icon ${isOpen ? 'faq-accordion-icon--open' : ''}`}
                  aria-hidden="true"
                />
              </button>
              <div
                id={`faq-panel-${index}`}
                className={`faq-accordion-collapse ${isOpen ? 'faq-accordion-collapse--open' : ''}`}
                role="region"
                aria-hidden={!isOpen}
              >
                <div className="faq-accordion-content">
                  <p className="faq-accordion-answer">{faq.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
