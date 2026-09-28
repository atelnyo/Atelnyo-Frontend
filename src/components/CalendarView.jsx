/**
 * src/components/CalendarView.jsx
 *
 * Phase 35 — Full calendar grid for events + course deadlines.
 *
 * Mounted at /sheet/calendar via App.jsx Routes. Shows:
 *   • Month grid with day cells
 *   • Colored dots on days that have events
 *   • Click a day to see events for that day
 *   • Month navigation (prev/next) + Today button
 *   • Event list panel below the grid
 *
 * Data: GET /api/community-events/upcoming/ (events across all communities).
 * Future: course deadlines, assignment due dates, live streams.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { eventsService } from '../services/api';

const MONTH_NAMES = [
  'Janvye', 'Fevriye', 'Mas', 'Avril', 'Me', 'Jen',
  'Jiyè', 'Out', 'Septanm', 'Oktòb', 'Novanm', 'Desanm',
];
const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['Dim', 'Len', 'Ma', 'Mè', 'Je', 'Va', 'Sa'];
const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getMonthName(month, lang) {
  const names = lang === 'ht' ? MONTH_NAMES : MONTH_NAMES_EN;
  return names[month] || '';
}
function getDayNames(lang) {
  return lang === 'ht' ? DAY_NAMES : DAY_NAMES_EN;
}

export default function CalendarView({ lang = 'ht', t, showToast }) {
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null); // { year, month, day }

  // Fetch upcoming events (all communities)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    eventsService.upcoming({ limit: 100 })
      .then((r) => {
        if (cancelled) return;
        const items = Array.isArray(r?.data) ? r.data : (r?.data?.results || []);
        setEvents(items);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Build a map: "YYYY-MM-DD" → [event, ...]
  const eventsByDate = useMemo(() => {
    const map = {};
    for (const ev of events) {
      if (!ev.start_time) continue;
      const d = new Date(ev.start_time);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(ev);
    }
    return map;
  }, [events]);

  // Compute calendar grid for the current month view
  const calendar = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startDow = firstDay.getDay(); // 0=Sun
    const totalDays = lastDay.getDate();

    const weeks = [];
    let week = [];
    // Fill leading empty cells
    for (let i = 0; i < startDow; i++) {
      week.push(null);
    }
    for (let day = 1; day <= totalDays; day++) {
      week.push(day);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    // Fill trailing empty cells
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    return weeks;
  }, [viewYear, viewMonth]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
    setSelectedDay(null);
  }
  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
    setSelectedDay(null);
  }
  function goToday() {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDay(null);
  }

  function dateKey(day) {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function getDayEvents(day) {
    return eventsByDate[dateKey(day)] || [];
  }

  function isToday(day) {
    return viewYear === today.getFullYear() &&
      viewMonth === today.getMonth() &&
      day === today.getDate();
  }

  function handleDayClick(day) {
    const dayEvents = getDayEvents(day);
    if (dayEvents.length > 0) {
      setSelectedDay({ year: viewYear, month: viewMonth, day, events: dayEvents });
    }
  }

  function formatEventTime(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    } catch { return ''; }
  }

  const dayNames = getDayNames(lang);

  return (
    <div className="calendar-view">
      {/* Header */}
      <div className="calendar-header">
        <h3 className="calendar-header-title">
          {getMonthName(viewMonth, lang)} {viewYear}
        </h3>
        <div className="calendar-header-actions">
          <button
            type="button"
            className="calendar-nav-btn"
            onClick={prevMonth}
            aria-label={lang === 'ht' ? 'Mwa anvan' : 'Previous month'}
          >
            <i className="fas fa-chevron-left" />
          </button>
          <button
            type="button"
            className="calendar-nav-btn calendar-today-btn"
            onClick={goToday}
          >
            {lang === 'ht' ? 'Jodi a' : 'Today'}
          </button>
          <button
            type="button"
            className="calendar-nav-btn"
            onClick={nextMonth}
            aria-label={lang === 'ht' ? 'Mwa apre' : 'Next month'}
          >
            <i className="fas fa-chevron-right" />
          </button>
        </div>
      </div>

      {loading && (
        <div className="calendar-loading">
          <i className="fas fa-spinner fa-spin" /> {lang === 'ht' ? 'Ap chaje...' : 'Loading...'}
        </div>
      )}

      {/* Calendar grid */}
      {!loading && (
        <div className="calendar-grid">
          {/* Day name header */}
          <div className="calendar-day-names">
            {dayNames.map((name) => (
              <div key={name}>{name}</div>
            ))}
          </div>

          {/* Weeks */}
          {calendar.map((week, wi) => (
            <div
              key={wi}
              className="calendar-week"
            >
              {week.map((day, di) => {
                if (day == null) {
                  return <div key={`empty-${di}`} className="calendar-day calendar-day-empty" />;
                }
                const dayEvents = getDayEvents(day);
                const isTodayCell = isToday(day);
                const hasEvents = dayEvents.length > 0;
                const isSelected = selectedDay && selectedDay.day === day &&
                  selectedDay.month === viewMonth && selectedDay.year === viewYear;

                return (
                  <div
                    key={day}
                    className={`calendar-day${isTodayCell ? ' calendar-day-today' : ''}${hasEvents ? ' calendar-day-has-events' : ''}${isSelected ? ' calendar-day-selected' : ''}`}
                    onClick={() => handleDayClick(day)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleDayClick(day); } }}
                    aria-label={`${getMonthName(viewMonth, lang)} ${day}`}
                  >
                    <span className="calendar-day-num">{day}</span>
                    {hasEvents && (
                      <div className="calendar-day-dots">
                        {dayEvents.slice(0, 3).map((ev, i) => (
                          <span
                            key={i}
                            className="calendar-day-dot"
                            style={{
                              background: ev.is_free ? '#4caf50' : '#d81b60',
                            }}
                          />
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="calendar-day-dot-more">+{dayEvents.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Selected day's events */}
      {selectedDay && selectedDay.events && selectedDay.events.length > 0 && (
        <div className="calendar-events-panel">
          <h4 className="calendar-events-title">
            <i className="fas fa-calendar-day calendar-events-title-icon" />
            {getMonthName(selectedDay.month, lang)} {selectedDay.day}, {selectedDay.year}
          </h4>
          <div className="calendar-events-list">
            {selectedDay.events.map((ev) => (
              <div
                key={ev.id}
                className="calendar-event-item"
              >
                <div className="calendar-event-dot-big" style={{
                  background: ev.is_free ? '#4caf50' : '#d81b60',
                }} />
                <div className="calendar-event-text">
                  <div className="calendar-event-title">{ev.title}</div>
                  <div className="calendar-event-meta">
                    {formatEventTime(ev.start_time)}
                    {ev.location && ` · ${ev.location}`}
                    {ev.community_name && ` · ${ev.community_name}`}
                  </div>
                </div>
                <div className={`calendar-event-badge${ev.is_free ? ' calendar-event-badge--free' : ' calendar-event-badge--paid'}`}>
                  {ev.is_free
                    ? (t?.explore_event_rsvp || 'RSVP')
                    : `$${Number(ev.price || 0).toFixed(2)}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && events.length === 0 && (
        <div className="calendar-empty">
          <i className="fas fa-calendar-alt calendar-empty-icon" />
          <p className="calendar-empty-title">
            {t?.explore_event_empty || (lang === 'ht' ? 'Pa gen evènman ki ap vini' : 'No upcoming events')}
          </p>
          <p className="calendar-empty-hint">
            {t?.explore_event_empty_hint || (lang === 'ht' ? 'Tounen pita pou wè evènman k ap vini yo.' : 'Check back soon for upcoming events.')}
          </p>
        </div>
      )}
    </div>
  );
}
