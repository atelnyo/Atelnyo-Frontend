/**
 * CourseBookmarks — Save/bookmark lessons for later review.
 * Stored in localStorage with cloud sync when available.
 */
import React, { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'atelnyo_bookmarks';

export default function CourseBookmarks({ courseId, lang = 'ht', onNavigate }) {
  const isHt = lang === 'ht';
  const [bookmarks, setBookmarks] = useState([]);

  useEffect(() => {
    loadBookmarks();
  }, [courseId]);

  const loadBookmarks = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const all = raw ? JSON.parse(raw) : {};
      const courseBookmarks = all[String(courseId)] || [];
      setBookmarks(courseBookmarks);
    } catch (e) {
      setBookmarks([]);
    }
  };

  const addBookmark = useCallback((moduleIndex, blockId, title) => {
    setBookmarks(prev => {
      const exists = prev.some(b => b.moduleIndex === moduleIndex && b.blockId === blockId);
      if (exists) return prev;
      const next = [...prev, { moduleIndex, blockId, title, savedAt: Date.now() }];
      saveToStorage(next);
      return next;
    });
  }, [courseId]);

  const removeBookmark = useCallback((moduleIndex, blockId) => {
    setBookmarks(prev => {
      const next = prev.filter(b => !(b.moduleIndex === moduleIndex && b.blockId === blockId));
      saveToStorage(next);
      return next;
    });
  }, [courseId]);

  const isBookmarked = useCallback((moduleIndex, blockId) => {
    return bookmarks.some(b => b.moduleIndex === moduleIndex && b.blockId === blockId);
  }, [bookmarks]);

  const saveToStorage = (data) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const all = raw ? JSON.parse(raw) : {};
      all[String(courseId)] = data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (e) {}
  };

  return (
    <div className="ls-bookmarks" style={{ padding: '12px 0' }}>
      {bookmarks.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 8px', fontSize: '14px' }}>
            🔖 {isHt ? 'Sove' : 'Saved'} ({bookmarks.length})
          </h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {bookmarks.map((b, i) => (
              <li key={i} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 8px', borderRadius: '6px', fontSize: '13px',
                cursor: 'pointer', transition: 'background 0.15s',
                background: '#f5f5f5', marginBottom: '4px',
              }}
                onClick={() => onNavigate?.('module', b.moduleIndex)}
              >
                <span>📖 {b.title || `Modil ${(b.moduleIndex || 0) + 1}`}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeBookmark(b.moduleIndex, b.blockId); }}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#999' }}
                  aria-label={isHt ? 'Retire sove' : 'Remove bookmark'}
                >✕</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
