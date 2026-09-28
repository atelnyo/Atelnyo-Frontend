/**
 * src/components/cms/ComponentRegistry.jsx
 *
 * Component Registry — Phase 2 of the Dynamic Intelligence Platform.
 *
 * Sa a se kat ki fè korespondans ant kalite seksyon (section_type)
 * ki soti nan backend la ak Component React ki rann yo.
 *
 * Lè frontend la resevwa yon paj nan `/api/pages/<slug>/render/`,
 * li itilize COMPONENT_REGISTRY pou chwazi ki component pou rann
 * pou chak seksyon.
 *
 * Si yon kalite seksyon poko gen yon component, li tonbe nan
 * FallbackSection.
 */
import React from 'react';

// ─── Seksyon Senp — Tèks / Rich Text ──────────────────────────────────

function RichTextSection({ section }) {
  return (
    <section
      className={`cms-section ${section.css_class || ''} ${section.animation || ''}`}
      style={{ backgroundColor: section.background_color || 'transparent' }}
    >
      <div className="cms-container">
        <div
          className="cms-rich-text"
          dangerouslySetInnerHTML={{ __html: section.config_json?.content || '' }}
        />
      </div>
    </section>
  );
}

function MarkdownSection({ section }) {
  const content = section.config_json?.content || '';
  return (
    <section className={`cms-section ${section.css_class || ''} ${section.animation || ''}`}>
      <div className="cms-container">
        {section.title && <h2 className="cms-section-title">{section.title}</h2>}
        <div className="cms-markdown">{content}</div>
      </div>
    </section>
  );
}

function SeparatorSection({ section }) {
  return (
    <div className={`cms-separator ${section.css_class || ''}`}
      style={{ backgroundColor: section.background_color || 'transparent' }}>
      <hr className="cms-hr" />
    </div>
  );
}

function SpacerSection({ section }) {
  const height = section.config_json?.height || '2rem';
  return (
    <div className={`cms-spacer ${section.css_class || ''}`}
      style={{ height, backgroundColor: section.background_color || 'transparent' }} />
  );
}

// ─── Seksyon Hero / Banner ────────────────────────────────────────────

