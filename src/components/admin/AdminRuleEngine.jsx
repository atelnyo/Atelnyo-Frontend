/**
 * src/components/admin/AdminRuleEngine.jsx
 *
 * Rule Engine Admin Panel — list, create, edit, evaluate rules.
 *
 * Route: /sheet/admin/rules
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import api from '../../services/api';

const s = {
  page: {
    padding: '1.5rem',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1.5rem',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 700,
    color: 'var(--text-main, #1a1a1a)',
  },
  btn: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.9rem',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  btnPrimary: {
    background: 'var(--pink-primary, #d81b60)',
    color: '#fff',
  },
  btnSecondary: {
    background: 'var(--card-bg, #fff)',
    color: 'var(--text-main, #1a1a1a)',
    border: '1px solid var(--border-color, #e0e0e0)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: 'var(--card-bg, #fff)',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid var(--border-color, #e0e0e0)',
  },
  th: {
    textAlign: 'left',
    padding: '12px 14px',
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--text-secondary, #666)',
    background: 'var(--bg-secondary, #f8f9fa)',
    borderBottom: '1px solid var(--border-color, #e0e0e0)',
  },
  td: {
    padding: '12px 14px',
    fontSize: '0.9rem',
    borderBottom: '1px solid var(--border-color, #e0e0e0)',
    color: 'var(--text-main, #1a1a1a)',
  },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '0.72rem',
    fontWeight: 700,
  },
  empty: {
    padding: '2rem',
    textAlign: 'center',
    color: 'var(--text-secondary, #666)',
  },
  modal: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '1rem',
  },
  modalCard: {
    background: 'var(--card-bg, #fff)',
    borderRadius: '14px',
    width: '100%',
    maxWidth: '720px',
    maxHeight: '90vh',
    overflow: 'auto',
    padding: '1.5rem',
  },
  formRow: {
    display: 'grid',
    gap: '12px',
    marginBottom: '12px',
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid var(--border-color, #e0e0e0)',
    background: 'var(--bg-primary, #fff)',
    color: 'var(--text-main, #1a1a1a)',
  },
  select: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid var(--border-color, #e0e0e0)',
    background: 'var(--bg-primary, #fff)',
    color: 'var(--text-main, #1a1a1a)',
  },
  sectionTitle: {
    fontSize: '0.85rem',
    fontWeight: 700,
    margin: '1rem 0 0.5rem',
    color: 'var(--text-secondary, #666)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  conditionRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr auto',
    gap: '8px',
    marginBottom: '8px',
    alignItems: 'center',
  },
  actionRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr auto',
    gap: '8px',
    marginBottom: '8px',
    alignItems: 'center',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
    marginTop: '1rem',
  },
};

const EVENT_TYPES = [
  { key: 'user_signup', labelKey: 'admin_rule_engine_event_user_signup', fallback: 'User signs up' },
  { key: 'user_login', labelKey: 'admin_rule_engine_event_user_login', fallback: 'User logs in' },
  { key: 'course_completed', labelKey: 'admin_rule_engine_event_course_completed', fallback: 'Course completed' },
  { key: 'course_enrolled', labelKey: 'admin_rule_engine_event_course_enrolled', fallback: 'Course enrolled' },
  { key: 'purchase_made', labelKey: 'admin_rule_engine_event_purchase_made', fallback: 'Purchase made' },
  { key: 'review_submitted', labelKey: 'admin_rule_engine_event_review_submitted', fallback: 'Review submitted' },
  { key: 'achievement_earned', labelKey: 'admin_rule_engine_event_achievement_earned', fallback: 'Achievement earned' },
  { key: 'content_created', labelKey: 'admin_rule_engine_event_content_created', fallback: 'Content created' },
  { key: 'content_reported', labelKey: 'admin_rule_engine_event_content_reported', fallback: 'Content reported' },
  { key: 'referral_created', labelKey: 'admin_rule_engine_event_referral_created', fallback: 'Referral created' },
  { key: 'referral_converted', labelKey: 'admin_rule_engine_event_referral_converted', fallback: 'Referral converted' },
  { key: 'subscription_started', labelKey: 'admin_rule_engine_event_subscription_started', fallback: 'Subscription started' },
  { key: 'subscription_ended', labelKey: 'admin_rule_engine_event_subscription_ended', fallback: 'Subscription ended' },
  { key: 'storage_limit', labelKey: 'admin_rule_engine_event_storage_limit', fallback: 'Storage limit reached' },
  { key: 'profile_updated', labelKey: 'admin_rule_engine_event_profile_updated', fallback: 'Profile updated' },
  // DEIE-wired events (all 9 platform events now dispatch rules).
  { key: 'user_followed', labelKey: 'admin_rule_engine_event_user_followed', fallback: 'User followed another creator' },
  { key: 'community_joined', labelKey: 'admin_rule_engine_event_community_joined', fallback: 'User joined a community' },
  { key: 'job_applied', labelKey: 'admin_rule_engine_event_job_applied', fallback: 'User applied to a job' },
  { key: 'order_created', labelKey: 'admin_rule_engine_event_order_created', fallback: 'Order created' },
  { key: 'tip_created', labelKey: 'admin_rule_engine_event_tip_created', fallback: 'Tip sent' },
  { key: 'media_created', labelKey: 'admin_rule_engine_event_media_created', fallback: 'Media uploaded' },
  // Media lifecycle + payment events (generic wildcard dispatcher).
  { key: 'media_broken', labelKey: 'admin_rule_engine_event_media_broken', fallback: 'Media marked broken' },
  { key: 'media_moderated', labelKey: 'admin_rule_engine_event_media_moderated', fallback: 'Media moderated' },
  { key: 'media_recovered', labelKey: 'admin_rule_engine_event_media_recovered', fallback: 'Media recovered' },
  { key: 'media_replaced', labelKey: 'admin_rule_engine_event_media_replaced', fallback: 'Media replaced' },
  { key: 'media_validated', labelKey: 'admin_rule_engine_event_media_validated', fallback: 'Media validated' },
  { key: 'order_paid', labelKey: 'admin_rule_engine_event_order_paid', fallback: 'Order paid' },
  { key: 'custom_event', labelKey: 'admin_rule_engine_event_custom_event', fallback: 'Custom event (JSON)' },
];

const OPERATORS = [
  { key: 'eq', labelKey: 'admin_rule_engine_operator_eq', fallback: 'Equals (=)' },
  { key: 'neq', labelKey: 'admin_rule_engine_operator_neq', fallback: 'Not equals (!=)' },
  { key: 'gt', labelKey: 'admin_rule_engine_operator_gt', fallback: 'Greater than (>)' },
  { key: 'gte', labelKey: 'admin_rule_engine_operator_gte', fallback: 'Greater than or equal (>=)' },
  { key: 'lt', labelKey: 'admin_rule_engine_operator_lt', fallback: 'Less than (<)' },
  { key: 'lte', labelKey: 'admin_rule_engine_operator_lte', fallback: 'Less than or equal (<=)' },
  { key: 'contains', labelKey: 'admin_rule_engine_operator_contains', fallback: 'Contains' },
  { key: 'not_contains', labelKey: 'admin_rule_engine_operator_not_contains', fallback: 'Does not contain' },
  { key: 'in', labelKey: 'admin_rule_engine_operator_in', fallback: 'In list' },
  { key: 'not_in', labelKey: 'admin_rule_engine_operator_not_in', fallback: 'Not in list' },
  { key: 'is_true', labelKey: 'admin_rule_engine_operator_is_true', fallback: 'Is true' },
  { key: 'is_false', labelKey: 'admin_rule_engine_operator_is_false', fallback: 'Is false' },
  { key: 'is_empty', labelKey: 'admin_rule_engine_operator_is_empty', fallback: 'Is empty' },
  { key: 'not_empty', labelKey: 'admin_rule_engine_operator_not_empty', fallback: 'Not empty' },
  { key: 'regex', labelKey: 'admin_rule_engine_operator_regex', fallback: 'Matches regex' },
];

const ACTION_TYPES = [
  { key: 'grant_badge', labelKey: 'admin_rule_engine_action_grant_badge', fallback: 'Grant badge' },
  { key: 'grant_achievement', labelKey: 'admin_rule_engine_action_grant_achievement', fallback: 'Grant achievement' },
  { key: 'send_notification', labelKey: 'admin_rule_engine_action_send_notification', fallback: 'Send notification' },
  { key: 'send_email', labelKey: 'admin_rule_engine_action_send_email', fallback: 'Send email' },
  { key: 'update_role', labelKey: 'admin_rule_engine_action_update_role', fallback: 'Update user role' },
  { key: 'verify_creator', labelKey: 'admin_rule_engine_action_verify_creator', fallback: 'Verify as creator' },
  { key: 'flag_content', labelKey: 'admin_rule_engine_action_flag_content', fallback: 'Flag content for review' },
  { key: 'hide_content', labelKey: 'admin_rule_engine_action_hide_content', fallback: 'Hide content automatically' },
  { key: 'disable_upload', labelKey: 'admin_rule_engine_action_disable_upload', fallback: 'Disable upload' },
  { key: 'create_task', labelKey: 'admin_rule_engine_action_create_task', fallback: 'Create task' },
  { key: 'add_points', labelKey: 'admin_rule_engine_action_add_points', fallback: 'Add points / XP' },
  { key: 'unlock_feature', labelKey: 'admin_rule_engine_action_unlock_feature', fallback: 'Unlock feature' },
  { key: 'webhook', labelKey: 'admin_rule_engine_action_webhook', fallback: 'Call webhook' },
  { key: 'custom_action', labelKey: 'admin_rule_engine_action_custom_action', fallback: 'Custom action (JSON)' },
];

// Starter JSON config per action type — seeded when the admin picks
// the action in the builder (only when the config is still empty).
const ACTION_CONFIG_TEMPLATES = {
  grant_badge: { skill_name: '', level: 'intermediate' },
  grant_achievement: { achievement_key: '' },
  send_notification: { title: '', body: '' },
  send_email: { subject: '', body: '' },
  update_role: { role: 'creator' },
  verify_creator: {},
  flag_content: { target_type: 'profile', target_id: '' },
  hide_content: { payload: { content_type: 'portfolio', content_id: '' } },
  disable_upload: { payload: { reason: '' } },
  create_task: { task_name: 'analytics.rollup' },
  add_points: { points: 10, reason: '' },
  unlock_feature: { feature: '' },
  webhook: { url: '', payload: {} },
  custom_action: { note: '' },
};

function emptyAction(type = 'send_notification') {
  return {
    action_type: type,
    configText: JSON.stringify(ACTION_CONFIG_TEMPLATES[type] || {}, null, 2),
  };
}

// Parse a config JSON textarea. Returns the object, or null when the
// text is invalid JSON (callers show an error instead of saving).
function parseConfigText(text) {
  if (typeof text !== 'string' || !text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
  } catch (_) {
    return null;
  }
}

function emptyRule() {
  return {
    name: '',
    description: '',
    event_type: 'custom_event',
    is_active: true,
    priority: 0,
    cooldown_minutes: 0,
    max_executions_per_user: 0,
    stop_on_match: false,
    conditions: [{ group_key: 'default', logic_group: 'and', field_ref: '', operator: 'eq', value: '' }],
    actions: [emptyAction()],
  };
}

function parseArrayValue(raw, operator) {
  if (operator === 'in' || operator === 'not_in') {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) return '';
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch (_) {}
    }
  }
  return raw;
}

function stringifyValue(val, operator) {
  if (operator === 'in' || operator === 'not_in') {
    if (Array.isArray(val)) return JSON.stringify(val, null, 2);
    return typeof val === 'string' ? val : JSON.stringify(val);
  }
  if (val == null) return '';
  return String(val);
}

export default function AdminRuleEngine({ lang = 'en', translations = {}, showToast }) {
  const t = (key, fallback) => (translations?.[key] || fallback || key);

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyRule);
  const [saving, setSaving] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  // Run modal (evaluate a rule against a real user + event data).
  const [runRule, setRunRule] = useState(null);
  const [runUserId, setRunUserId] = useState('');
  const [runEventData, setRunEventData] = useState('{}');
  const [runResult, setRunResult] = useState(null);
  const [runError, setRunError] = useState('');
  // Recent executions panel.
  const [executions, setExecutions] = useState([]);
  const [showExecutions, setShowExecutions] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('rules/');
      setRules(Array.isArray(res.data.results) ? res.data.results : (Array.isArray(res.data) ? res.data : []));
    } catch (e) {
      showToast?.(t('admin_rule_engine_load_error', 'Failed to load rules'), 'circle-exclamation');
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const fetchExecutions = useCallback(() => {
    // .then/.catch chain: setState only fires after a settled promise,
    // satisfying react-hooks/set-state-in-effect (no sync setState).
    api.get('rule-executions/')
      .then((res) => {
        const list = Array.isArray(res.data.results) ? res.data.results : (Array.isArray(res.data) ? res.data : []);
        setExecutions(list.slice(0, 12));
      })
      .catch(() => setExecutions([]));
  }, []);

  // Fetch executions lazily — only on the first expand of the panel.
  const executionsFetched = useRef(false);
  const toggleExecutions = () => {
    setShowExecutions((v) => {
      const next = !v;
      if (next && !executionsFetched.current) {
        executionsFetched.current = true;
        fetchExecutions();
      }
      return next;
    });
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyRule());
    setShowModal(true);
  };

  const openEdit = (rule) => {
    setEditing(rule);
    setForm({
      name: rule.name || '',
      description: rule.description || '',
      event_type: rule.event_type || 'custom_event',
      is_active: rule.is_active ?? true,
      priority: rule.priority || 0,
      cooldown_minutes: rule.cooldown_minutes || 0,
      max_executions_per_user: rule.max_executions_per_user || 0,
      stop_on_match: rule.stop_on_match || false,
      conditions: (rule.conditions || []).map((c) => ({
        group_key: c.group_key || 'default',
        logic_group: c.logic_group || 'and',
        field_ref: c.field_ref || '',
        operator: c.operator || 'eq',
        value: typeof c.value === 'undefined' ? '' : c.value,
      })),
      actions: (rule.actions || []).map((a) => ({
        action_type: a.action_type || 'send_notification',
        configText: JSON.stringify(a.config_json || {}, null, 2),
      })),
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Validate every action config before touching the API.
      for (const a of form.actions) {
        if (parseConfigText(a.configText) === null) {
          showToast?.(t('admin_rule_engine_bad_json', 'Invalid JSON in an action config'), 'circle-exclamation');
          return;
        }
      }
      const payload = {
        name: form.name,
        description: form.description,
        event_type: form.event_type,
        is_active: form.is_active,
        priority: form.priority,
        cooldown_minutes: form.cooldown_minutes,
        max_executions_per_user: form.max_executions_per_user,
        stop_on_match: form.stop_on_match,
        conditions: form.conditions.map((c) => ({
          group_key: c.group_key,
          logic_group: c.logic_group,
          field_ref: c.field_ref,
          operator: c.operator,
          value: parseArrayValue(c.value, c.operator),
        })),
        actions: form.actions.map((a) => ({
          action_type: a.action_type,
          config_json: parseConfigText(a.configText),
        })),
      };
      if (editing) {
        await api.put(`rules/${editing.id}/`, payload);
        showToast?.(lang === 'ht' ? '✅ Règ mete ajou!' : t('admin_rule_engine_update_rule', 'Rule updated'), 'check-circle');
      } else {
        await api.post('rules/', payload);
        showToast?.(lang === 'ht' ? '✅ Règ kreye!' : t('admin_rule_engine_create_rule', 'Rule created'), 'check-circle');
      }
      setShowModal(false);
      fetchRules();
    } catch (e) {
      showToast?.(e?.response?.data?.detail || e?.message || t('admin_rule_engine_save_error', 'Save failed'), 'circle-exclamation');
    } finally {
      setSaving(false);
    }
  };

  const openRun = (rule) => {
    setRunRule(rule);
    setRunUserId('');
    setRunEventData('{}');
    setRunResult(null);
    setRunError('');
  };

  const handleRunSubmit = async (e) => {
    e.preventDefault();
    if (!runRule) return;
    setEvaluating(true);
    setRunError('');
    setRunResult(null);
    try {
      const user_id = parseInt(runUserId, 10);
      if (!user_id || user_id <= 0) {
        setRunError(t('admin_rule_engine_run_bad_user', 'Enter a valid user id'));
        return;
      }
      let event_data = {};
      try {
        event_data = runEventData.trim() ? JSON.parse(runEventData) : {};
      } catch (_) {
        setRunError(t('admin_rule_engine_run_bad_data', 'event_data must be valid JSON'));
        return;
      }
      const res = await api.post(`rules/${runRule.id}/evaluate/`, { user_id, event_data });
      setRunResult(res.data);
    } catch (err) {
      setRunError(err?.response?.data?.error || err?.message || t('admin_rule_engine_evaluate_error', 'Evaluation failed'));
    } finally {
      setEvaluating(false);
    }
  };

  const handleDelete = async (rule) => {
    if (!window.confirm(`${t('admin_rule_engine_delete_confirm', 'Delete rule')} "${rule.name}"?`)) return;
    try {
      await api.delete(`rules/${rule.id}/`);
      showToast?.(lang === 'ht' ? '✅ Règ efase!' : t('admin_rule_engine_delete', 'Rule deleted'), 'check-circle');
      fetchRules();
    } catch (e) {
      showToast?.(t('admin_rule_engine_delete_error', 'Delete failed'), 'circle-exclamation');
    }
  };

  const updateForm = (patch) => setForm((f) => ({ ...f, ...patch }));

  const renderRows = () => {
    if (!Array.isArray(rules) || rules.length === 0) {
      return <tr><td colSpan="6" style={s.empty}>{t('admin_rule_engine_no_rules', 'No rules yet.')}</td></tr>;
    }
    return rules.map((rule) => (
      <tr key={rule.id}>
        <td style={s.td}>{rule.id}</td>
        <td style={s.td}>{rule.name}</td>
        <td style={s.td}>
          <span style={{ ...s.badge, background: 'var(--pink-light, #fce4ec)', color: 'var(--pink-primary, #d81b60)' }}>
            {rule.event_type}
          </span>
        </td>
        <td style={s.td}>
          <span style={{ ...s.badge, background: rule.is_active ? '#e8f5e9' : '#ffebee', color: rule.is_active ? '#2e7d32' : '#c62828' }}>
            {rule.is_active ? t('admin_rule_engine_active', 'Active') : t('admin_rule_engine_inactive', 'Inactive')}
          </span>
        </td>
        <td style={s.td}>{rule.priority ?? 0}</td>
        <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
          <button type="button" className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => openEdit(rule)}>
            <i className="fas fa-pen" /> {t('admin_rule_engine_edit', 'Edit')}
          </button>
          <button type="button" className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem', marginLeft: '6px' }} onClick={() => openRun(rule)}>
            <i className="fas fa-play" /> {t('admin_rule_engine_run', 'Run')}
          </button>
          <button type="button" className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem', marginLeft: '6px', color: '#c62828' }} onClick={() => handleDelete(rule)}>
            <i className="fas fa-trash" />
          </button>
        </td>
      </tr>
    ));
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.title}>
          <i className="fas fa-gears" style={{ marginRight: '8px' }} />
          {t('admin_rule_engine_page_title', 'Rule Engine')}
        </div>
        <button type="button" style={{ ...s.btn, ...s.btnPrimary }} onClick={openCreate}>
          <i className="fas fa-plus" /> {t('admin_rule_engine_new_rule', 'New Rule')}
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>#</th>
              <th style={s.th}>{t('admin_rule_engine_tab_name', 'Name')}</th>
              <th style={s.th}>{t('admin_rule_engine_tab_event', 'Event')}</th>
              <th style={s.th}>{t('admin_rule_engine_tab_status', 'Status')}</th>
              <th style={s.th}>{t('admin_rule_engine_tab_priority', 'Priority')}</th>
              <th style={s.th}>{t('admin_rule_engine_tab_actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>{renderRows()}</tbody>
        </table>
      </div>

      {/* ── Recent executions ────────────────────────────────────── */}
      <div style={{ marginTop: '1.5rem' }}>
        <button type="button" style={{ ...s.btn, ...s.btnSecondary }} onClick={toggleExecutions}>
          <i className="fas fa-clock-rotate-left" style={{ marginRight: '6px' }} />
          {t('admin_rule_engine_executions', 'Recent executions')} ({executions.length})
        </button>
        {showExecutions && (
          <div style={{ marginTop: '12px', overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>#</th>
                  <th style={s.th}>{t('admin_rule_engine_tab_name', 'Rule')}</th>
                  <th style={s.th}>User</th>
                  <th style={s.th}>{t('admin_rule_engine_tab_status', 'Result')}</th>
                  <th style={s.th}>{t('admin_rule_engine_priority', 'When')}</th>
                </tr>
              </thead>
              <tbody>
                {executions.length === 0 && (
                  <tr><td colSpan="5" style={s.empty}>{t('admin_rule_engine_no_executions', 'No executions yet.')}</td></tr>
                )}
                {executions.map((ex) => (
                  <tr key={ex.id}>
                    <td style={s.td}>{ex.id}</td>
                    <td style={s.td}>{ex.rule_name || `#${ex.rule}`}</td>
                    <td style={s.td}>{ex.username || `#${ex.user}`}</td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, background: ex.result === 'conditions_met' ? '#e8f5e9' : ex.result === 'skipped' ? '#fff3e0' : '#ffebee', color: ex.result === 'conditions_met' ? '#2e7d32' : ex.result === 'skipped' ? '#e65100' : '#c62828' }}>
                        {ex.result}
                      </span>
                      {ex.result_message && (
                        <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary, #666)', marginTop: '2px' }}>{ex.result_message}</span>
                      )}
                    </td>
                    <td style={s.td}>{ex.created_at ? new Date(ex.created_at).toLocaleString() : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Run / evaluate modal ─────────────────────────────────── */}
      {runRule && (
        <div style={s.modal} onClick={() => setRunRule(null)}>
          <div style={s.modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>
              <i className="fas fa-play" style={{ marginRight: '8px', color: 'var(--pink-primary, #d81b60)' }} />
              {t('admin_rule_engine_run_title', 'Run rule')}: {runRule.name}
            </h2>
            <form onSubmit={handleRunSubmit}>
              <div style={s.formRow}>
                <label style={{ fontSize: '0.85rem' }}>
                  {t('admin_rule_engine_run_user', 'User ID')}
                  <input style={s.input} type="number" min="1" value={runUserId} onChange={(e) => setRunUserId(e.target.value)} placeholder="123" required />
                </label>
                <label style={{ fontSize: '0.85rem' }}>
                  event_data <span style={{ fontWeight: 400 }}>({t('admin_rule_engine_run_event_hint', 'JSON')})</span>
                  <textarea
                    style={{ ...s.input, minHeight: '110px', fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 1.4, resize: 'vertical' }}
                    value={runEventData}
                    onChange={(e) => setRunEventData(e.target.value)}
                    placeholder='{"course_count": 5}'
                  />
                </label>
              </div>

              {runError && <div style={{ color: '#c62828', fontSize: '0.85rem', marginBottom: '10px' }}>{runError}</div>}

              {runResult && (
                <div style={{ background: 'var(--bg-secondary, #f8f9fa)', borderRadius: '10px', padding: '12px', marginBottom: '12px', border: '1px solid var(--border-color, #e0e0e0)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ ...s.badge, padding: '4px 10px', background: runResult.result === 'conditions_met' ? '#e8f5e9' : runResult.result === 'skipped' ? '#fff3e0' : '#ffebee', color: runResult.result === 'conditions_met' ? '#2e7d32' : runResult.result === 'skipped' ? '#e65100' : '#c62828' }}>
                      {runResult.result}
                    </span>
                    {runResult.execution_time_ms != null && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #666)' }}>{runResult.execution_time_ms} ms</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>{runResult.result_message}</div>
                  {(runResult.actions_taken || []).length > 0 && (
                    <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '0.82rem' }}>
                      {(runResult.actions_taken || []).map((a, ai) => (
                        <li key={ai} style={{ color: a.success ? 'var(--text-main, #1a1a1a)' : '#c62828', marginBottom: '2px' }}>
                          <b>{a.action_type}</b>: {a.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div style={s.actions}>
                <button type="button" style={{ ...s.btn, ...s.btnSecondary }} onClick={() => setRunRule(null)} disabled={evaluating}>
                  {t('admin_rule_engine_cancel', 'Close')}
                </button>
                <button type="submit" style={{ ...s.btn, ...s.btnPrimary }} disabled={evaluating}>
                  <i className="fas fa-play" style={{ marginRight: '6px' }} />
                  {evaluating ? '...' : t('admin_rule_engine_run', 'Run')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showModal && (
        <div style={s.modal} onClick={() => setShowModal(false)}>
          <div style={s.modalCard} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>
              {editing ? t('admin_rule_engine_edit_rule', 'Edit Rule') : t('admin_rule_engine_new_rule', 'New Rule')}
            </h2>
            <form onSubmit={handleSave}>
              <div style={s.formRow}>
                <input style={s.input} placeholder={t('admin_rule_engine_placeholder_name', 'Rule name')} value={form.name} onChange={(e) => updateForm({ name: e.target.value })} required />
                <select style={s.select} value={form.event_type} onChange={(e) => updateForm({ event_type: e.target.value })}>
                  {EVENT_TYPES.map((et) => <option key={et.key} value={et.key}>{t(et.labelKey, et.fallback)}</option>)}
                </select>
              </div>
              <textarea style={{ ...s.input, minHeight: '60px', marginBottom: '12px' }} placeholder={t('admin_rule_engine_placeholder_description', 'Description')} value={form.description} onChange={(e) => updateForm({ description: e.target.value })} />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' }}>
                <label style={{ fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={form.is_active} onChange={(e) => updateForm({ is_active: e.target.checked })} /> {t('admin_rule_engine_active_checkbox', 'Active')}
                </label>
                <label style={{ fontSize: '0.85rem' }}>
                  {t('admin_rule_engine_priority', 'Priority:')} <input type="number" style={{ ...s.input, width: '80px', padding: '4px 8px' }} value={form.priority} onChange={(e) => updateForm({ priority: parseInt(e.target.value || '0', 10) })} />
                </label>
                <label style={{ fontSize: '0.85rem' }}>
                  {t('admin_rule_engine_cooldown', 'Cooldown (min):')} <input type="number" style={{ ...s.input, width: '80px', padding: '4px 8px' }} value={form.cooldown_minutes} onChange={(e) => updateForm({ cooldown_minutes: parseInt(e.target.value || '0', 10) })} />
                </label>
              </div>

              <div style={s.sectionTitle}>{t('admin_rule_engine_section_conditions', 'Conditions')}</div>
              {form.conditions.map((cond, i) => {
                const isArrayOp = cond.operator === 'in' || cond.operator === 'not_in';
                const displayValue = stringifyValue(cond.value, cond.operator);
                return (
                  <div key={i} style={s.conditionRow}>
                    <input style={s.input} placeholder={t('admin_rule_engine_placeholder_field', 'field_ref')} value={cond.field_ref} onChange={(e) => {
                      const next = [...form.conditions]; next[i] = { ...next[i], field_ref: e.target.value }; updateForm({ conditions: next });
                    }} />
                    <select style={s.select} value={cond.operator} onChange={(e) => {
                      const next = [...form.conditions]; next[i] = { ...next[i], operator: e.target.value }; updateForm({ conditions: next });
                    }}>
                      {OPERATORS.map((op) => <option key={op.key} value={op.key}>{t(op.labelKey, op.fallback)}</option>)}
                    </select>
                    {isArrayOp ? (
                      <textarea
                        style={{ ...s.input, minHeight: '60px', fontFamily: 'monospace', fontSize: '0.8rem' }}
                        placeholder={t('admin_rule_engine_placeholder_value', 'value') + ' (JSON array)'}
                        value={displayValue}
                        onChange={(e) => {
                          const next = [...form.conditions];
                          next[i] = { ...next[i], value: parseArrayValue(e.target.value, cond.operator) };
                          updateForm({ conditions: next });
                        }}
                      />
                    ) : (
                      <input style={s.input} placeholder={t('admin_rule_engine_placeholder_value', 'value')} value={displayValue} onChange={(e) => {
                        const next = [...form.conditions]; next[i] = { ...next[i], value: e.target.value }; updateForm({ conditions: next });
                      }} />
                    )}
                    <button type="button" style={{ ...s.btn, ...s.btnSecondary }} onClick={() => {
                      const next = form.conditions.filter((_, idx) => idx !== i);
                      updateForm({ conditions: next.length ? next : [{ group_key: 'default', logic_group: 'and', field_ref: '', operator: 'eq', value: '' }] });
                    }}>
                      <i className="fas fa-trash" />
                    </button>
                  </div>
                );
              })}
              <button type="button" style={{ ...s.btn, ...s.btnSecondary, marginBottom: '12px' }} onClick={() => updateForm({ conditions: [...form.conditions, { group_key: 'default', logic_group: 'and', field_ref: '', operator: 'eq', value: '' }] })}>
                <i className="fas fa-plus" /> {t('admin_rule_engine_add_condition', 'Add Condition')}
              </button>

              <div style={s.sectionTitle}>{t('admin_rule_engine_section_actions', 'Actions')}</div>
              {form.actions.map((act, i) => (
                <div key={i} style={{ ...s.actionRow, gridTemplateColumns: '1fr 1.6fr auto' }}>
                  <select style={s.select} value={act.action_type} onChange={(e) => {
                    const type = e.target.value;
                    const next = [...form.actions];
                    const cur = parseConfigText(next[i].configText);
                    const empty = !next[i].configText || !next[i].configText.trim() || (cur && Object.keys(cur).length === 0);
                    next[i] = {
                      ...next[i],
                      action_type: type,
                      // Seed the starter template only while the config is empty.
                      configText: empty ? JSON.stringify(ACTION_CONFIG_TEMPLATES[type] || {}, null, 2) : next[i].configText,
                    };
                    updateForm({ actions: next });
                  }}>
                    {ACTION_TYPES.map((at) => <option key={at.key} value={at.key}>{t(at.labelKey, at.fallback)}</option>)}
                  </select>
                  <textarea
                    style={{ ...s.input, minHeight: '64px', fontFamily: 'monospace', fontSize: '0.78rem', lineHeight: 1.4, resize: 'vertical' }}
                    placeholder={t('admin_rule_engine_placeholder_config', 'config_json (JSON)')}
                    value={act.configText}
                    onChange={(e) => {
                      const next = [...form.actions]; next[i] = { ...next[i], configText: e.target.value }; updateForm({ actions: next });
                    }}
                  />
                  <button type="button" style={{ ...s.btn, ...s.btnSecondary }} onClick={() => {
                    const next = form.actions.filter((_, idx) => idx !== i);
                    updateForm({ actions: next.length ? next : [emptyAction()] });
                  }}>
                    <i className="fas fa-trash" />
                  </button>
                </div>
              ))}
              <button type="button" style={{ ...s.btn, ...s.btnSecondary, marginBottom: '12px' }} onClick={() => updateForm({ actions: [...form.actions, emptyAction()] })}>
                <i className="fas fa-plus" /> {t('admin_rule_engine_add_action', 'Add Action')}
              </button>

              <div style={s.actions}>
                <button type="button" style={{ ...s.btn, ...s.btnSecondary }} onClick={() => setShowModal(false)} disabled={saving}>{t('admin_rule_engine_cancel', 'Cancel')}</button>
                <button type="submit" style={{ ...s.btn, ...s.btnPrimary }} disabled={saving}>
                  {saving ? t('admin_rule_engine_saving', 'Saving...') : (editing ? t('admin_rule_engine_update_rule', 'Update') : t('admin_rule_engine_create_rule', 'Create'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
