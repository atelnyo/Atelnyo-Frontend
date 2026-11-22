/**
 * src/components/community/CommunityGroups.jsx
 *
 * Community Groups Component.
 * Allows communities to create sub-groups for specific topics or activities.
 *
 * Features:
 *   - Create and join groups
 *   - Group chat/discussions
 *   - Member management
 *   - Group settings
 *   - Activity feed
 */
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { t as t4 } from '../../utils/i18n';
import ChatBox from './ChatBox';
import { POST_MAX_LENGTH, countPostChars, validatePostDraft } from './postRules';
import './CommunityGroups.css';
import { inlineText } from '../../utils/inlineI18n';

// ─── Helpers ───────────────────────────────────────────────────────

function formatMemberCount(n) {
  if (n == null) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

// ─── Group Card ────────────────────────────────────────────────────

function GroupCard({ group, onJoin, onLeave, onClick, lang }) {
  const isMember = group.is_member;
  const memberCount = group.member_count || 0;

  return (
    <div className="group-card" onClick={() => onClick?.(group)}>
      <div className="group-card-cover">
        {group.cover_url ? (
          <img src={group.cover_url} alt={group.name} />
        ) : (
          <div className="group-card-placeholder">
            <i className="fas fa-layer-group" />
          </div>
        )}
      </div>

      <div className="group-card-content">
        <h3 className="group-card-name">{group.name}</h3>
        <p className="group-card-description">
          {group.description?.substring(0, 100)}
          {group.description?.length > 100 ? '...' : ''}
        </p>

        <div className="group-card-meta">
          <span className="group-members">
            <i className="fas fa-users" />
            {formatMemberCount(memberCount)} {lang === 'ht' ? 'manm' : inlineText(lang, 'members')}
          </span>
          <span className="group-posts">
            <i className="fas fa-comment" />
            {group.post_count || 0} {lang === 'ht' ? 'pòs' : inlineText(lang, 'posts')}
          </span>
        </div>

        <div className="group-card-actions">
          {isMember ? (
            <>
              <button className="group-btn group-btn-secondary" onClick={(e) => { e.stopPropagation(); onLeave?.(group); }}>
                {lang === 'ht' ? 'Kite' : inlineText(lang, 'Leave')}
              </button>
              <span className="group-member-badge">
                <i className="fas fa-check" /> {lang === 'ht' ? 'Manm' : inlineText(lang, 'Member')}
              </span>
            </>
          ) : (
            <button className="group-btn group-btn-primary" onClick={(e) => { e.stopPropagation(); onJoin?.(group); }}>
              <i className="fas fa-plus" /> {lang === 'ht' ? 'Antre' : inlineText(lang, 'Join')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Create Group Form ─────────────────────────────────────────────

function CreateGroupForm({ onSubmit, onCancel, lang }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      is_private: isPrivate,
    });
    setName('');
    setDescription('');
  };

  return (
    <form className="group-form" onSubmit={handleSubmit}>
      <h3>
        <i className="fas fa-plus-circle" />
        {lang === 'ht' ? 'Kreye yon gwoup' : inlineText(lang, 'Create a Group')}
      </h3>

      <div className="group-form-group">
        <label>{lang === 'ht' ? 'Non' : inlineText(lang, 'Name')} *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={lang === 'ht' ? 'Non gwoup la' : inlineText(lang, 'Group name')}
          required
          maxLength={100}
        />
      </div>

      <div className="group-form-group">
        <label>{lang === 'ht' ? 'Deskripsyon' : inlineText(lang, 'Description')}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={lang === 'ht' ? 'Kisa gwoup sa a ye?' : inlineText(lang, 'What is this group about?')}
          rows={3}
        />
      </div>

      <div className="group-form-group">
        <label className="group-checkbox">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
          />
          <span>{lang === 'ht' ? 'Gwoup prive' : inlineText(lang, 'Private group')}</span>
        </label>
      </div>

      <div className="group-form-actions">
        <button type="button" className="group-btn group-btn-secondary" onClick={onCancel}>
          {lang === 'ht' ? 'Anile' : inlineText(lang, 'Cancel')}
        </button>
        <button type="submit" className="group-btn group-btn-primary">
          <i className="fas fa-plus" /> {lang === 'ht' ? 'Kreye' : inlineText(lang, 'Create')}
        </button>
      </div>
    </form>
  );
}

// ─── Group Detail ──────────────────────────────────────────────────

function GroupPostSkeleton() {
  return (
    <div className="group-post group-post-skeleton" aria-hidden="true">
      <div className="group-skel-line group-skel-line--meta" />
      <div className="group-skel-line" />
      <div className="group-skel-line group-skel-line--short" />
    </div>
  );
}

function GroupDetail({ group, onBack, onJoin, onLeave, lang, user, showToast }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [newPost, setNewPost] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');
  const [showChat, setShowChat] = useState(false);
  const draftLength = countPostChars(newPost);

  useEffect(() => {
    fetchPosts();
  }, [group?.id]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const res = await api.get(`/communities/groups/${group.id}/posts/`);
      setPosts(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    } catch (err) {
      console.error('Failed to fetch posts:', err);
      setLoadError(t4(
        lang,
        'Nou pa ka chaje pòs gwoup la. Eseye ankò.',
        'Could not load the group posts. Try again.',
        'Impossible de charger les publications du groupe. Réessayez.',
        'No se pudieron cargar las publicaciones del grupo. Inténtalo de nuevo.',
      ));
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async (e) => {
    e.preventDefault();
    if (posting) return;
    const check = validatePostDraft(newPost);
    if (!check.ok) {
      setPostError(check.reason === 'too_long'
        ? t4(lang, `Maksimòm ${POST_MAX_LENGTH} karaktè.`, `Maximum ${POST_MAX_LENGTH} characters.`, `Maximum ${POST_MAX_LENGTH} caractères.`, `Máximo ${POST_MAX_LENGTH} caracteres.`)
        : t4(lang, 'Ekri yon mesaj anvan w pibliye.', 'Write a message before publishing.', 'Écrivez un message avant de publier.', 'Escribe un mensaje antes de publicar.'));
      return;
    }
    setPosting(true);
    setPostError('');
    try {
      const res = await api.post(`/communities/groups/${group.id}/posts/`, {
        content: check.text,
      });
      const created = res?.data?.id ? res.data : null;
      if (created) {
        setPosts((prev) => [created, ...prev.filter((post) => post.id !== created.id)]);
      } else {
        await fetchPosts();
      }
      setNewPost('');
      showToast?.(t4(lang, 'Pòs pibliye!', 'Post published!', 'Publication réussie !', '¡Publicación exitosa!'), 'check-circle');
    } catch (err) {
      setPostError(
        err?.response?.data?.detail
        || t4(lang, 'Nou pa ka pibliye pòs la.', 'Could not publish the post.', 'Impossible de publier la publication.', 'No se pudo publicar.'),
      );
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="group-detail">
      <button className="group-back-btn" onClick={onBack}>
        <i className="fas fa-arrow-left" /> {lang === 'ht' ? 'Retounen' : inlineText(lang, 'Back')}
      </button>

      <div className="group-detail-header">
        <div className="group-detail-cover">
          {group.cover_url ? (
            <img src={group.cover_url} alt={group.name} />
          ) : (
            <div className="group-detail-placeholder">
              <i className="fas fa-layer-group" />
            </div>
          )}
        </div>

        <div className="group-detail-info">
          <h2>{group.name}</h2>
          <p>{group.description}</p>
          <div className="group-detail-meta">
            <span><i className="fas fa-users" /> {group.member_count || 0} members</span>
            <span><i className="fas fa-comment" /> {group.post_count || 0} posts</span>
          </div>
        </div>
      </div>

      <div className="group-detail-actions">
        {group.is_member && (
          <button className="group-btn group-btn-chat" onClick={() => setShowChat(!showChat)}>
            <i className="fas fa-comments" /> {lang === 'ht' ? 'Chat' : inlineText(lang, 'Chat')}
          </button>
        )}
        {group.is_member ? (
          <button className="group-btn group-btn-secondary" onClick={() => onLeave?.(group)}>
            {lang === 'ht' ? 'Kite Gwoup sa a' : inlineText(lang, 'Leave Group')}
          </button>
        ) : (
          <button className="group-btn group-btn-primary" onClick={() => onJoin?.(group)}>
            <i className="fas fa-plus" /> {lang === 'ht' ? 'Antre nan Gwoup' : inlineText(lang, 'Join Group')}
          </button>
        )}
      </div>

      {group.is_member && (
        <form className="group-post-form" onSubmit={handlePost} aria-busy={posting || undefined}>
          <textarea
            value={newPost}
            onChange={(e) => {
              const next = e.target.value;
              if (countPostChars(next) > POST_MAX_LENGTH) {
                setNewPost(Array.from(next).slice(0, POST_MAX_LENGTH).join(''));
                setPostError(t4(lang, `Maksimòm ${POST_MAX_LENGTH} karaktè. Tèks la koupe.`, `Maximum ${POST_MAX_LENGTH} characters. The text was shortened.`, `Maximum ${POST_MAX_LENGTH} caractères. Le texte a été raccourci.`, `Máximo ${POST_MAX_LENGTH} caracteres. El texto se acortó.`));
                return;
              }
              setNewPost(next);
              if (postError) setPostError('');
            }}
            placeholder={t4(lang, 'Ekri yon mesaj...', 'Write a message...', 'Écrivez un message...', 'Escribe un mensaje...')}
            rows={3}
            aria-invalid={postError ? 'true' : undefined}
            aria-describedby={postError ? 'group-post-error' : undefined}
          />
          <div className="group-post-meta">
            <span>{t4(lang, 'Pataje ak gwoup la', 'Share with the group', 'Partager avec le groupe', 'Compartir con el grupo')}</span>
            <span>{draftLength}/{POST_MAX_LENGTH}</span>
          </div>
          {postError && (
            <p className="group-post-error" id="group-post-error" role="alert">{postError}</p>
          )}
          <button
            type="submit"
            className="group-btn group-btn-primary"
            disabled={posting || !newPost.trim()}
            aria-busy={posting || undefined}
          >
            <i className={`fas ${posting ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} aria-hidden="true" />{' '}
            {posting
              ? t4(lang, 'Ap pibliye...', 'Publishing...', 'Publication...', 'Publicando...')
              : t4(lang, 'Pibliye', 'Post', 'Publier', 'Publicar')}
          </button>
        </form>
      )}

      {showChat && group.is_member && (
        <div className="group-chat-section">
          <ChatBox
            roomId={`group_${group.id}`}
            roomType="group"
            lang={lang}
            user={user}
            onClose={() => setShowChat(false)}
          />
        </div>
      )}

      <div className="group-posts-section">
        <h3>{lang === 'ht' ? 'Pòs' : inlineText(lang, 'Posts')}</h3>

        {loading ? (
          <div
            className="group-posts-list"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label={t4(lang, 'Ap chaje pòs gwoup la…', 'Loading group posts…', 'Chargement des publications du groupe…', 'Cargando publicaciones del grupo…')}
          >
            <GroupPostSkeleton />
            <GroupPostSkeleton />
            <GroupPostSkeleton />
          </div>
        ) : loadError ? (
          <div className="group-empty group-empty-error" role="alert">
            <i className="fas fa-triangle-exclamation" />
            <p>{loadError}</p>
            <button type="button" className="group-btn group-btn-secondary" onClick={fetchPosts}>
              {t4(lang, 'Eseye ankò', 'Try again', 'Réessayer', 'Inténtalo de nuevo')}
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className="group-empty">
            <i className="fas fa-comment-slash" />
            <p>{t4(lang, 'Pa gen pòs ankò', 'No posts yet', 'Aucune publication pour le moment', 'Aún no hay publicaciones')}</p>
          </div>
        ) : (
          <div className="group-posts-list">
            {posts.map((post) => (
              <div key={post.id} className="group-post">
                <div className="group-post-header">
                  <span className="group-post-author">{post.author_name || 'Anonymous'}</span>
                  <span className="group-post-time">{new Date(post.created_at).toLocaleDateString()}</span>
                </div>
                <div className="group-post-content">{post.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────

export default function CommunityGroups({ community, lang = 'en', showToast, user }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);

  useEffect(() => {
    fetchGroups();
  }, [community?.id]);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const res = await api.get('/communities/groups/', {
        params: { community: community?.id },
      });
      setGroups(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (data) => {
    try {
      await api.post('/communities/groups/', {
        ...data,
        community: community?.id,
      });
      setShowForm(false);
      fetchGroups();
      showToast?.(lang === 'ht' ? 'Gwoup kreye!' : inlineText(lang, 'Group created!'), 'success');
    } catch (err) {
      showToast?.(lang === 'ht' ? 'Erè nan kreyasyon' : inlineText(lang, 'Error creating group'), 'error');
    }
  };

  const handleJoinGroup = async (group) => {
    try {
      await api.post(`/communities/groups/${group.id}/join/`);
      fetchGroups();
      showToast?.(lang === 'ht' ? 'Ou antre nan gwoup la!' : inlineText(lang, 'Joined the group!'), 'success');
    } catch (err) {
      showToast?.(lang === 'ht' ? 'Erè' : inlineText(lang, 'Error'), 'error');
    }
  };

  const handleLeaveGroup = async (group) => {
    try {
      await api.post(`/communities/groups/${group.id}/leave/`);
      fetchGroups();
      showToast?.(lang === 'ht' ? 'Ou kite gwoup la' : inlineText(lang, 'Left the group'), 'success');
    } catch (err) {
      showToast?.(lang === 'ht' ? 'Erè' : inlineText(lang, 'Error'), 'error');
    }
  };

  if (selectedGroup) {
    return (
      <GroupDetail
        group={selectedGroup}
        onBack={() => setSelectedGroup(null)}
        onJoin={handleJoinGroup}
        onLeave={handleLeaveGroup}
        lang={lang}
        user={user}
        showToast={showToast}
      />
    );
  }

  return (
    <div className="group-container">
      <div className="group-header">
        <h2>
          <i className="fas fa-layer-group" />
          {lang === 'ht' ? 'Gwoup' : inlineText(lang, 'Groups')}
        </h2>
        <button className="group-btn group-btn-primary" onClick={() => setShowForm(!showForm)}>
          <i className="fas fa-plus" /> {lang === 'ht' ? 'Kreye Gwoup' : inlineText(lang, 'Create Group')}
        </button>
      </div>

      {showForm && (
        <CreateGroupForm
          onSubmit={handleCreateGroup}
          onCancel={() => setShowForm(false)}
          lang={lang}
        />
      )}

      {loading ? (
        <div className="group-loading">
          <i className="fas fa-spinner fa-spin" />
          <span>{lang === 'ht' ? 'Ap chaje...' : inlineText(lang, 'Loading...')}</span>
        </div>
      ) : groups.length === 0 ? (
        <div className="group-empty">
          <i className="fas fa-layer-group" />
          <p>{lang === 'ht' ? 'Pa gen gwoup ankò' : inlineText(lang, 'No groups yet')}</p>
          <button className="group-btn group-btn-primary" onClick={() => setShowForm(true)}>
            {lang === 'ht' ? 'Kreye premye gwoup la' : inlineText(lang, 'Create the first group')}
          </button>
        </div>
      ) : (
        <div className="group-grid">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onJoin={handleJoinGroup}
              onLeave={handleLeaveGroup}
              onClick={setSelectedGroup}
              lang={lang}
            />
          ))}
        </div>
      )}
    </div>
  );
}
