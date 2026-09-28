/**
 * BusinessUniqueFeatures.jsx — Unique Business Editor Features.
 *
 * These features are ONLY available in Business Workspace,
 * NOT in Creator Studio:
 *
 * 1. Business Hours — operating hours per day
 * 2. Service Catalog — services with pricing
 * 3. Invoice Generator — create invoices for clients
 * 4. Client Portal — client login and project tracking
 * 5. Business Analytics — revenue, clients, projects
 * 6. Team Management — invite team members
 * 7. Contract Templates — reusable contract templates
 * 8. Payment Integration — Stripe/PayPal for business
 */
import React, { useState } from 'react';

const BUSINESS_HOURS_DEFAULT = {
  mon: '09:00–17:00',
  tue: '09:00–17:00',
  wed: '09:00–17:00',
  thu: '09:00–17:00',
  fri: '09:00–17:00',
  sat: 'Closed',
  sun: 'Closed',
};

const DAYS = [
  { key: 'mon', labelHt: 'Lendi', labelEn: 'Monday' },
  { key: 'tue', labelHt: 'Madi', labelEn: 'Tuesday' },
  { key: 'wed', labelHt: 'Mèkredi', labelEn: 'Wednesday' },
  { key: 'thu', labelHt: 'Jedi', labelEn: 'Thursday' },
  { key: 'fri', labelHt: 'Vandredi', labelEn: 'Friday' },
  { key: 'sat', labelHt: 'Samdi', labelEn: 'Saturday' },
  { key: 'sun', labelHt: 'Dimanch', labelEn: 'Sunday' },
];

