/**
 * mediaProjectStore — Frontend-only CRUD for Project <-> Media mapping.
 *
 * Slice C ("Project Mode" for media) is sprint-blocked on a real
 * backend m2m table on Media ↔ PortfolioProject (or a leaner
 * MediaProject model). This store is the deterministic fallback so
 * the UI ships today:
 *
 *   Storage key:  atelnyo_media_projects_v1
 *   Shape: {
 *     projects: [
 *       { id: string, name: string, description?: string,
 *         color?: string, createdAt: ISOString }
 *     ],
 *     assignments: {
 *       "<mediaId>": ["<projectId>", ...]
 *     }
 *   }
 *
 * The store ships <MediaProjectsPanel>+<MediaProjectFormModal> today
 * without any backend dependency. A future slice fuses this with the
 * canonical BE endpoint by adding a `__synced` flag per project that
 * tells the UI when it can drop the local copy.
 */
const KEY = 'atelnyo_media_projects_v1';

function readRaw() {
  if (typeof window === 'undefined') return { projects: [], assignments: {} };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { projects: [], assignments: {} };
    const parsed = JSON.parse(raw);
    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      assignments: parsed.assignments && typeof parsed.assignments === 'object' ? parsed.assignments : {},
    };
  } catch (err) {
    console.warn('[mediaProjectStore] read failed; resetting.', err);
    return { projects: [], assignments: {} };
  }
}

function writeRaw(state) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
    // Fire a window event so multiple panels stay in sync without
    // a context provider.
    window.dispatchEvent(new CustomEvent('atelnyo:media-projects:changed'));
  } catch (err) {
    console.warn('[mediaProjectStore] write failed.', err);
  }
}

function rid() {
  return 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function listProjects() {
  return readRaw().projects;
}

export function getProject(id) {
  return readRaw().projects.find((p) => p.id === id) || null;
}

export function createProject({ name, description = '', color = '#d81b60' }) {
  const trimmed = (name || '').trim();
  if (!trimmed) throw new Error('Project name is required.');
  const state = readRaw();
  const project = {
    id: rid(),
    name: trimmed,
    description,
    color,
    createdAt: new Date().toISOString(),
  };
  state.projects.push(project);
  writeRaw(state);
  return project;
}

export function updateProject(id, patch) {
  const state = readRaw();
  const idx = state.projects.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  state.projects[idx] = { ...state.projects[idx], ...patch, id };
  writeRaw(state);
  return state.projects[idx];
}

export function deleteProject(id) {
  const state = readRaw();
  state.projects = state.projects.filter((p) => p.id !== id);
  for (const mediaId of Object.keys(state.assignments)) {
    state.assignments[mediaId] = (state.assignments[mediaId] || []).filter(
      (pid) => pid !== id,
    );
    if (state.assignments[mediaId].length === 0) {
      delete state.assignments[mediaId];
    }
  }
  writeRaw(state);
  return state.projects;
}

export function assignMediaToProject(mediaId, projectId) {
  if (!mediaId || !projectId) return null;
  const state = readRaw();
  const list = state.assignments[mediaId] || [];
  if (!list.includes(projectId)) {
    list.push(projectId);
    state.assignments[mediaId] = list;
    writeRaw(state);
  }
  return list;
}

export function unassignMediaFromProject(mediaId, projectId) {
  const state = readRaw();
  const list = state.assignments[mediaId] || [];
  const next = list.filter((p) => p !== projectId);
  if (next.length === 0) {
    delete state.assignments[mediaId];
  } else {
    state.assignments[mediaId] = next;
  }
  writeRaw(state);
  return next;
}

export function setMediaProjects(mediaId, projectIds) {
  const state = readRaw();
  const clean = Array.from(new Set((projectIds || []).filter(Boolean)));
  if (clean.length === 0) {
    delete state.assignments[mediaId];
  } else {
    state.assignments[mediaId] = clean;
  }
  writeRaw(state);
  return clean;
}

export function getMediaProjects(mediaId) {
  const state = readRaw();
  const ids = state.assignments[mediaId] || [];
  return ids.map((id) => getProject(id)).filter(Boolean);
}

export function getMediaIdsForProject(projectId) {
  const state = readRaw();
  return Object.entries(state.assignments)
    .filter(([, list]) => Array.isArray(list) && list.includes(projectId))
    .map(([mediaId]) => mediaId);
}

export function clearAll() {
  writeRaw({ projects: [], assignments: {} });
}

export default {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  assignMediaToProject,
  unassignMediaFromProject,
  setMediaProjects,
  getMediaProjects,
  getMediaIdsForProject,
  clearAll,
  KEY,
};
