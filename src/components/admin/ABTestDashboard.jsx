/**
 * src/components/admin/ABTestDashboard.jsx
 *
 * A/B Testing Dashboard for Algorithm Experimentation.
 * Visualizes test results, manages experiments, and shows statistical significance.
 *
 * Features:
 *   - List all A/B tests with status
 *   - Create new tests
 *   - View test results with charts
 *   - Pause/resume/complete tests
 *   - Statistical significance calculator
 */
import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

// ─── Status Badge ──────────────────────────────────────────────────
function StatusBadge({ status }) {
  const colors = {
    draft: { bg: '#e5e7eb', text: '#374151' },
    running: { bg: '#dcfce7', text: '#166534' },
    paused: { bg: '#fef3c7', text: '#92400e' },
    completed: { bg: '#dbeafe', text: '#1e40af' },
    cancelled: { bg: '#fee2e2', text: '#991b1b' },
  };
  const style = colors[status] || colors.draft;
  return (
    <span
      className="ab-status-badge"
      style={{ background: style.bg, color: style.text }}
    >
      {status}
    </span>
  );
}

// ─── Variant Card ──────────────────────────────────────────────────
function VariantCard({ variant, data, label }) {
  const ctr = data.impressions > 0
    ? ((data.clicks / data.impressions) * 100).toFixed(2)
    : '0.00';
  const saveRate = data.impressions > 0
    ? ((data.saves / data.impressions) * 100).toFixed(2)
    : '0.00';

  return (
    <div className="ab-variant-card">
      <div className="ab-variant-header">
        <span className="ab-variant-label">{label}</span>
        <span className="ab-variant-badge">Variant {variant}</span>
      </div>
      <div className="ab-variant-stats">
        <div className="ab-stat">
          <span className="ab-stat-value">{data.impressions.toLocaleString()}</span>
          <span className="ab-stat-label">Impressions</span>
        </div>
        <div className="ab-stat">
          <span className="ab-stat-value">{data.clicks.toLocaleString()}</span>
          <span className="ab-stat-label">Clicks</span>
        </div>
        <div className="ab-stat">
          <span className="ab-stat-value">{ctr}%</span>
          <span className="ab-stat-label">CTR</span>
        </div>
        <div className="ab-stat">
          <span className="ab-stat-value">{data.saves.toLocaleString()}</span>
          <span className="ab-stat-label">Saves</span>
        </div>
        <div className="ab-stat">
          <span className="ab-stat-value">{saveRate}%</span>
          <span className="ab-stat-label">Save Rate</span>
        </div>
      </div>
    </div>
  );
}

// ─── Significance Badge ────────────────────────────────────────────
function SignificanceBadge({ significance }) {
  if (!significance) return null;

  const { is_significant, confidence, p_value, lift, message } = significance;

  return (
    <div className={`ab-significance ${is_significant ? 'ab-significant' : 'ab-not-significant'}`}>
      <div className="ab-sig-header">
        <i className={`fas ${is_significant ? 'fa-check-circle' : 'fa-clock'}`} />
        <span>{is_significant ? 'Statistically Significant' : 'Not Yet Significant'}</span>
      </div>
      <div className="ab-sig-details">
        <div className="ab-sig-item">
          <span className="ab-sig-label">Confidence:</span>
          <span className="ab-sig-value">{confidence}%</span>
        </div>
        <div className="ab-sig-item">
          <span className="ab-sig-label">P-value:</span>
          <span className="ab-sig-value">{p_value}</span>
        </div>
        {lift !== undefined && (
          <div className="ab-sig-item">
            <span className="ab-sig-label">Lift:</span>
            <span className={`ab-sig-value ${lift > 0 ? 'ab-positive' : 'ab-negative'}`}>
              {lift > 0 ? '+' : ''}{lift}%
            </span>
          </div>
        )}
      </div>
      <div className="ab-sig-message">{message}</div>
    </div>
  );
}