// ─── 1. Business Hours Editor ──────────────────────────────────────
export function BusinessHoursEditor({ hours = {}, onChange, lang = 'ht' }) {
  const [editing, setEditing] = useState(false);
  const currentHours = { ...BUSINESS_HOURS_DEFAULT, ...hours };

  const t = (ht, en) => lang === 'ht' ? ht : en;

  if (!editing) {
    return (
      <div className="business-hours-preview" style={{
        padding: 16,
        borderRadius: 12,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
            <i className="fas fa-clock" style={{ marginRight: 8, color: '#3b82f6' }} />
            {t('Orè Biznis', 'Business Hours')}
          </h4>
          <button
            onClick={() => setEditing(true)}
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--pink-primary)',
              color: '#fff',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <i className="fas fa-edit" /> {t('Modify', 'Edit')}
          </button>
        </div>
        {DAYS.map(day => (
          <div key={day.key} style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '6px 0',
            borderBottom: '1px solid var(--border-color)',
          }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>
              {lang === 'ht' ? day.labelHt : day.labelEn}
            </span>
            <span style={{
              fontSize: 13,
              color: currentHours[day.key] === 'Closed' ? '#ef4444' : 'var(--text-secondary)',
            }}>
              {currentHours[day.key]}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="business-hours-editor" style={{
      padding: 16,
      borderRadius: 12,
      background: 'var(--bg-secondary)',
      border: '2px solid var(--pink-primary)',
    }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>
        <i className="fas fa-clock" style={{ marginRight: 8, color: '#3b82f6' }} />
        {t('Modify Orè Biznis', 'Edit Business Hours')}
      </h4>
      {DAYS.map(day => (
        <div key={day.key} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 0',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <span style={{ width: 100, fontSize: 13, fontWeight: 500 }}>
            {lang === 'ht' ? day.labelHt : day.labelEn}
          </span>
          <input
            type="text"
            value={currentHours[day.key] || ''}
            onChange={(e) => onChange({ ...currentHours, [day.key]: e.target.value })}
            placeholder={t('09:00–17:00', '09:00–17:00')}
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              fontSize: 13,
            }}
          />
          <button
            onClick={() => onChange({ ...currentHours, [day.key]: 'Closed' })}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              border: 'none',
              background: currentHours[day.key] === 'Closed' ? '#ef4444' : 'var(--bg-tertiary)',
              color: currentHours[day.key] === 'Closed' ? '#fff' : 'var(--text-secondary)',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            {t('Fèmen', 'Closed')}
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          onClick={() => setEditing(false)}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: 'none',
            background: 'var(--pink-primary)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <i className="fas fa-check" /> {t('Sove', 'Save')}
        </button>
        <button
          onClick={() => setEditing(false)}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: '1px solid var(--border-color)',
            background: 'transparent',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {t('Anile', 'Cancel')}
        </button>
      </div>
    </div>
  );
}

// ─── 2. Service Catalog ────────────────────────────────────────────
export function ServiceCatalogEditor({ services = [], onChange, lang = 'ht' }) {
  const [adding, setAdding] = useState(false);
  const [newService, setNewService] = useState({ name: '', description: '', price: '', duration: '' });

  const t = (ht, en) => lang === 'ht' ? ht : en;

  const addService = () => {
    if (!newService.name) return;
    onChange([...services, { ...newService, id: Date.now() }]);
    setNewService({ name: '', description: '', price: '', duration: '' });
    setAdding(false);
  };

  const removeService = (id) => {
    onChange(services.filter(s => s.id !== id));
  };

  return (
    <div style={{
      padding: 16,
      borderRadius: 12,
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
          <i className="fas fa-concierge-bell" style={{ marginRight: 8, color: '#8b5cf6' }} />
          {t('Katalòg Sèvis', 'Service Catalog')}
        </h4>
        <button
          onClick={() => setAdding(true)}
          style={{
            padding: '4px 12px',
            borderRadius: 6,
            border: 'none',
            background: '#8b5cf6',
            color: '#fff',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          <i className="fas fa-plus" /> {t('Ajoute Sèvis', 'Add Service')}
        </button>
      </div>

      {services.map(service => (
        <div key={service.id} style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 12px',
          borderRadius: 8,
          background: 'var(--bg-primary)',
          marginBottom: 8,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{service.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{service.description}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#8b5cf6' }}>
              {service.price ? `$${service.price}` : t('Gratis', 'Free')}
            </span>
            <button
              onClick={() => removeService(service.id)}
              style={{
                padding: '4px 8px',
                borderRadius: 4,
                border: 'none',
                background: '#fee2e2',
                color: '#ef4444',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              <i className="fas fa-trash" />
            </button>
          </div>
        </div>
      ))}

      {adding && (
        <div style={{
          padding: 12,
          borderRadius: 8,
          background: 'var(--bg-primary)',
          border: '2px solid #8b5cf6',
          marginTop: 8,
        }}>
          <input
            type="text"
            placeholder={t('Non sèvis', 'Service name')}
            value={newService.name}
            onChange={(e) => setNewService({ ...newService, name: e.target.value })}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              fontSize: 13,
              marginBottom: 8,
            }}
          />
          <textarea
            placeholder={t('Deskripsyon', 'Description')}
            value={newService.description}
            onChange={(e) => setNewService({ ...newService, description: e.target.value })}
            rows={2}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 6,
              border: '1px solid var(--border-color)',
              fontSize: 13,
              marginBottom: 8,
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              placeholder={t('Pri ($)', 'Price ($)')}
              value={newService.price}
              onChange={(e) => setNewService({ ...newService, price: e.target.value })}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                fontSize: 13,
              }}
            />
            <input
              type="text"
              placeholder={t('Durasyon', 'Duration')}
              value={newService.duration}
              onChange={(e) => setNewService({ ...newService, duration: e.target.value })}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                fontSize: 13,
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={addService}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: 'none',
                background: '#8b5cf6',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <i className="fas fa-check" /> {t('Ajoute', 'Add')}
            </button>
            <button
              onClick={() => setAdding(false)}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid var(--border-color)',
                background: 'transparent',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {t('Anile', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      {services.length === 0 && !adding && (
        <div style={{
          padding: 20,
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: 13,
        }}>
          <i className="fas fa-concierge-bell" style={{ fontSize: 24, opacity: 0.3, marginBottom: 8 }} />
          <p>{t('Pa gen sèvis ankò', 'No services yet')}</p>
        </div>
      )}
    </div>
  );
}

// ─── 3. Invoice Generator ──────────────────────────────────────────
export function InvoiceGenerator({ businessName, lang = 'ht' }) {
  const t = (ht, en) => lang === 'ht' ? ht : en;

  return (
    <div style={{
      padding: 16,
      borderRadius: 12,
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
    }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>
        <i className="fas fa-file-invoice-dollar" style={{ marginRight: 8, color: '#10b981' }} />
        {t('Jenere Facti', 'Invoice Generator')}
      </h4>
      <div style={{
        padding: 20,
        borderRadius: 8,
        background: 'var(--bg-primary)',
        border: '1px dashed var(--border-color)',
        textAlign: 'center',
      }}>
        <i className="fas fa-file-invoice" style={{ fontSize: 32, color: '#10b981', marginBottom: 12 }} />
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          {t(
            'Jenere fakti pou kliyan ou yo. Ajoute non, deskripsyon, kantite, ak pri.',
            'Generate invoices for your clients. Add name, description, quantity, and price.'
          )}
        </p>
        <button
          style={{
            padding: '8px 20px',
            borderRadius: 6,
            border: 'none',
            background: '#10b981',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <i className="fas fa-plus" /> {t('Kreye Fakti', 'Create Invoice')}
        </button>
      </div>
    </div>
  );
}

// ─── 4. Client Portal ──────────────────────────────────────────────
export function ClientPortal({ lang = 'ht' }) {
  const t = (ht, en) => lang === 'ht' ? ht : en;

  return (
    <div style={{
      padding: 16,
      borderRadius: 12,
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
    }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>
        <i className="fas fa-users-cog" style={{ marginRight: 8, color: '#f59e0b' }} />
        {t('Pòtal Kliyan', 'Client Portal')}
      </h4>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 12,
      }}>
        <div style={{
          padding: 16,
          borderRadius: 8,
          background: 'var(--bg-primary)',
          textAlign: 'center',
        }}>
          <i className="fas fa-user-check" style={{ fontSize: 24, color: '#3b82f6', marginBottom: 8 }} />
          <div style={{ fontSize: 20, fontWeight: 700 }}>0</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {t('Kliyan Aktif', 'Active Clients')}
          </div>
        </div>
        <div style={{
          padding: 16,
          borderRadius: 8,
          background: 'var(--bg-primary)',
          textAlign: 'center',
        }}>
          <i className="fas fa-project-diagram" style={{ fontSize: 24, color: '#8b5cf6', marginBottom: 8 }} />
          <div style={{ fontSize: 20, fontWeight: 700 }}>0</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            {t('Pwojè Aktif', 'Active Projects')}
          </div>
        </div>
      </div>
    </div>
  );
}

export default {
  BusinessHoursEditor,
  ServiceCatalogEditor,
  InvoiceGenerator,
  ClientPortal,
};