function HeroSection({ section }) {
  const config = section.config_json || {};
  const bgStyle = config.background_image
    ? { backgroundImage: `url(${config.background_image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};

  return (
    <section
      className={`cms-hero ${section.animation || ''}`}
      style={{
        ...bgStyle,
        backgroundColor: section.background_color || 'var(--pink-primary)',
      }}
    >
      <div className="cms-hero-overlay" style={{
        backgroundColor: config.overlay_color || 'var(--overlay-color, rgba(0,0,0,0.4))',
      }} />
      <div className="cms-hero-content">
        {section.title && <h1 className="cms-hero-title">{section.title}</h1>}
        {section.subtitle && <p className="cms-hero-subtitle">{section.subtitle}</p>}
        {config.headline && <h1 className="cms-hero-title">{config.headline}</h1>}
        {config.description && <p className="cms-hero-desc">{config.description}</p>}
        {config.cta_text && (
          <a href={config.cta_link || '#'} className="cms-hero-cta">
            {config.cta_text}
          </a>
        )}
      </div>
    </section>
  );
}

function BannerSection({ section }) {
  const config = section.config_json || {};
  return (
    <section
      className={`cms-banner ${section.animation || ''}`}
      style={{
        backgroundColor: section.background_color || 'var(--pink-light)',
      }}
    >
      <div className="cms-container">
        <div className={`cms-banner-grid${config.image_url ? ' has-image' : ''}`}>
          <div>
            {section.title && <h2 className="cms-section-title">{section.title}</h2>}
            {section.subtitle && <p className="cms-section-subtitle">{section.subtitle}</p>}
            {config.text && <p>{config.text}</p>}
            {config.cta_text && (
              <a href={config.cta_link || '#'} className="cms-btn btn-primary">
                {config.cta_text}
              </a>
            )}
          </div>
          {config.image_url && (
            <div className="cms-banner-image">
              <img src={config.image_url} alt={section.title || 'Banner'} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Seksyon Grid / Cards ─────────────────────────────────────────────

function GridSection({ section }) {
  const config = section.config_json || {};
  const items = config.items || [];
  const columns = config.columns || 3;

  return (
    <section
      className={`cms-grid-section ${section.animation || ''}`}
      style={{
        backgroundColor: section.background_color || 'transparent',
      }}
    >
      <div className="cms-container">
        {section.title && <h2 className="cms-section-title">{section.title}</h2>}
        {section.subtitle && <p className="cms-section-subtitle">{section.subtitle}</p>}
        <div className="cms-grid">
          {items.map((item, i) => (
            <div key={i} className="cms-grid-card">
              {item.icon && <i className={`fas ${item.icon} cms-card-icon`} />}
              {item.image && <img src={item.image} alt={item.title || ''} className="cms-card-image" />}
              {item.title && <h3 className="cms-card-title">{item.title}</h3>}
              {item.description && <p className="cms-card-desc">{item.description}</p>}
              {item.link && <a href={item.link} className="cms-card-link">Learn more →</a>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CardSection({ section }) {
  const config = section.config_json || {};
  const cards = config.cards || [];

  return (
    <section className={`cms-cards ${section.animation || ''} ${section.css_class || ''}`}>
      <div className="cms-container">
        {section.title && <h2 className="cms-section-title">{section.title}</h2>}
        <div className="cms-cards-grid">
          {cards.map((card, i) => (
            <div key={i} className="cms-card" style={{
              // Dark-mode safe: card.color is an explicit author choice;
              // the fallbacks are CSS vars (not #fff) so a light-mode
              // author color never bleaches dark mode when unset.
              background: card.color || 'var(--card-bg)',
              color: card.text_color || 'var(--text-main)',
            }}>
              {card.icon && <i className={`fas ${card.icon}`} />}
              {card.title && <h3>{card.title}</h3>}
              {card.text && <p>{card.text}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Seksyon FAQ / Accordion ──────────────────────────────────────────

function FAQSection({ section }) {
  const config = section.config_json || {};
  const items = config.items || [];

  return (
    <section
      className={`cms-faq ${section.animation || ''}`}
      style={{
        backgroundColor: section.background_color || 'transparent',
      }}
    >
      <div className="cms-faq-container">
        {section.title && <h2 className="cms-section-title">{section.title}</h2>}
        {items.map((item, i) => (
          <details key={i} className="cms-faq-item">
            <summary className="cms-faq-summary">
              {item.q || item.question}
            </summary>
            <p className="cms-faq-answer">
              {item.a || item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

function AccordionSection({ section }) {
  // Menm jan ak FAQ men ak style diferan
  return <FAQSection section={section} />;
}

// ─── Seksyon Pricing ──────────────────────────────────────────────────

function PricingSection({ section }) {
  const config = section.config_json || {};
  const plans = config.plans || [];

  return (
    <section
      className={`cms-pricing ${section.animation || ''}`}
      style={{
        backgroundColor: section.background_color || 'transparent',
      }}
    >
      <div className="cms-container">
        {section.title && <h2 className="cms-section-title">{section.title}</h2>}
        <div className="cms-pricing-grid">
          {plans.map((plan, i) => (
            <div key={i} className={`cms-pricing-card${plan.featured ? ' featured' : ''}`}>
              <h3 className="cms-plan-name">{plan.name}</h3>
              <div className="cms-plan-price">
                ${plan.price}
                <span className="cms-plan-price-period">/{plan.period || 'mo'}</span>
              </div>
              <ul className="cms-plan-features">
                {(plan.features || []).map((f, j) => (
                  <li key={j}>
                    <i className="fas fa-check" />
                    {f}
                  </li>
                ))}
              </ul>
              {plan.cta_text && (
                <a href={plan.cta_link || '#'} className="cms-plan-cta">
                  {plan.cta_text}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Seksyon Reviews / Testimonials ───────────────────────────────────

function ReviewsSection({ section }) {
  const config = section.config_json || {};
  const reviews = config.reviews || [];

  return (
    <section
      className={`cms-reviews ${section.animation || ''}`}
      style={{
        backgroundColor: section.background_color || 'transparent',
      }}
    >
      <div className="cms-container">
        {section.title && <h2 className="cms-section-title">{section.title}</h2>}
        <div className="cms-reviews-grid">
          {reviews.map((review, i) => (
            <div key={i} className="cms-review-card">
              <div className="cms-review-stars">
                {'★'.repeat(review.rating || 5)}{'☆'.repeat(5 - (review.rating || 5))}
              </div>
              <p className="cms-review-text">"{review.text || review.body}"</p>
              <div className="cms-review-author">
                — {review.author || review.name || 'Anonymous'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection({ section }) {
  return <ReviewsSection section={section} />;
}

// ─── Seksyon Statistics ───────────────────────────────────────────────

function StatisticsSection({ section }) {
  const config = section.config_json || {};
  const stats = config.stats || [];

  return (
    <section className={`cms-section cms-stats-section ${section.animation || ''}`}
      style={{
        backgroundColor: section.background_color || 'var(--pink-primary)',
      }}>
      <div className="cms-container">
        {section.title && <h2 className="cms-section-title">{section.title}</h2>}
        <div className="cms-stats-grid">
          {stats.map((stat, i) => (
            <div key={i} className="cms-stat-item">
              <div className="cms-stat-number">
                {stat.value || stat.number}
              </div>
              <div className="cms-stat-label">{stat.label || stat.name}</div>
              {stat.subtitle && <div className="cms-stat-subtitle">{stat.subtitle}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Seksyon Video ────────────────────────────────────────────────────

function VideoSection({ section }) {
  const config = section.config_json || {};
  const url = config.url || '';
  const embedUrl = url.includes('youtube.com') || url.includes('youtu.be')
    ? url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')
    : url.includes('vimeo.com')
    ? `https://player.vimeo.com/video/${url.split('/').pop()}`
    : url;

  return (
    <section
      className={`cms-video ${section.animation || ''}`}
      style={{
        backgroundColor: section.background_color || 'transparent',
      }}
    >
      <div className="cms-video-container">
        {section.title && <h2 className="cms-section-title">{section.title}</h2>}
        <div className="cms-video-wrapper">
          <iframe
            src={embedUrl}
            title={section.title || 'Video'}
            allowFullScreen
          />
        </div>
      </div>
    </section>
  );
}

// ─── Seksyon Image Gallery ────────────────────────────────────────────

function GallerySection({ section }) {
  const config = section.config_json || {};
  const images = config.images || [];

  return (
    <section
      className={`cms-gallery ${section.animation || ''}`}
      style={{
        backgroundColor: section.background_color || 'transparent',
      }}
    >
      <div className="cms-container">
        {section.title && <h2 className="cms-section-title">{section.title}</h2>}
        <div className="cms-gallery-grid">
          {images.map((img, i) => (
            <div key={i} className="cms-gallery-item">
              <img
                src={img.url || img.src || img}
                alt={img.alt || `Gallery ${i + 1}`}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Seksyon Countdown ────────────────────────────────────────────────

function CountdownSection({ section }) {
  const config = section.config_json || {};
  const targetDate = config.target_date || '';
  const [timeLeft, setTimeLeft] = React.useState('');

  React.useEffect(() => {
    if (!targetDate) return;
    const interval = setInterval(() => {
      const diff = new Date(targetDate) - new Date();
      if (diff <= 0) {
        setTimeLeft('Event started!');
        clearInterval(interval);
        return;
      }
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${d}d ${h}h ${m}m ${s}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <section
      className={`cms-section cms-countdown ${section.animation || ''}`}
      style={{
        backgroundColor: section.background_color || 'var(--pink-primary)',
      }}
    >
      <div className="cms-container">
        {section.title && <h2 className="cms-section-title">{section.title}</h2>}
        {timeLeft && <div className="cms-countdown-timer">{timeLeft}</div>}
        {config.description && <p className="cms-countdown-desc">{config.description}</p>}
      </div>
    </section>
  );
}

// ─── Seksyon Columns ──────────────────────────────────────────────────

function ColumnsSection({ section }) {
  const config = section.config_json || {};
  const columns = config.columns || [];

  return (
    <section className={`cms-section cms-columns ${section.animation || ''}`}
      style={{
        backgroundColor: section.background_color || 'transparent',
      }}>
      <div className="cms-container">
        {section.title && <h2 className="cms-section-title">{section.title}</h2>}
        <div className="cms-columns-grid" style={{
          gridTemplateColumns: `repeat(auto-fit, minmax(${config.min_width || '250px'}, 1fr))`,
        }}>
          {columns.map((col, i) => (
            <div key={i} className="cms-column">
              {col.title && <h3>{col.title}</h3>}
              {col.content && <div dangerouslySetInnerHTML={{ __html: col.content }} />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Seksyon CTA ──────────────────────────────────────────────────────

function CTASection({ section }) {
  const config = section.config_json || {};
  return (
    <section
      className={`cms-section cms-cta ${section.animation || ''}`}
      style={{
        backgroundColor: section.background_color || 'var(--pink-primary)',
      }}
    >
      <div className="cms-cta-container">
        {section.title && <h2 className="cms-section-title">{section.title}</h2>}
        {section.subtitle && <p className="cms-cta-subtitle">{section.subtitle}</p>}
        {config.cta_text && (
          <a href={config.cta_link || '#'} className="cms-btn cms-btn-light">
            {config.cta_text}
          </a>
        )}
      </div>
    </section>
  );
}

// ─── Seksyon Timeline ─────────────────────────────────────────────────

function TimelineSection({ section }) {
  const config = section.config_json || {};
  const items = config.items || [];

  return (
    <section
      className={`cms-timeline ${section.animation || ''}`}
      style={{
        backgroundColor: section.background_color || 'transparent',
      }}
    >
      <div className="cms-timeline-container">
        {section.title && <h2 className="cms-section-title">{section.title}</h2>}
        <div className="cms-timeline-list">
          {items.map((item, i) => (
            <div key={i} className="cms-timeline-item">
              <div className="cms-timeline-dot" />
              {item.date && <div className="cms-timeline-date">{item.date}</div>}
              {item.title && <h3 className="cms-timeline-title">{item.title}</h3>}
              {item.description && <p className="cms-timeline-desc">{item.description}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Seksyon Charts ────────────────────────────────────────────────────

function ChartsSection({ section }) {
  const config = section.config_json || {};
  const charts = config.charts || [];
  return (
    <section className={`cms-section cms-charts ${section.animation || ''}`}
      style={{ backgroundColor: section.background_color || 'transparent' }}>
      <div className="cms-container">
        {section.title && <h2 className="cms-section-title">{section.title}</h2>}
        <div className="cms-charts-grid">
          {charts.map((chart, i) => (
            <div key={i} className="cms-chart-card">
              <h4>{chart.title || ''}</h4>
              <div className="cms-chart-bars">
                {(chart.data || []).map((bar, j) => (
                  <div key={j} className="cms-chart-bar-wrap">
                    <div className="cms-chart-bar" style={{ height: `${Math.max(4, bar.value || 0)}%`, background: bar.color || 'var(--pink-primary)' }} />
                    <span className="cms-chart-label">{bar.label || ''}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Seksyon Form ──────────────────────────────────────────────────────

function FormSection({ section }) {
  const config = section.config_json || {};
  const fields = config.fields || [];
  return (
    <section className={`cms-section cms-form ${section.animation || ''}`}
      style={{ backgroundColor: section.background_color || 'transparent' }}>
      <div className="cms-container">
        {section.title && <h2 className="cms-section-title">{section.title}</h2>}
        {section.subtitle && <p className="cms-section-subtitle">{section.subtitle}</p>}
        <form className="cms-form-grid" onSubmit={(e) => { e.preventDefault(); }}>
          {fields.map((field, i) => (
            <div key={i} className="cms-form-field">
              <label>{field.label || field.name}</label>
              {field.type === 'textarea' ? (
                <textarea placeholder={field.placeholder || ''} />
              ) : (
                <input type={field.type || 'text'} placeholder={field.placeholder || ''} />
              )}
            </div>
          ))}
          {config.submit_text && (
            <button type="submit" className="cms-btn btn-primary">{config.submit_text}</button>
          )}
        </form>
      </div>
    </section>
  );
}

// ─── Seksyon Map ───────────────────────────────────────────────────────

function MapSection({ section }) {
  const config = section.config_json || {};
  const src = config.embed_url || config.src || '';
  return (
    <section className={`cms-section cms-map ${section.animation || ''}`}
      style={{ backgroundColor: section.background_color || 'transparent' }}>
      <div className="cms-container">
        {section.title && <h2 className="cms-section-title">{section.title}</h2>}
        {src ? (
          <div className="cms-map-wrapper">
            <iframe src={src} title={section.title || 'Map'} allowFullScreen style={{ border: 0, width: '100%', height: '360px' }} />
          </div>
        ) : (
          <p className="cms-fallback-msg">Map embed URL missing in config.</p>
        )}
      </div>
    </section>
  );
}

// ─── Seksyon Carousel ──────────────────────────────────────────────────

function CarouselSection({ section }) {
  const config = section.config_json || {};
  const items = config.items || [];
  const [idx, setIdx] = React.useState(0);
  if (!items.length) return null;
  const prev = () => setIdx((idx - 1 + items.length) % items.length);
  const next = () => setIdx((idx + 1) % items.length);
  const item = items[idx];
  return (
    <section className={`cms-section cms-carousel ${section.animation || ''}`}
      style={{ backgroundColor: section.background_color || 'transparent' }}>
      <div className="cms-container">
        {section.title && <h2 className="cms-section-title">{section.title}</h2>}
        <div className="cms-carousel">
          <div className="cms-carousel-slide">
            {item.image && <img src={item.image} alt={item.title || ''} />}
            {item.title && <h3>{item.title}</h3>}
            {item.text && <p>{item.text}</p>}
          </div>
          {items.length > 1 && (
            <div className="cms-carousel-controls">
              <button type="button" onClick={prev} aria-label="Previous">←</button>
              <button type="button" onClick={next} aria-label="Next">→</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Seksyon Grids (Course / Music / Event) ────────────────────────────

function CourseGridSection({ section }) {
  const config = section.config_json || {};
  const items = config.items || [];
  return (
    <section className={`cms-section cms-course-grid ${section.animation || ''}`}
      style={{ backgroundColor: section.background_color || 'transparent' }}>
      <div className="cms-container">
        {section.title && <h2 className="cms-section-title">{section.title}</h2>}
        <div className="cms-grid">
          {items.map((item, i) => (
            <div key={i} className="cms-grid-card">
              {item.image && <img src={item.image} alt={item.title || ''} className="cms-card-image" />}
              {item.title && <h3 className="cms-card-title">{item.title}</h3>}
              {item.description && <p className="cms-card-desc">{item.description}</p>}
              {item.price !== undefined && <p className="cms-card-price">${item.price}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MusicGridSection({ section }) {
  const config = section.config_json || {};
  const items = config.items || [];
  return (
    <section className={`cms-section cms-music-grid ${section.animation || ''}`}
      style={{ backgroundColor: section.background_color || 'transparent' }}>
      <div className="cms-container">
        {section.title && <h2 className="cms-section-title">{section.title}</h2>}
        <div className="cms-grid">
          {items.map((item, i) => (
            <div key={i} className="cms-grid-card">
              {item.cover && <img src={item.cover} alt={item.title || ''} className="cms-card-image" />}
              {item.title && <h3 className="cms-card-title">{item.title}</h3>}
              {item.artist && <p className="cms-card-desc">{item.artist}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EventGridSection({ section }) {
  const config = section.config_json || {};
  const items = config.items || [];
  return (
    <section className={`cms-section cms-event-grid ${section.animation || ''}`}
      style={{ backgroundColor: section.background_color || 'transparent' }}>
      <div className="cms-container">
        {section.title && <h2 className="cms-section-title">{section.title}</h2>}
        <div className="cms-grid">
          {items.map((item, i) => (
            <div key={i} className="cms-grid-card">
              {item.image && <img src={item.image} alt={item.title || ''} className="cms-card-image" />}
              {item.title && <h3 className="cms-card-title">{item.title}</h3>}
              {item.date && <p className="cms-card-desc">{item.date}</p>}
              {item.location && <p className="cms-card-desc">{item.location}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Seksyon Tabs ──────────────────────────────────────────────────────

function TabsSection({ section }) {
  const config = section.config_json || {};
  const tabs = config.tabs || [];
  const [active, setActive] = React.useState(0);
  if (!tabs.length) return null;
  return (
    <section className={`cms-section cms-tabs ${section.animation || ''}`}
      style={{ backgroundColor: section.background_color || 'transparent' }}>
      <div className="cms-container">
        {section.title && <h2 className="cms-section-title">{section.title}</h2>}
        <div className="cms-tabs-nav">
          {tabs.map((tab, i) => (
            <button key={i} type="button" className={`cms-tab-btn${i === active ? ' active' : ''}`} onClick={() => setActive(i)}>
              {tab.title || tab.label || `Tab ${i + 1}`}
            </button>
          ))}
        </div>
        <div className="cms-tabs-panel">
          {tabs[active] && (
            <div>
              {tabs[active].content && <div dangerouslySetInnerHTML={{ __html: tabs[active].content }} />}
              {tabs[active].items && (
                <ul>
                  {tabs[active].items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Seksyon Custom HTML ───────────────────────────────────────────────

function CustomHtmlSection({ section }) {
  const config = section.config_json || {};
  const html = config.html || '';
  return (
    <section className={`cms-section cms-custom-html ${section.animation || ''}`}
      style={{ backgroundColor: section.background_color || 'transparent' }}>
      <div className="cms-container">
        {section.title && <h2 className="cms-section-title">{section.title}</h2>}
        <div className="cms-custom-html" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </section>
  );
}

// ─── Seksyon Header / Footer (inline) ──────────────────────────────────

function HeaderSection({ section }) {
  const config = section.config_json || {};
  return (
    <header className={`cms-section cms-page-header ${section.animation || ''}`}
      style={{ backgroundColor: section.background_color || 'transparent' }}>
      <div className="cms-container">
        {section.title && <h1 className="cms-page-header-title">{section.title}</h1>}
        {section.subtitle && <p className="cms-page-header-subtitle">{section.subtitle}</p>}
        {config.breadcrumbs && (
          <nav className="cms-page-header-breadcrumbs">
            {config.breadcrumbs.map((crumb, i) => (
              <span key={i}>
                {i > 0 && <span className="cms-breadcrumb-sep">/</span>}
                {crumb.link ? <a href={crumb.link}>{crumb.label}</a> : <span>{crumb.label}</span>}
              </span>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}

function FooterSection({ section }) {
  const config = section.config_json || {};
  return (
    <footer className={`cms-section cms-page-footer ${section.animation || ''}`}
      style={{ backgroundColor: section.background_color || 'transparent' }}>
      <div className="cms-container">
        {section.title && <h3 className="cms-page-footer-title">{section.title}</h3>}
        {config.text && <p>{config.text}</p>}
        {config.links && (
          <div className="cms-page-footer-links">
            {config.links.map((link, i) => (
              <a key={i} href={link.href || '#'}>{link.label}</a>
            ))}
          </div>
        )}
      </div>
    </footer>
  );
}

// ─── Fallback — lè yon kalite seksyon poko gen component ────────────

function FallbackSection({ section }) {
  return (
    <section className={`cms-fallback ${section.css_class || ''}`}
      style={{
        backgroundColor: section.background_color || 'var(--bg-main)',
      }}
    >
      <div className="cms-container">
        <p className="cms-fallback-msg">
          ⚠️ Section type "<strong>{section.section_type}</strong>" — Component not yet implemented
        </p>
        {section.title && <p className="cms-fallback-title">{section.title}</p>}
        {section.config_json && Object.keys(section.config_json).length > 0 && (
          <pre className="cms-fallback-json">{JSON.stringify(section.config_json, null, 2)}</pre>
        )}
      </div>
    </section>
  );
}

// ─── COMPONENT REGISTRY — Kat santral la ──────────────────────────────
// Ajoute yon nouvo component isit la lè w kreye yon nouvo kalite seksyon.

export const COMPONENT_REGISTRY = {
  hero:          HeroSection,
  banner:        BannerSection,
  video:         VideoSection,
  gallery:       GallerySection,
  grid:          GridSection,
  timeline:      TimelineSection,
  pricing:       PricingSection,
  faq:           FAQSection,
  accordion:     AccordionSection,
  statistics:    StatisticsSection,
  cards:         CardSection,
  reviews:       ReviewsSection,
  testimonials:  TestimonialsSection,
  countdown:     CountdownSection,
  cta:           CTASection,
  columns:       ColumnsSection,
  rich_text:     RichTextSection,
  markdown:      MarkdownSection,
  separator:     SeparatorSection,
  spacer:        SpacerSection,
  charts:        ChartsSection,
  form:          FormSection,
  map:           MapSection,
  carousel:      CarouselSection,
  course_grid:   CourseGridSection,
  music_grid:    MusicGridSection,
  event_grid:    EventGridSection,
  tabs:          TabsSection,
  custom_html:   CustomHtmlSection,
  header:        HeaderSection,
  footer:        FooterSection,
};

export const FALLBACK_COMPONENT = FallbackSection;

/**
 * Chwazi component ki koresponn ak yon kalite seksyon.
 * Si pa jwenn, retounen FallbackSection.
 */
export function getComponentForSection(sectionType) {
  return COMPONENT_REGISTRY[sectionType] || FALLBACK_COMPONENT;
}
