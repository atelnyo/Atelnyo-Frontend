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
import ChatBox from './ChatBox';

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
            {formatMemberCount(memberCount)} {lang === 'ht' ? 'manm' : 'members'}
          </span>
          <span className="group-posts">
            <i className="fas fa-comment" />
            {group.post_count || 0} {lang === 'ht' ? 'pòs' : 'posts'}
          </span>
        </div>

        <div className="group-card-actions">
          {isMember ? (
            <>
              <button className="group-btn group-btn-secondary" onClick={(e) => { e.stopPropagation(); onLeave?.(group); }}>
                {lang === 'ht' ? 'Kite' : 'Leave'}
              </button>
              <span className="group-member-badge">
                <i className="fas fa-check" /> {lang === 'ht' ? 'Manm' : 'Member'}
              </span>
            </>
          ) : (
            <button className="group-btn group-btn-primary" onClick={(e) => { e.stopPropagation(); onJoin?.(group); }}>
              <i className="fas fa-plus" /> {lang === 'ht' ? 'Antre' : 'Join'}
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
        {lang === 'ht' ? 'Kreye yon gwoup' : 'Create a Group'}
      </h3>

      <div className="group-form-group">
        <label>{lang === 'ht' ? 'Non' : 'Name'} *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={lang === 'ht' ? 'Non gwoup la' : 'Group name'}
          required
          maxLength={100}
        />
      </div>

      <div className="group-form-group">
        <label>{lang === 'ht' ? 'Deskripsyon' : 'Description'}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={lang === 'ht' ? 'Kisa gwoup sa a ye?' : 'What is this group about?'}
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
          <span>{lang === 'ht' ? 'Gwoup prive' : 'Private group'}</span>
        </label>
      </div>

      <div className="group-form-actions">
        <button type="button" className="group-btn group-btn-secondary" onClick={onCancel}>
          {lang === 'ht' ? 'Anile' : 'Cancel'}
        </button>
        <button type="submit" className="group-btn group-btn-primary">
          <i className="fas fa-plus" /> {lang === 'ht' ? 'Kreye' : 'Create'}
        </button>
      </div>
    </form>
  );
}

// ─── Group Detail ──────────────────────────────────────────────────

function GroupDetail({ group, onBack, onJoin, onLeave, lang, user }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newPost, setNewPost] = useState('');
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, [group?.id]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/communities/groups/${group.id}/posts/`);
      setPosts(Array.isArray(res.data) ? res.data : (res.data?.results || []));
    } catch (err) {
      console.error('Failed to fetch posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async (e) => {
    e.preventDefault();
    if (!newPost.trim()) return;

    try {
      await api.post(`/communities/groups/${group.id}/posts/`, {
        content: newPost.trim(),
      });
      setNewPost('');
      fetchPosts();
    } catch (err) {
      console.error('Failed to post:', err);
    }
  };

  return (
    <div className="group-detail">
      <button className="group-back-btn" onClick={onBack}>
        <i className="fas fa-arrow-left" /> {lang === 'ht' ? 'Retounen' : 'Back'}
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
            <i className="fas fa-comments" /> {lang === 'ht' ? 'Chat' : 'Chat'}
          </button>
        )}
        {group.is_member ? (
          <button className="group-btn group-btn-secondary" onClick={() => onLeave?.(group)}>
            {lang === 'ht' ? 'Kite Gwoup sa a' : 'Leave Group'}
          </button>
        ) : (
          <button className="group-btn group-btn-primary" onClick={() => onJoin?.(group)}>
            <i className="fas fa-plus" /> {lang === 'ht' ? 'Antre nan Gwoup' : 'Join Group'}
          </button>
        )}
      </div>

      {group.is_member && (
        <form className="group-post-form" onSubmit={handlePost}>
          <textarea
            value={newPost}
            onChange={(e) => setNewPost(e.target.value)}
            placeholder={lang === 'ht' ? 'Ekri yon mesaj...' : 'Write a message...'}
            rows={3}
          />
          <button type="submit" className="group-btn group-btn-primary">
            <i className="fas fa-paper-plane" /> {lang === 'ht' ? 'Pibliye' : 'Post'}
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
        <h3>{lang === 'ht' ? 'Pòs' : 'Posts'}</h3>

        {loading ? (
          <div className="group-loading">
            <i className="fas fa-spinner fa-spin" /> Loading posts...
          </div>
        ) : posts.length === 0 ? (
          <div className="group-empty">
            <i className="fas fa-comment-slash" />
            <p>{lang === 'ht' ? 'Pa gen pòs ankò' : 'No posts yet'}</p>
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

export default function CommunityGroups({ community, lang = 'ht', showToast, user }) {
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
      showToast?.(lang === 'ht' ? 'Gwoup kreye!' : 'Group created!', 'success');
    } catch (err) {
      showToast?.(lang === 'ht' ? 'Erè nan kreyasyon' : 'Error creating group', 'error');
    }
  };

  const handleJoinGroup = async (group) => {
    try {
      await api.post(`/communities/groups/${group.id}/join/`);
      fetchGroups();
      showToast?.(lang === 'ht' ? 'Ou antre nan gwoup la!' : 'Joined the group!', 'success');
    } catch (err) {
      showToast?.(lang === 'ht' ? 'Erè' : 'Error', 'error');
    }
  };

  const handleLeaveGroup = async (group) => {
    try {
      await api.post(`/communities/groups/${group.id}/leave/`);
      fetchGroups();
      showToast?.(lang === 'ht' ? 'Ou kite gwoup la' : 'Left the group', 'success');
    } catch (err) {
      showToast?.(lang === 'ht' ? 'Erè' : 'Error', 'error');
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
      />
    );
  }

  return (
    <div className="group-container">
      <div className="group-header">
        <h2>
          <i className="fas fa-layer-group" />
          {lang === 'ht' ? 'Gwoup' : 'Groups'}
        </h2>
        <button className="group-btn group-btn-primary" onClick={() => setShowForm(!showForm)}>
          <i className="fas fa-plus" /> {lang === 'ht' ? 'Kreye Gwoup' : 'Create Group'}
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
          <span>{lang === 'ht' ? 'Ap chaje...' : 'Loading...'}</span>
        </div>
      ) : groups.length === 0 ? (
        <div className="group-empty">
          <i className="fas fa-layer-group" />
          <p>{lang === 'ht' ? 'Pa gen gwoup ankò' : 'No groups yet'}</p>
          <button className="group-btn group-btn-primary" onClick={() => setShowForm(true)}>
            {lang === 'ht' ? 'Kreye premye gwoup la' : 'Create the first group'}
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
