// ==============================================================================
// HACKORA - PROJECT & PROVIDER PERSISTENCE STORE
// ==============================================================================

export interface PSExplanation {
  title: string;
  overview?: string;
  overview_objective?: string;
  actual_problem?: string;
  coreProblem?: string;
  target_users?: string[];
  target_users_stakeholders?: string[];
  targetUsers?: string[];
  requirements?: string[];
  stated_requirements?: string[];
  inferred_recommendations?: string[];
  inferredRecommendations?: string[];
  constraints?: string[];
  constraints_limitations?: string[];
  expected_outcomes?: string[];
  success_judging_criteria?: string;
  successCriteria?: string[];
  important_terms?: string[];
  importantTerms?: string[];
  markdown_content?: string;
}

export interface AttachedFileMeta {
  id: string;
  name: string;
  size: number;
  wordCount?: number;
  type?: string;
  extractedText?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments?: AttachedFileMeta[];
  isError?: boolean;
}

export interface ConfirmedDecisions {
  solution?: string;
  usps?: string[];
  techStack?: string[];
  architectureNotes?: string[];
  keyDecisions?: string[];
}

export interface Project {
  id: string;
  title: string;
  problemStatement: string;
  explanation: PSExplanation | null;
  messages: ChatMessage[];
  deliverables: Record<string, any>;
  provider: string;
  model: string;
  mode?: 'problem_statement' | 'open_innovation';
  attachedFiles?: AttachedFileMeta[];
  confirmedDecisions?: ConfirmedDecisions;
  createdAt: number;
  updatedAt: number;
}

export interface ProviderCredential {
  apiKey: string;
  defaultModel?: string;
  validatedAt?: number;
}

const STORAGE_KEY_PROJECTS = 'devlens_projects_v2';
const STORAGE_KEY_LEGACY_PROJECTS = 'devlens_projects_v1';
const STORAGE_KEY_ACTIVE_PROJECT = 'devlens_active_project_id';
const STORAGE_KEY_PROVIDERS = 'devlens_provider_credentials_v1';

// ------------------------------------------------------------------------------
// Helper: Sanitize API Key (remove quotes, Bearer prefix, whitespace)
// ------------------------------------------------------------------------------

export function sanitizeApiKey(key: string): string {
  if (!key) return '';
  let cleaned = key.trim();
  // Strip surrounding quotes if user copied e.g. "gsk_..."
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  // Strip optional "Bearer " prefix
  if (cleaned.toLowerCase().startsWith('bearer ')) {
    cleaned = cleaned.slice(7).trim();
  }
  return cleaned;
}

// ------------------------------------------------------------------------------
// Project Operations
// ------------------------------------------------------------------------------

export function getAllProjects(): Project[] {
  try {
    let raw = localStorage.getItem(STORAGE_KEY_PROJECTS);
    if (!raw) {
      raw = localStorage.getItem(STORAGE_KEY_LEGACY_PROJECTS);
    }
    if (!raw) return [];
    return JSON.parse(raw) as Project[];
  } catch (e) {
    console.error('Failed to parse projects from localStorage:', e);
    return [];
  }
}

export function getProject(id: string): Project | null {
  const projects = getAllProjects();
  return projects.find((p) => p.id === id) || null;
}

export function saveProject(project: Project): void {
  try {
    const projects = getAllProjects();
    const existingIndex = projects.findIndex((p) => p.id === project.id);
    project.updatedAt = Date.now();

    if (existingIndex >= 0) {
      projects[existingIndex] = project;
    } else {
      projects.unshift(project);
    }

    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
  } catch (e) {
    console.error('Failed to save project to localStorage:', e);
  }
}

export function createNewProject(data?: {
  title?: string;
  problemStatement?: string;
  explanation?: PSExplanation | null;
  provider?: string;
  model?: string;
  mode?: 'problem_statement' | 'open_innovation';
  attachedFiles?: AttachedFileMeta[];
  initialMessages?: ChatMessage[];
}): Project {
  const id = `proj_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
  const title =
    data?.title ||
    (data?.explanation && data.explanation.title) ||
    (data?.problemStatement && data.problemStatement.slice(0, 45).replace(/[\r\n]+/g, ' ')) ||
    'New Conversation';

  const newProject: Project = {
    id,
    title,
    problemStatement: data?.problemStatement || '',
    explanation: data?.explanation || null,
    messages: data?.initialMessages || [],
    deliverables: {},
    provider: data?.provider || 'groq',
    model: data?.model || 'openai/gpt-oss-120b',
    mode: data?.mode || 'problem_statement',
    attachedFiles: data?.attachedFiles || [],
    confirmedDecisions: {
      usps: [],
      techStack: [],
      keyDecisions: [],
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  saveProject(newProject);
  setActiveProjectId(id);
  return newProject;
}

export function updateProject(id: string, updates: Partial<Project>): Project | null {
  const project = getProject(id);
  if (!project) return null;

  const updated: Project = {
    ...project,
    ...updates,
    updatedAt: Date.now(),
  };

  saveProject(updated);
  return updated;
}

export function deleteProject(id: string): void {
  try {
    const projects = getAllProjects().filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
    if (getActiveProjectId() === id) {
      const nextId = projects.length > 0 ? projects[0].id : null;
      setActiveProjectId(nextId);
    }
  } catch (e) {
    console.error('Failed to delete project:', e);
  }
}

export function getActiveProjectId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_PROJECT);
  } catch {
    return null;
  }
}

export function setActiveProjectId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEY_ACTIVE_PROJECT, id);
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_PROJECT);
    }
  } catch (e) {
    console.error('Failed to set active project id:', e);
  }
}

// ------------------------------------------------------------------------------
// In-Memory Transient Provider Credentials (Never persisted to disk / localStorage)
// ------------------------------------------------------------------------------

let inMemoryCredentials: Record<string, ProviderCredential> = {};

// Clean any legacy insecure localStorage / sessionStorage items immediately
try {
  localStorage.removeItem(STORAGE_KEY_PROVIDERS);
  sessionStorage.removeItem(STORAGE_KEY_PROVIDERS);
} catch {}

export function getSavedCredentials(): Record<string, ProviderCredential> {
  return inMemoryCredentials;
}

export function saveProviderCredential(
  provider: string,
  apiKey: string,
  defaultModel?: string
): void {
  const cleanedKey = sanitizeApiKey(apiKey);
  if (!cleanedKey) return;

  inMemoryCredentials[provider.toLowerCase()] = {
    apiKey: cleanedKey,
    defaultModel,
    validatedAt: Date.now(),
  };
}

export function removeProviderCredential(provider: string): void {
  delete inMemoryCredentials[provider.toLowerCase()];
}

export function getProviderCredential(provider: string): ProviderCredential | null {
  return inMemoryCredentials[provider.toLowerCase()] || null;
}
