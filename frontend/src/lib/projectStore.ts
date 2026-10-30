// ==============================================================================
// DEVLENS AI - PROJECT & PROVIDER PERSISTENCE STORE
// ==============================================================================

export interface PSExplanation {
  title: string;
  overview_objective: string;
  actual_problem: string;
  target_users_stakeholders: string[];
  stated_requirements: string[];
  inferred_recommendations: string[];
  constraints_limitations: string[];
  success_judging_criteria: string;
  important_terms: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
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
  createdAt: number;
  updatedAt: number;
}

export interface ProviderCredential {
  apiKey: string;
  defaultModel?: string;
  validatedAt?: number;
}

const STORAGE_KEY_PROJECTS = 'devlens_projects_v1';
const STORAGE_KEY_ACTIVE_PROJECT = 'devlens_active_project_id';
const STORAGE_KEY_PROVIDERS = 'devlens_provider_credentials_v1';

// ------------------------------------------------------------------------------
// Project Operations
// ------------------------------------------------------------------------------

export function getAllProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROJECTS);
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

export function createNewProject(data: {
  title?: string;
  problemStatement: string;
  explanation?: PSExplanation | null;
  provider?: string;
  model?: string;
}): Project {
  const id = `proj_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
  const title =
    data.title ||
    (data.explanation && data.explanation.title) ||
    data.problemStatement.slice(0, 40).replace(/[\r\n]+/g, ' ') ||
    'Untitled Project';

  const newProject: Project = {
    id,
    title,
    problemStatement: data.problemStatement,
    explanation: data.explanation || null,
    messages: [],
    deliverables: {},
    provider: data.provider || 'groq',
    model: data.model || 'openai/gpt-oss-120b',
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
      setActiveProjectId(null);
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
// Provider Credentials Operations (Client Session Security)
// ------------------------------------------------------------------------------

export function getSavedCredentials(): Record<string, ProviderCredential> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROVIDERS);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ProviderCredential>;
  } catch {
    return {};
  }
}

export function saveProviderCredential(
  provider: string,
  apiKey: string,
  defaultModel?: string
): void {
  try {
    const credentials = getSavedCredentials();
    credentials[provider.toLowerCase()] = {
      apiKey: apiKey.trim(),
      defaultModel,
      validatedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY_PROVIDERS, JSON.stringify(credentials));
  } catch (e) {
    console.error('Failed to save provider credential:', e);
  }
}

export function removeProviderCredential(provider: string): void {
  try {
    const credentials = getSavedCredentials();
    delete credentials[provider.toLowerCase()];
    localStorage.setItem(STORAGE_KEY_PROVIDERS, JSON.stringify(credentials));
  } catch (e) {
    console.error('Failed to remove provider credential:', e);
  }
}

export function getProviderCredential(provider: string): ProviderCredential | null {
  const credentials = getSavedCredentials();
  return credentials[provider.toLowerCase()] || null;
}