// ─── Test Form ─────────────────────────────────────────────────────
function TestForm({ onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    algorithm_config_a: JSON.stringify({
      w_trending: 1.0,
      w_popularity: 1.0,
      w_engagement: 1.5,
      w_quality: 0.8,
      w_spam: 2.0,
      w_freshness: 1.2,
      personalized_scale: 0.4,
    }, null, 2),
    algorithm_config_b: JSON.stringify({
      w_trending: 1.5,
      w_popularity: 1.0,
      w_engagement: 1.5,
      w_quality: 0.8,
      w_spam: 2.0,
      w_freshness: 1.2,
      personalized_scale: 0.4,
    }, null, 2),
    traffic_split: 0.5,
    start_date: '',
    end_date: '',
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        algorithm_config_a: JSON.parse(formData.algorithm_config_a),
        algorithm_config_b: JSON.parse(formData.algorithm_config_b),
        traffic_split: parseFloat(formData.traffic_split),
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        status: 'draft',
      };
      onSubmit(payload);
    } catch (err) {
      alert('Invalid JSON in algorithm config');
    }
  };

  return (
    <form className="ab-test-form" onSubmit={handleSubmit}>
      <h3><i className="fas fa-flask" /> Create New A/B Test</h3>

      <div className="ab-form-group">
        <label>Test Name *</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="e.g., trending_weight_v2"
          required
        />
      </div>

      <div className="ab-form-group">
        <label>Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="What this test is measuring..."
          rows={3}
        />
      </div>

      <div className="ab-form-row">
        <div className="ab-form-group">
          <label>Control (A) Config *</label>
          <textarea
            value={formData.algorithm_config_a}
            onChange={(e) => handleChange('algorithm_config_a', e.target.value)}
            rows={10}
            className="ab-json-editor"
          />
        </div>
        <div className="ab-form-group">
          <label>Treatment (B) Config *</label>
          <textarea
            value={formData.algorithm_config_b}
            onChange={(e) => handleChange('algorithm_config_b', e.target.value)}
            rows={10}
            className="ab-json-editor"
          />
        </div>
      </div>

      <div className="ab-form-row">
        <div className="ab-form-group">
          <label>Traffic Split (0.0 - 1.0)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={formData.traffic_split}
            onChange={(e) => handleChange('traffic_split', e.target.value)}
          />
          <span className="ab-form-hint">{(formData.traffic_split * 100).toFixed(0)}% → Treatment (B)</span>
        </div>
        <div className="ab-form-group">
          <label>Start Date</label>
          <input
            type="datetime-local"
            value={formData.start_date}
            onChange={(e) => handleChange('start_date', e.target.value)}
          />
        </div>
        <div className="ab-form-group">
          <label>End Date</label>
          <input
            type="datetime-local"
            value={formData.end_date}
            onChange={(e) => handleChange('end_date', e.target.value)}
          />
        </div>
      </div>

      <div className="ab-form-actions">
        <button type="button" className="ab-btn ab-btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="ab-btn ab-btn-primary">
          <i className="fas fa-plus" /> Create Test
        </button>
      </div>
    </form>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────
export default function ABTestDashboard({ t, lang = 'ht' }) {
  const [tests, setTests] = useState([]);
  const [selectedTest, setSelectedTest] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/ab-tests/');
      setTests(res.data.results || res.data);
    } catch (err) {
      console.error('Failed to fetch A/B tests:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async (testId) => {
    try {
      const res = await api.get(`/admin/ab-tests/${testId}/`, {
        params: { include_stats: true }
      });
      setSelectedTest(res.data);
      setStats(res.data.stats);
    } catch (err) {
      console.error('Failed to fetch test stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchTests();
  }, [fetchTests]);

  const handleCreateTest = async (payload) => {
    try {
      await api.post('/admin/ab-tests/', payload);
      setShowForm(false);
      fetchTests();
    } catch (err) {
      alert('Failed to create test: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleAction = async (testId, action, data = {}) => {
    try {
      setActionLoading(true);
      await api.post(`/admin/ab-tests/${testId}/${action}/`, data);
      fetchTests();
      if (selectedTest?.id === testId) {
        fetchStats(testId);
      }
    } catch (err) {
      alert(`Failed to ${action} test: ` + (err.response?.data?.detail || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = (testId) => {
    const winner = prompt('Winner? (A for control, B for treatment, or empty)');
    if (winner === null) return;
    handleAction(testId, 'complete', { winner: winner || null });
  };

  return (
    <div className="ab-dashboard">
      <div className="ab-header">
        <h2><i className="fas fa-flask" /> A/B Testing Dashboard</h2>
        <button
          className="ab-btn ab-btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          <i className="fas fa-plus" /> New Test
        </button>
      </div>

      {showForm && (
        <TestForm
          onSubmit={handleCreateTest}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="ab-content">
        {/* Test List */}
        <div className="ab-test-list">
          <h3>Experiments</h3>
          {loading ? (
            <div className="ab-loading">Loading...</div>
          ) : tests.length === 0 ? (
            <div className="ab-empty">No A/B tests yet. Create your first experiment!</div>
          ) : (
            <div className="ab-test-cards">
              {tests.map((test) => (
                <div
                  key={test.id}
                  className={`ab-test-card ${selectedTest?.id === test.id ? 'ab-selected' : ''}`}
                  onClick={() => fetchStats(test.id)}
                >
                  <div className="ab-test-card-header">
                    <span className="ab-test-name">{test.name}</span>
                    <StatusBadge status={test.status} />
                  </div>
                  {test.description && (
                    <div className="ab-test-desc">{test.description}</div>
                  )}
                  <div className="ab-test-meta">
                    <span><i className="fas fa-percentage" /> {(test.traffic_split * 100).toFixed(0)}% → B</span>
                    {test.winner && (
                      <span className="ab-winner"><i className="fas fa-trophy" /> Winner: {test.winner}</span>
                    )}
                  </div>
                  <div className="ab-test-actions">
                    {test.status === 'running' && (
                      <>
                        <button
                          className="ab-btn ab-btn-sm ab-btn-warning"
                          onClick={(e) => { e.stopPropagation(); handleAction(test.id, 'pause'); }}
                          disabled={actionLoading}
                        >
                          <i className="fas fa-pause" />
                        </button>
                        <button
                          className="ab-btn ab-btn-sm ab-btn-success"
                          onClick={(e) => { e.stopPropagation(); handleComplete(test.id); }}
                          disabled={actionLoading}
                        >
                          <i className="fas fa-flag-checkered" />
                        </button>
                      </>
                    )}
                    {test.status === 'paused' && (
                      <button
                        className="ab-btn ab-btn-sm ab-btn-primary"
                        onClick={(e) => { e.stopPropagation(); handleAction(test.id, 'resume'); }}
                        disabled={actionLoading}
                      >
                        <i className="fas fa-play" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Test Details */}
        <div className="ab-test-details">
          {selectedTest ? (
            <>
              <div className="ab-details-header">
                <h3>{selectedTest.name}</h3>
                <StatusBadge status={selectedTest.status} />
              </div>

              {selectedTest.description && (
                <p className="ab-details-desc">{selectedTest.description}</p>
              )}

              {/* Variant Comparison */}
              <div className="ab-variants">
                <VariantCard
                  variant="A"
                  data={stats?.variant_a || { impressions: 0, clicks: 0, saves: 0 }}
                  label="Control"
                />
                <div className="ab-vs">VS</div>
                <VariantCard
                  variant="B"
                  data={stats?.variant_b || { impressions: 0, clicks: 0, saves: 0 }}
                  label="Treatment"
                />
              </div>

              {/* Significance */}
              <SignificanceBadge significance={stats?.significance} />

              {/* Algorithm Configs */}
              <div className="ab-configs">
                <h4>Algorithm Configurations</h4>
                <div className="ab-configs-row">
                  <div className="ab-config">
                    <h5>Control (A)</h5>
                    <pre>{JSON.stringify(selectedTest.algorithm_config_a, null, 2)}</pre>
                  </div>
                  <div className="ab-config">
                    <h5>Treatment (B)</h5>
                    <pre>{JSON.stringify(selectedTest.algorithm_config_b, null, 2)}</pre>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="ab-empty-details">
              <i className="fas fa-mouse-pointer" />
              <p>Select a test to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
