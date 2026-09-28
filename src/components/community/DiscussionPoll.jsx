/**
 * src/components/community/DiscussionPoll.jsx
 *
 * Discussion Polls/Surveys for Community Discussions.
 *
 * Features:
 *   - Single choice, multiple choice, yes/no polls
 *   - Anonymous voting option
 *   - Live results with animated bar charts
 *   - Poll expiration
 *   - Edit/delete polls (creator only)
 *   - Multiple polls per discussion
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../services/api';

// ─── Constants ────────────────────────────────────────────────────

const POLL_TYPES = {
  single: { label: 'Single Choice', icon: 'fa-circle-dot', maxOptions: 10 },
  multiple: { label: 'Multiple Choice', icon: 'fa-check-double', maxOptions: 10 },
  yes_no: { label: 'Yes / No', icon: 'fa-circle-question', maxOptions: 2 },
};

const POLL_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

// ─── Helpers ──────────────────────────────────────────────────────

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleDateString();
}

function formatTimeRemaining(endDate) {
  if (!endDate) return null;
  const end = new Date(endDate);
  const now = new Date();
  const diff = end - now;
  if (diff <= 0) return 'Ended';

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h left`;
  const minutes = Math.floor((diff % 3600000) / 60000);
  return `${minutes}m left`;
}

// ─── Poll Option ──────────────────────────────────────────────────

function PollOption({ option, index, selected, showResults, totalVotes, onVote, pollType }) {
  const percentage = totalVotes > 0 ? Math.round((option.votes || 0) / totalVotes * 100) : 0;
  const isSelected = selected === index || (Array.isArray(selected) && selected.includes(index));
  const color = POLL_COLORS[index % POLL_COLORS.length];

  if (showResults) {
    return (
      <div className={`poll-option poll-option-result ${isSelected ? 'poll-option-voted' : ''}`}>
        <div className="poll-option-bar" style={{ width: `${percentage}%`, background: color }} />
        <div className="poll-option-content">
          <div className="poll-option-left">
            <div className="poll-option-check" style={{ borderColor: color, background: isSelected ? color : 'white' }}>
              {isSelected && <i className="fas fa-check" />}
            </div>
            <span className="poll-option-text">{option.text}</span>
          </div>
          <div className="poll-option-right">
            <span className="poll-option-votes">{option.votes || 0}</span>
            <span className="poll-option-percent">{percentage}%</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      className={`poll-option ${isSelected ? 'poll-option-selected' : ''}`}
      onClick={() => onVote(index)}
    >
      <div className="poll-option-left">
        <div className="poll-option-radio" style={{ borderColor: color }}>
          {isSelected && <div className="poll-option-radio-inner" style={{ background: color }} />}
        </div>
        <span className="poll-option-text">{option.text}</span>
      </div>
    </button>
  );
}

// ─── Poll Creator ─────────────────────────────────────────────────

function PollCreator({ onSubmit, onCancel, lang }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [pollType, setPollType] = useState('single');
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');

  const handleAddOption = () => {
    if (options.length < POLL_TYPES[pollType].maxOptions) {
      setOptions([...options, '']);
    }
  };

  const handleRemoveOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validOptions = options.filter(o => o.trim());
    if (!question.trim() || validOptions.length < 2) return;

    onSubmit({
      question: question.trim(),
      options: validOptions.map(text => ({ text: text.trim(), votes: 0 })),
      poll_type: pollType,
      allow_multiple: allowMultiple || pollType === 'multiple',
      anonymous,
      expires_at: expiresAt || null,
    });

    setQuestion('');
    setOptions(['', '']);
  };

  return (
    <form className="poll-creator" onSubmit={handleSubmit}>
      <h4>
        <i className="fas fa-chart-bar" />
        {lang === 'ht' ? 'Kreye yon Sondaj' : 'Create a Poll'}
      </h4>

      <div className="poll-form-group">
        <label>{lang === 'ht' ? 'Kesyon' : 'Question'} *</label>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={lang === 'ht' ? 'Eskri kesyon ou a...' : 'Enter your question...'}
          required
          maxLength={300}
        />
      </div>

      <div className="poll-form-group">
        <label>{lang === 'ht' ? 'Kalite Sondaj' : 'Poll Type'}</label>
        <div className="poll-type-selector">
          {Object.entries(POLL_TYPES).map(([key, val]) => (
            <button
              key={key}
              type="button"
              className={`poll-type-btn ${pollType === key ? 'poll-type-active' : ''}`}
              onClick={() => { setPollType(key); setOptions(key === 'yes_no' ? ['Yes', 'No'] : ['', '']); }}
            >
              <i className={`fas ${val.icon}`} /> {val.label}
            </button>
          ))}
        </div>
      </div>

      <div className="poll-form-group">
        <label>{lang === 'ht' ? 'Opsyon' : 'Options'} *</label>
        <div className="poll-options-editor">
          {options.map((opt, idx) => (
            <div key={idx} className="poll-option-input">
              <div className="poll-option-dot" style={{ background: POLL_COLORS[idx % POLL_COLORS.length] }} />
              <input
                type="text"
                value={opt}
                onChange={(e) => handleOptionChange(idx, e.target.value)}
                placeholder={lang === 'ht' ? `Opsyon ${idx + 1}` : `Option ${idx + 1}`}
                disabled={pollType === 'yes_no'}
                maxLength={200}
              />
              {options.length > 2 && pollType !== 'yes_no' && (
                <button type="button" className="poll-option-remove" onClick={() => handleRemoveOption(idx)}>
                  <i className="fas fa-times" />
                </button>
              )}
            </div>
          ))}
          {options.length < POLL_TYPES[pollType].maxOptions && pollType !== 'yes_no' && (
            <button type="button" className="poll-add-option" onClick={handleAddOption}>
              <i className="fas fa-plus" /> {lang === 'ht' ? 'Ajoute Opsyon' : 'Add Option'}
            </button>
          )}
        </div>
      </div>

      <div className="poll-form-group">
        <label>{lang === 'ht' ? 'Opsyon Ekstra' : 'Extra Options'}</label>
        <div className="poll-checkboxes">
          <label className="poll-checkbox">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
            />
            <span>{lang === 'ht' ? 'Anonim' : 'Anonymous voting'}</span>
          </label>
          <label className="poll-checkbox">
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            <span>{lang === 'ht' ? 'Ekspire' : 'Expires at'}</span>
          </label>
        </div>
      </div>

      <div className="poll-form-actions">
        <button type="button" className="poll-btn poll-btn-cancel" onClick={onCancel}>
          {lang === 'ht' ? 'Anile' : 'Cancel'}
        </button>
        <button type="submit" className="poll-btn poll-btn-submit">
          <i className="fas fa-chart-bar" /> {lang === 'ht' ? 'Kreye Sondaj' : 'Create Poll'}
        </button>
      </div>
    </form>
  );
}

// ─── Main Poll Component ──────────────────────────────────────────

export function DiscussionPoll({ poll, onVote, onDelete, currentUserId, lang = 'ht' }) {
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [localPoll, setLocalPoll] = useState(poll);

  useEffect(() => {
    setLocalPoll(poll);
    if (poll.user_vote !== undefined && poll.user_vote !== null) {
      setHasVoted(true);
      setShowResults(true);
      if (Array.isArray(poll.user_vote)) {
        setSelectedOptions(poll.user_vote);
      } else {
        setSelectedOptions([poll.user_vote]);
      }
    }
  }, [poll]);

  const totalVotes = useMemo(() => {
    return (localPoll.options || []).reduce((sum, opt) => sum + (opt.votes || 0), 0);
  }, [localPoll.options]);

  const isEnded = localPoll.expires_at && new Date(localPoll.expires_at) <= new Date();
  const timeRemaining = formatTimeRemaining(localPoll.expires_at);

  const handleVote = async (optionIndex) => {
    if (hasVoted || isEnded) return;

    let newSelected;
    if (localPoll.allow_multiple) {
      newSelected = selectedOptions.includes(optionIndex)
        ? selectedOptions.filter(i => i !== optionIndex)
        : [...selectedOptions, optionIndex];
      setSelectedOptions(newSelected);
    } else {
      newSelected = [optionIndex];
      setSelectedOptions(newSelected);
    }
  };

  const handleSubmitVote = async () => {
    if (selectedOptions.length === 0 || hasVoted || isEnded) return;

    try {
      const res = await api.post(`/communities/polls/${localPoll.id}/vote/`, {
        option_indices: selectedOptions,
      });
      setLocalPoll(res.data);
      setHasVoted(true);
      setShowResults(true);
      onVote?.(localPoll.id, selectedOptions);
    } catch (err) {
      console.error('Failed to vote:', err);
    }
  };

  const handleShowResults = () => {
    setShowResults(true);
  };

  const isCreator = currentUserId === localPoll.created_by;

  return (
    <div className={`poll-container ${hasVoted ? 'poll-voted' : ''} ${isEnded ? 'poll-ended' : ''}`}>
      <div className="poll-header">
        <div className="poll-question">
          <i className="fas fa-chart-bar" />
          <span>{localPoll.question}</span>
        </div>
        {isEnded && <span className="poll-badge poll-badge-ended">Ended</span>}
        {localPoll.anonymous && (
          <span className="poll-badge poll-badge-anonymous">
            <i className="fas fa-user-secret" /> Anonymous
          </span>
        )}
      </div>

      <div className="poll-options">
        {(localPoll.options || []).map((option, idx) => (
          <PollOption
            key={idx}
            option={option}
            index={idx}
            selected={selectedOptions}
            showResults={showResults}
            totalVotes={totalVotes}
            onVote={handleVote}
            pollType={localPoll.poll_type}
          />
        ))}
      </div>

      <div className="poll-footer">
        <div className="poll-stats">
          <span className="poll-total-votes">
            <i className="fas fa-users" /> {totalVotes} {lang === 'ht' ? 'vòt' : 'votes'}
          </span>
          {timeRemaining && !isEnded && (
            <span className="poll-time-remaining">
              <i className="fas fa-clock" /> {timeRemaining}
            </span>
          )}
        </div>

        <div className="poll-actions">
          {!hasVoted && !isEnded && (
            <>
              {selectedOptions.length > 0 && (
                <button className="poll-btn poll-btn-vote" onClick={handleSubmitVote}>
                  <i className="fas fa-check" /> {lang === 'ht' ? 'Vòte' : 'Vote'}
                </button>
              )}
              {!showResults && (
                <button className="poll-btn poll-btn-results" onClick={handleShowResults}>
                  {lang === 'ht' ? 'Wè Rezilta' : 'View Results'}
                </button>
              )}
            </>
          )}
          {isCreator && (
            <button className="poll-btn poll-btn-delete" onClick={() => onDelete?.(localPoll.id)}>
              <i className="fas fa-trash" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Poll List (for displaying multiple polls in a discussion) ────

export function DiscussionPolls({ polls, community, discussionId, onPollCreated, onPollDeleted, currentUserId, lang = 'ht', showToast }) {
  const [showCreator, setShowCreator] = useState(false);

  const handleCreatePoll = async (pollData) => {
    try {
      const res = await api.post('/communities/polls/', {
        ...pollData,
        discussion: discussionId,
        community: community?.id,
      });
      setShowCreator(false);
      onPollCreated?.(res.data);
      showToast?.(lang === 'ht' ? 'Sondaj kreye!' : 'Poll created!', 'success');
    } catch (err) {
      showToast?.(lang === 'ht' ? 'Erè nan kreyasyon' : 'Error creating poll', 'error');
    }
  };

  const handleDeletePoll = async (pollId) => {
    try {
      await api.delete(`/communities/polls/${pollId}/`);
      onPollDeleted?.(pollId);
      showToast?.(lang === 'ht' ? 'Sondaj efase!' : 'Poll deleted!', 'success');
    } catch (err) {
      showToast?.(lang === 'ht' ? 'Erè' : 'Error', 'error');
    }
  };

  return (
    <div className="polls-section">
      <div className="polls-header">
        <h4>
          <i className="fas fa-chart-bar" />
          {lang === 'ht' ? 'Sondaj' : 'Polls'} ({polls?.length || 0})
        </h4>
        {!showCreator && (
          <button className="poll-btn poll-btn-add" onClick={() => setShowCreator(true)}>
            <i className="fas fa-plus" /> {lang === 'ht' ? 'Ajoute Sondaj' : 'Add Poll'}
          </button>
        )}
      </div>

      {showCreator && (
        <PollCreator
          onSubmit={handleCreatePoll}
          onCancel={() => setShowCreator(false)}
          lang={lang}
        />
      )}

      {polls && polls.length > 0 ? (
        <div className="polls-list">
          {polls.map((poll) => (
            <DiscussionPoll
              key={poll.id}
              poll={poll}
              onVote={() => {}}
              onDelete={handleDeletePoll}
              currentUserId={currentUserId}
              lang={lang}
            />
          ))}
        </div>
      ) : !showCreator ? (
        <div className="polls-empty">
          <i className="fas fa-chart-bar" />
          <p>{lang === 'ht' ? 'Pa gen sondaj' : 'No polls yet'}</p>
        </div>
      ) : null}
    </div>
  );
}

// ─── Standalone Poll Display (for feed cards) ─────────────────────

export function PollPreview({ poll, lang = 'ht' }) {
  const totalVotes = (poll.options || []).reduce((sum, opt) => sum + (opt.votes || 0), 0);
  const topOption = (poll.options || []).reduce((max, opt) =>
    (opt.votes || 0) > (max.votes || 0) ? opt : max, { votes: 0 });

  return (
    <div className="poll-preview">
      <div className="poll-preview-question">
        <i className="fas fa-chart-bar" /> {poll.question}
      </div>
      <div className="poll-preview-stats">
        <span>{totalVotes} {lang === 'ht' ? 'vòt' : 'votes'}</span>
        <span className="poll-preview-winner">
          <i className="fas fa-trophy" /> {topOption.text}
        </span>
      </div>
    </div>
  );
}

export default DiscussionPoll;
