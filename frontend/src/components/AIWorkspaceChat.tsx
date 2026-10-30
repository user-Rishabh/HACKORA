import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Send,
  Square,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Copy,
  Check,
  AlertCircle,
  Settings,
  FileText,
  Layers,
  Cpu,
  GitPullRequest,
  Database,
  Presentation,
  Loader2,
  X,
  Bot,
  User,
  Paperclip,
  Trash2,
  Plus,
  Compass,
  Lightbulb,
  Search,
  Scale,
  ShieldAlert,
  Download,
  Code2,
  FileUp,
  MessageSquare,
  Edit2,
  PanelRightClose,
  PanelRightOpen,
  PanelLeftClose,
  PanelLeftOpen,
  ExternalLink,
} from 'lucide-react';
import { API_BASE_URL } from '../lib/apiClient';
import { MarkdownRenderer } from './MarkdownRenderer';
import {
  Project,
  ChatMessage,
  AttachedFileMeta,
  getProject,
  getAllProjects,
  saveProject,
  updateProject,
  deleteProject,
  getActiveProjectId,
  setActiveProjectId,
  createNewProject,
  getProviderCredential,
  getSavedCredentials,
} from '../lib/projectStore';
import ProviderSettingsModal from './ProviderSettingsModal';

interface AIWorkspaceChatProps {
  projectId?: string | null;
  initialMode?: 'problem_statement' | 'open_innovation';
  onBackToMain?: () => void;
  onGoToStage2: () => void;
}

type DeliverableType =
  | 'research'
  | 'solution_comparison'
  | 'usp_generation'
  | 'architecture'
  | 'workflows'
  | 'tech_stack'
  | 'implementation_plan'
  | 'db_api_design'
  | 'ppt_content'
  | 'pitch_prep';

interface DeliverableToolDef {
  type: DeliverableType;
  label: string;
  desc: string;
  icon: React.ReactNode;
  category: 'strategy' | 'technical' | 'pitch';
}

const DELIVERABLE_TOOLS: DeliverableToolDef[] = [
  {
    type: 'research',
    label: 'Market & Competitor Research',
    desc: 'Existing solutions, gaps, limitations & verified citations',
    icon: <Search className="w-4 h-4 text-[#3B5FE0]" />,
    category: 'strategy',
  },
  {
    type: 'solution_comparison',
    label: 'Solution Comparison Matrix',
    desc: 'Trade-off comparison of 3 architectural approaches',
    icon: <Scale className="w-4 h-4 text-[#6366F1]" />,
    category: 'strategy',
  },
  {
    type: 'usp_generation',
    label: 'Defensible USPs & Moats',
    desc: 'Unique technical hooks that win hackathon judging points',
    icon: <Sparkles className="w-4 h-4 text-[#E85D2C]" />,
    category: 'strategy',
  },
  {
    type: 'architecture',
    label: 'System Architecture (Mermaid)',
    desc: 'C4 diagrams, system components, and data flow sequences',
    icon: <Layers className="w-4 h-4 text-[#059669]" />,
    category: 'technical',
  },
  {
    type: 'workflows',
    label: 'Workflows & Journeys (Mermaid)',
    desc: 'End-to-end user journeys and event sequences',
    icon: <GitPullRequest className="w-4 h-4 text-[#0EA5E9]" />,
    category: 'technical',
  },
  {
    type: 'tech_stack',
    label: 'Tech Stack & Trade-offs',
    desc: 'Frameworks, databases & how to defend them in Q&A',
    icon: <Cpu className="w-4 h-4 text-[#7C3AED]" />,
    category: 'technical',
  },
  {
    type: 'implementation_plan',
    label: '24-48h Sprint Plan',
    desc: 'Milestones, phases, tasks & critical path risk mitigations',
    icon: <FileText className="w-4 h-4 text-[#D97706]" />,
    category: 'technical',
  },
  {
    type: 'db_api_design',
    label: 'DB Schemas & REST APIs',
    desc: 'Entity relationship fields and REST/GraphQL payload specs',
    icon: <Database className="w-4 h-4 text-[#DC2626]" />,
    category: 'technical',
  },
  {
    type: 'ppt_content',
    label: 'Pitch Deck / PPT (8 Slides)',
    desc: 'Slide-by-slide storyline and speaking notes for presenters',
    icon: <Presentation className="w-4 h-4 text-[#E11D48]" />,
    category: 'pitch',
  },
  {
    type: 'pitch_prep',
    label: 'Demo Path & Judge Defense',
    desc: '30s hook, 2-minute golden demo path & tough Q&A answers',
    icon: <ShieldAlert className="w-4 h-4 text-[#2563EB]" />,
    category: 'pitch',
  },
];

interface ModelOption {
  id: string;
  name: string;
  context_window?: number;
  provider?: string;
}

const STARTER_PROMPTS = [
  {
    title: 'Break down problem requirements',
    subtitle: 'Extract target users, constraints & deliverables',
    prompt: 'Break down this problem statement into core objectives, target personas, technical constraints, and must-have deliverables.',
  },
  {
    title: 'Brainstorm 3 winning USPs',
    subtitle: 'Competitive moats to stand out to judges',
    prompt: 'What are 3 unique, defensible USPs (Unique Selling Propositions) that will differentiate this solution from existing tools?',
  },
  {
    title: 'Recommend optimal 48h tech stack',
    subtitle: 'Fast prototyping with production defensibility',
    prompt: 'Recommend the most defensible, low-latency tech stack for a 48h hackathon prototype, including frontend, backend, database, and inference.',
  },
  {
    title: 'Design database & core REST APIs',
    subtitle: 'Key data entities and endpoint contracts',
    prompt: 'Draft the core database entity schema and 5 primary REST API endpoints required to build the minimal viable demo.',
  },
];

// Helper to render Mermaid diagrams via SVG representation + Source Code tab
function MermaidViewer({ code }: { code: string }) {
  const [activeTab, setActiveTab] = useState<'diagram' | 'code'>('diagram');
  const [copied, setCopied] = useState(false);

  // Extract nodes from graph TD or sequenceDiagram
  const parseNodes = (mermaidText: string) => {
    const lines = mermaidText.split('\n');
    const nodes: { id: string; label: string }[] = [];
    const connections: { from: string; to: string; label?: string }[] = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      const nodeMatch = trimmed.match(/([A-Za-z0-9_]+)\[([^\]]+)\]/);
      if (nodeMatch && !nodes.some((n) => n.id === nodeMatch[1])) {
        nodes.push({ id: nodeMatch[1], label: nodeMatch[2] });
      }

      const connMatch = trimmed.match(/([A-Za-z0-9_]+)\s*-->(?:\|([^|]+)\|)?\s*([A-Za-z0-9_]+)/);
      if (connMatch) {
        connections.push({ from: connMatch[1], to: connMatch[3], label: connMatch[2] });
      }
    });

    return { nodes: nodes.slice(0, 8), connections: connections.slice(0, 10) };
  };

  const { nodes, connections } = parseNodes(code);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-[#E5E1DA] bg-white overflow-hidden my-3 shadow-xs">
      <div className="flex items-center justify-between px-3 py-2 bg-[#FAFAF7] border-b border-[#E5E1DA]">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-[#E85D2C]" />
          <span className="text-[11px] font-mono font-bold text-[#1A1D29]">Architecture Diagram</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-[#E5E1DA] p-0.5 bg-white">
            <button
              onClick={() => setActiveTab('diagram')}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors ${
                activeTab === 'diagram' ? 'bg-[#E85D2C] text-white' : 'text-[#6B7280] hover:text-[#1A1D29]'
              }`}
            >
              Visual
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium transition-colors ${
                activeTab === 'code' ? 'bg-[#E85D2C] text-white' : 'text-[#6B7280] hover:text-[#1A1D29]'
              }`}
            >
              Mermaid Source
            </button>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] font-mono text-[#6B7280] hover:text-[#1A1D29] p-1 rounded hover:bg-gray-100"
            title="Copy Mermaid syntax"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {activeTab === 'diagram' ? (
        <div className="p-4 bg-[#FCFBF9] overflow-x-auto min-h-[160px] flex flex-col items-center justify-center">
          {nodes.length > 0 ? (
            <div className="flex flex-col items-center gap-3 w-full max-w-lg">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                {nodes.map((node, i) => (
                  <div
                    key={node.id}
                    className="p-2.5 rounded-lg border border-[#E85D2C]/30 bg-white shadow-xs flex items-center gap-2.5"
                  >
                    <span className="w-5 h-5 rounded-full bg-[#E85D2C]/10 text-[#E85D2C] text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-mono font-semibold text-[#1A1D29] truncate">{node.label}</div>
                      <div className="text-[10px] font-mono text-[#6B7280] truncate">ID: {node.id}</div>
                    </div>
                  </div>
                ))}
              </div>
              {connections.length > 0 && (
                <div className="w-full pt-2 border-t border-[#E5E1DA]/80">
                  <span className="text-[10px] font-mono text-[#6B7280] uppercase tracking-wider font-semibold">
                    Data Flow Links:
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {connections.map((c, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-white border border-[#E5E1DA] text-[10px] font-mono text-[#1A1D29]"
                      >
                        {c.from} → {c.to} {c.label ? `(${c.label})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <pre className="text-xs font-mono text-[#6B7280] whitespace-pre-wrap">{code}</pre>
          )}
        </div>
      ) : (
        <pre className="p-3.5 bg-[#1A1D29] text-emerald-300 text-xs font-mono overflow-x-auto leading-relaxed">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

// Auto-formats any raw JSON output into clean, beautifully structured ChatGPT / Claude Markdown
function formatJsonToMarkdown(rawContent: string): string {
  const trimmed = rawContent.trim();
  if (!trimmed.startsWith('{')) return rawContent;

  try {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return rawContent;
    const obj = JSON.parse(jsonMatch[0]);
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return rawContent;

    if (obj.markdown_content && typeof obj.markdown_content === 'string') {
      return obj.markdown_content;
    }

    const sections: string[] = [];
    if (obj.title) sections.push(`## 🎯 ${obj.title}\n`);
    if (obj.overview) sections.push(`### 📋 Problem Overview\n${obj.overview}\n`);
    if (obj.actual_problem) sections.push(`### 🔍 Actual Problem to Solve\n${obj.actual_problem}\n`);
    if (obj.target_users && Array.isArray(obj.target_users)) {
      sections.push(`### 👥 Target Users & Stakeholders\n${obj.target_users.map((u: string) => `- ${u}`).join('\n')}\n`);
    } else if (typeof obj.target_users === 'string') {
      sections.push(`### 👥 Target Users & Stakeholders\n${obj.target_users}\n`);
    }
    if (obj.requirements && Array.isArray(obj.requirements)) {
      sections.push(`### 📋 Requirements & Deliverables\n${obj.requirements.map((r: string) => `- ${r}`).join('\n')}\n`);
    } else if (typeof obj.requirements === 'string') {
      sections.push(`### 📋 Requirements & Deliverables\n${obj.requirements}\n`);
    }
    if (obj.constraints && Array.isArray(obj.constraints)) {
      sections.push(`### ⚠️ Constraints & Limitations\n${obj.constraints.map((c: string) => `- ${c}`).join('\n')}\n`);
    } else if (typeof obj.constraints === 'string') {
      sections.push(`### ⚠️ Constraints & Limitations\n${obj.constraints}\n`);
    }
    if (obj.expected_outcomes && Array.isArray(obj.expected_outcomes)) {
      sections.push(`### 🏆 Expected Outcomes & Success Metrics\n${obj.expected_outcomes.map((o: string) => `- ${o}`).join('\n')}\n`);
    } else if (typeof obj.expected_outcomes === 'string') {
      sections.push(`### 🏆 Expected Outcomes & Success Metrics\n${obj.expected_outcomes}\n`);
    }
    if (obj.important_terms && Array.isArray(obj.important_terms)) {
      sections.push(`### 💡 Important Technical Concepts\n${obj.important_terms.map((t: string) => `- \`${t}\``).join(' ')}\n`);
    } else if (typeof obj.important_terms === 'string') {
      sections.push(`### 💡 Important Technical Concepts\n${obj.important_terms}\n`);
    }

    for (const [key, val] of Object.entries(obj)) {
      if (['title', 'overview', 'actual_problem', 'target_users', 'requirements', 'constraints', 'expected_outcomes', 'important_terms', 'markdown_content'].includes(key)) continue;
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      if (Array.isArray(val)) {
        sections.push(`### 📌 ${label}\n${val.map((item) => `- ${typeof item === 'object' ? JSON.stringify(item) : String(item)}`).join('\n')}\n`);
      } else if (typeof val === 'string') {
        sections.push(`### 📌 ${label}\n${val}\n`);
      }
    }

    if (sections.length > 0) {
      return sections.join('\n');
    }
  } catch {
    // If not JSON, leave as original content
  }
  return rawContent;
}

export default function AIWorkspaceChat({
  projectId: propProjectId,
  initialMode = 'problem_statement',
  onBackToMain,
  onGoToStage2,
}: AIWorkspaceChatProps) {
  // All projects from persistence store
  const [allProjectsList, setAllProjectsList] = useState<Project[]>(() => getAllProjects());

  // Active project ID
  const [activeId, setActiveId] = useState<string>(() => {
    if (propProjectId) return propProjectId;
    const existing = getActiveProjectId();
    if (existing && getProject(existing)) return existing;
    const list = getAllProjects();
    if (list.length > 0) return list[0].id;
    // Create first project on start
    const created = createNewProject({ mode: initialMode });
    return created.id;
  });

  // Current project
  const [project, setProject] = useState<Project | null>(() => {
    return getProject(activeId) || null;
  });

  // Active conversation messages
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const p = getProject(activeId);
    return p?.messages || [];
  });

  // Input composer state
  const [inputMessage, setInputMessage] = useState('');
  const [workspaceMode, setWorkspaceMode] = useState<'problem_statement' | 'open_innovation'>(
    project?.mode || initialMode
  );
  const [attachedFiles, setAttachedFiles] = useState<AttachedFileMeta[]>([]);
  const [isExtractingFiles, setIsExtractingFiles] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const isDeprecatedOrRestricted = (m?: string) => {
    if (!m) return true;
    return ['llama-3.3-70b-versatile', 'gemma2-9b-it', 'mixtral-8x7b-32768', 'llama3-70b-8192', 'llama3-8b-8192'].includes(m);
  };

  // Model & Provider settings
  const [provider, setProvider] = useState<string>(() => project?.provider || 'groq');
  const [model, setModel] = useState<string>(() => {
    if (isDeprecatedOrRestricted(project?.model)) return 'openai/gpt-oss-120b';
    return project?.model || 'openai/gpt-oss-120b';
  });
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [credentialsVersion, setCredentialsVersion] = useState(0);

  const currentCred = getProviderCredential(provider);
  const hasActiveKey = Boolean(currentCred?.apiKey);

  // Sidebar and Tools panel states
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isToolsPanelOpen, setIsToolsPanelOpen] = useState(false);
  const [activeDeliverableType, setActiveDeliverableType] = useState<DeliverableType>('architecture');
  const [deliverableData, setDeliverableData] = useState<Record<string, any>>(() => project?.deliverables || {});
  const [isGeneratingDeliverable, setIsGeneratingDeliverable] = useState(false);
  const [deliverableError, setDeliverableError] = useState<string | null>(null);

  // Rename conversation state
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [titleEditValue, setTitleEditValue] = useState('');

  // Refs
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync when propProjectId or activeId changes
  useEffect(() => {
    if (propProjectId && propProjectId !== activeId) {
      setActiveId(propProjectId);
    }
  }, [propProjectId]);

  useEffect(() => {
    const p = getProject(activeId);
    if (p) {
      setProject(p);
      setMessages(p.messages || []);
      setDeliverableData(p.deliverables || {});
      if (p.provider) setProvider(p.provider);
      if (p.model) {
        setModel(isDeprecatedOrRestricted(p.model) ? 'openai/gpt-oss-120b' : p.model);
      }
      if (p.mode) setWorkspaceMode(p.mode);
      setActiveProjectId(activeId);
    }
    setAllProjectsList(getAllProjects());
  }, [activeId]);

  // Fetch available models for current provider
  const fetchModels = useCallback(async (prov: string) => {
    try {
      const cred = getProviderCredential(prov);
      const res = await fetch(`${API_BASE_URL}/api/llm/models?provider=${prov}`, {
        headers: cred?.apiKey ? { 'X-Provider-Key': cred.apiKey } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.models && data.models.length > 0) {
          const list: ModelOption[] = data.models.map((m: any) =>
            typeof m === 'string'
              ? { id: m, name: m, provider: prov }
              : { id: m.id, name: m.name || m.id, context_window: m.context_window, provider: prov }
          );
          setAvailableModels(list);
          const hasValid = list.some((m) => m.id === model);
          if (!hasValid && list.length > 0) {
            setModel(list[0].id);
          }
        }
      }
    } catch {
      // ignore
    }
  }, [model]);

  useEffect(() => {
    fetchModels(provider);
  }, [provider, fetchModels]);

  // Scroll bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Auto-resize composer textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  // Switch to new conversation
  const handleNewChat = (mode: 'problem_statement' | 'open_innovation' = 'problem_statement') => {
    const created = createNewProject({ mode });
    setAllProjectsList(getAllProjects());
    setActiveId(created.id);
    setAttachedFiles([]);
    setInputMessage('');
    setChatError(null);
  };

  // Delete a conversation
  const handleDeleteChat = (idToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteProject(idToDelete);
    const updated = getAllProjects();
    setAllProjectsList(updated);
    if (activeId === idToDelete) {
      if (updated.length > 0) {
        setActiveId(updated[0].id);
      } else {
        const created = createNewProject();
        setActiveId(created.id);
      }
    }
  };

  // Save conversation title
  const handleSaveTitle = (id: string) => {
    if (titleEditValue.trim()) {
      updateProject(id, { title: titleEditValue.trim() });
      setAllProjectsList(getAllProjects());
      if (activeId === id && project) {
        setProject({ ...project, title: titleEditValue.trim() });
      }
    }
    setEditingTitleId(null);
  };

  // File Upload & Text Extraction
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsExtractingFiles(true);
    setChatError(null);

    const newAttachments: AttachedFileMeta[] = [...attachedFiles];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileId = `file_${Date.now()}_${i}`;

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${API_BASE_URL}/api/stage1/extract-document`, {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          newAttachments.push({
            id: fileId,
            name: file.name,
            size: file.size,
            wordCount: data.word_count || 0,
            extractedText: data.text || '',
            type: file.type || 'text/plain',
          });
        } else {
          // Fallback text read
          const text = await file.text();
          newAttachments.push({
            id: fileId,
            name: file.name,
            size: file.size,
            wordCount: text.split(/\s+/).length,
            extractedText: text,
            type: file.type,
          });
        }
      } catch (err: any) {
        setChatError(`Could not extract ${file.name}: ${err.message || 'Check document format'}`);
      }
    }

    setAttachedFiles(newAttachments);
    setIsExtractingFiles(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveAttachment = (idToRemove: string) => {
    setAttachedFiles(attachedFiles.filter((f) => f.id !== idToRemove));
  };

  // Build grounded context from project + attachments with strict deduplication & budgeting
  const getContextString = () => {
    const parts: string[] = [];
    const seenTexts = new Set<string>();

    if (project?.problemStatement) {
      const trimmed = project.problemStatement.trim();
      if (trimmed) {
        parts.push(`=== ORIGINAL PROBLEM STATEMENT / IDEA ===\n${trimmed.slice(0, 5000)}`);
        seenTexts.add(trimmed.slice(0, 300));
      }
    }

    attachedFiles.forEach((f) => {
      const txt = f.extractedText?.trim();
      if (txt && !seenTexts.has(txt.slice(0, 300))) {
        parts.push(`=== ATTACHED DOCUMENT [${f.name}] ===\n${txt.slice(0, 5000)}`);
        seenTexts.add(txt.slice(0, 300));
      }
    });

    if (project?.attachedFiles) {
      project.attachedFiles.forEach((f) => {
        const txt = f.extractedText?.trim();
        if (txt && !seenTexts.has(txt.slice(0, 300))) {
          parts.push(`=== PREVIOUSLY ATTACHED DOCUMENT [${f.name}] ===\n${txt.slice(0, 5000)}`);
          seenTexts.add(txt.slice(0, 300));
        }
      });
    }

    // Budget combined context to max 6,000 characters (~1,500 tokens) to guarantee staying well under provider TPM limits
    const combined = parts.join('\n\n');
    return combined.length > 6000 ? combined.slice(0, 6000) + '\n...[context budgeted]' : combined;
  };

  // Stop generation
  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  };

  // Main message send handler
  const handleSendMessage = async (overridePrompt?: string) => {
    const textToSend = (overridePrompt || inputMessage).trim();
    const hasAttachments = attachedFiles.length > 0;
    if ((!textToSend && !hasAttachments) || isGenerating) return;

    setChatError(null);
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Construct user message
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}_u`,
      role: 'user',
      content: textToSend || `Please analyze the attached document: ${attachedFiles.map((f) => f.name).join(', ')}`,
      timestamp,
      attachments: hasAttachments ? [...attachedFiles] : undefined,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputMessage('');
    const currentAttachments = [...attachedFiles];
    setAttachedFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // Update active project with deduplicated context
    let cumulativeProblemText = project?.problemStatement || '';
    if (currentAttachments.length > 0) {
      const addedDocText = currentAttachments
        .map((f) => f.extractedText)
        .filter(Boolean)
        .join('\n\n')
        .trim();
      if (addedDocText && !cumulativeProblemText.includes(addedDocText.slice(0, 100))) {
        cumulativeProblemText = cumulativeProblemText ? `${cumulativeProblemText}\n\n${addedDocText}` : addedDocText;
      }
    } else if (!cumulativeProblemText && textToSend.length > 30) {
      cumulativeProblemText = textToSend;
    }

    // Auto title if first message
    const autoTitle =
      messages.length === 0
        ? currentAttachments[0]?.name || textToSend.slice(0, 40).replace(/[\r\n]+/g, ' ') || 'New Conversation'
        : project?.title || 'DevLens AI Chat';

    // Deduplicate attached files by name
    const existingFileNames = new Set((project?.attachedFiles || []).map((f) => f.name));
    const uniqueAttachments = currentAttachments.filter((f) => !existingFileNames.has(f.name));

    updateProject(activeId, {
      title: autoTitle,
      problemStatement: cumulativeProblemText,
      messages: updatedMessages,
      attachedFiles: [...(project?.attachedFiles || []), ...uniqueAttachments],
    });

    const cred = getProviderCredential(provider);
    if (!cred?.apiKey) {
      setChatError(`Please enter your ${provider.toUpperCase()} API key in Provider Settings before sending a message. DevLens AI connects to the AI provider only when you use the chat.`);
      setIsSettingsOpen(true);
      return;
    }

    setIsGenerating(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Trigger structured breakdown if the assistant hasn't replied yet in this problem statement conversation
    const hasAssistantReplied = messages.some((m) => m.role === 'assistant');
    const shouldExplainPS = !hasAssistantReplied && workspaceMode === 'problem_statement' && cumulativeProblemText.trim();

    if (shouldExplainPS) {
      try {
        const explainRes = await fetch(`${API_BASE_URL}/api/stage1/explain-ps`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Provider-Key': cred.apiKey,
          },
          body: JSON.stringify({
            problem_statement: cumulativeProblemText.slice(0, 6000),
            provider,
            model,
            api_key: cred.apiKey,
          }),
          signal: controller.signal,
        });

        if (explainRes.ok) {
          const analysis = await explainRes.json();
          // Format the first assistant response as structured markdown
          const markdownContent =
            analysis.markdown_content ||
            `## 🎯 Problem Overview\n${analysis.overview || analysis.overview_objective || 'No overview stated.'}\n\n` +
              `## 📌 Main Objective\n${analysis.title || 'Execute hackathon problem statement'}\n\n` +
              `## 🔍 Actual Problem to Solve\n${analysis.actual_problem || analysis.coreProblem || 'Core technical challenge identified in problem context.'}\n\n` +
              `## 👥 Target Users & Stakeholders\n${(analysis.target_users || analysis.target_users_stakeholders || []).map((u: string) => `- ${u}`).join('\n') || '- Identified in scope'}\n\n` +
              `## 📋 Requirements & Deliverables\n${(analysis.requirements || analysis.stated_requirements || []).map((r: string) => `- ${r}`).join('\n') || '- Deliver full stack implementation'}\n\n` +
              `## ⚠️ Constraints & Limitations\n${(analysis.constraints || analysis.constraints_limitations || []).map((c: string) => `- ${c}`).join('\n') || '- Standard hackathon judging criteria'}\n\n` +
              `## 🏆 Expected Outcomes\n${(analysis.expected_outcomes || [analysis.success_judging_criteria]).filter(Boolean).map((e: string) => `- ${e}`).join('\n') || '- Functional working demo with measurable impact'}\n\n` +
              `## 💡 Important Technical Concepts\n${(analysis.important_terms || []).map((t: string) => `- \`${t}\``).join('; ') || 'Domain specific architecture'}`;

          const assistantMsg: ChatMessage = {
            id: `msg_${Date.now()}_a`,
            role: 'assistant',
            content: markdownContent,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          };

          const finalizedMsgs = [...updatedMessages, assistantMsg];
          setMessages(finalizedMsgs);
          updateProject(activeId, {
            messages: finalizedMsgs,
            explanation: analysis,
          });
          setIsGenerating(false);
          return;
        } else {
          const errData = await explainRes.json().catch(() => ({}));
          throw new Error(errData.detail || `Provider returned error (${explainRes.status}). Please check your API key.`);
        }
      } catch (e: any) {
        if (e.name === 'AbortError') {
          setIsGenerating(false);
          return;
        }
        // Fallback to normal stream chat below
      }
    }

    // Standard streaming chat completion with budgeted messages
    const assistantIndex = updatedMessages.length;
    const initialAssistant: ChatMessage = {
      id: `msg_${Date.now()}_a`,
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([...updatedMessages, initialAssistant]);
    let accumulated = '';

    try {
      const streamUrl = `${API_BASE_URL}/api/llm/chat/stream`;
      const response = await fetch(streamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cred?.apiKey ? { 'X-Provider-Key': cred.apiKey } : {}),
        },
        body: JSON.stringify({
          provider,
          model,
          messages: updatedMessages.slice(-6).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) })),
          context: getContextString(),
          system_prompt:
            'You are DevLens AI, an elite hackathon mentor and technical architect. Converse naturally like ChatGPT and Claude. Format all responses in clean, rich GitHub Markdown using clear headings (## and ###), bullet points, and code blocks. Never output raw JSON dictionaries or robotic code objects unless specifically asked.',
          api_key: cred?.apiKey,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.detail || `HTTP ${response.status}: Failed to stream response`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      if (!reader) throw new Error('Response body stream is unavailable.');

      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') break;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                accumulated += parsed.text;
                setMessages((prev) => {
                  const copy = [...prev];
                  if (copy[assistantIndex]) {
                    copy[assistantIndex] = { ...copy[assistantIndex], content: accumulated };
                  }
                  return copy;
                });
              } else if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (err: any) {
              if (err.message && err.message !== 'Unexpected end of JSON input') {
                throw err;
              }
            }
          }
        }
      }

      if (accumulated.trim()) {
        const finalMsgs = [
          ...updatedMessages,
          {
            id: `msg_${Date.now()}_a`,
            role: 'assistant' as const,
            content: accumulated,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ];
        updateProject(activeId, { messages: finalMsgs });
      } else {
        // Fallback non-streaming request
        const nonStreamRes = await fetch(`${API_BASE_URL}/api/stage1/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(cred?.apiKey ? { 'X-Provider-Key': cred.apiKey } : {}),
          },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
            context: getContextString(),
            provider,
            model,
            api_key: cred?.apiKey,
          }),
        });
        if (nonStreamRes.ok) {
          const nsData = await nonStreamRes.json();
          const reply = nsData.reply || 'No response generated.';
          const finalMsgs = [
            ...updatedMessages,
            {
              id: `msg_${Date.now()}_a`,
              role: 'assistant' as const,
              content: reply,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ];
          setMessages(finalMsgs);
          updateProject(activeId, { messages: finalMsgs });
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setChatError(err.message || 'Error communicating with AI reasoning service.');
      setMessages((prev) => {
        if (prev[assistantIndex] && !prev[assistantIndex].content.trim()) {
          return prev.filter((_, i) => i !== assistantIndex);
        }
        return prev;
      });
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  // Regenerate last assistant response
  const handleRegenerate = () => {
    if (messages.length === 0 || isGenerating) return;
    let lastUserIndex = -1;
    let lastUserText = '';
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserIndex = i;
        lastUserText = messages[i].content;
        break;
      }
    }
    if (lastUserIndex >= 0) {
      const trimmed = messages.slice(0, lastUserIndex);
      setMessages(trimmed);
      handleSendMessage(lastUserText);
    }
  };

  // Trigger contextual deliverable generator
  const handleGenerateDeliverable = async (type: DeliverableType) => {
    setActiveDeliverableType(type);
    setIsToolsPanelOpen(true);
    setIsGeneratingDeliverable(true);
    setDeliverableError(null);

    const cred = getProviderCredential(provider);
    if (!cred?.apiKey) {
      setDeliverableError(`Please enter your ${provider.toUpperCase()} API key in Provider Settings to generate blueprints.`);
      setIsGeneratingDeliverable(false);
      setIsSettingsOpen(true);
      return;
    }

    const contextStr = getContextString();
    const conversationNotes = messages
      .slice(-6)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n');

    try {
      const res = await fetch(`${API_BASE_URL}/api/stage1/generate-deliverable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cred?.apiKey ? { 'X-Provider-Key': cred.apiKey } : {}),
        },
        body: JSON.stringify({
          deliverable_type: type,
          context: contextStr || 'DevLens AI Hackathon Project',
          conversation_notes: conversationNotes,
          provider,
          model,
          api_key: cred?.apiKey,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Failed to generate ${type} blueprint.`);
      }

      const data = await res.json();
      const updated = {
        ...deliverableData,
        [type]: data,
      };
      setDeliverableData(updated);
      updateProject(activeId, { deliverables: updated });
    } catch (err: any) {
      setDeliverableError(err.message || `Error generating ${type}`);
    } finally {
      setIsGeneratingDeliverable(false);
    }
  };

  // Render formatted markdown inside chat bubbles using custom high-fidelity MarkdownRenderer
  const renderMessageContent = (content: string) => {
    const formattedContent = formatJsonToMarkdown(content);
    return (
      <MarkdownRenderer
        content={formattedContent}
        renderMermaid={(code) => <MermaidViewer code={code} />}
      />
    );
  };

  return (
    <div className="flex h-screen bg-[#FDFCFB] overflow-hidden font-sans antialiased text-[#1A1D29]">
      {/* ── LEFT SIDEBAR (COLLAPSIBLE) ────────────────────────────────────────── */}
      <aside
        className={`${
          isLeftSidebarOpen ? 'w-64 sm:w-72' : 'w-0'
        } shrink-0 bg-[#FAFAF7] border-r border-[#E5E1DA] flex flex-col transition-all duration-200 overflow-hidden z-20`}
      >
        {/* Sidebar Header */}
        <div className="p-3.5 border-b border-[#E5E1DA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#E85D2C] text-white flex items-center justify-center font-bold text-xs shadow-xs">
              DL
            </div>
            <div>
              <span className="font-display font-bold text-xs tracking-tight text-[#1A1D29] block">
                DevLens AI
              </span>
              <span className="text-[10px] font-mono text-[#E85D2C] block">Stage 1: Explore</span>
            </div>
          </div>
          <button
            onClick={() => setIsLeftSidebarOpen(false)}
            className="p-1 rounded text-[#6B7280] hover:text-[#1A1D29] hover:bg-white cursor-pointer"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* New Chat Action */}
        <div className="p-3 border-b border-[#E5E1DA]/80">
          <button
            onClick={() => handleNewChat(workspaceMode)}
            className="w-full py-2 px-3 rounded-xl bg-white hover:bg-[#FFF4EE] border border-[#E5E1DA] hover:border-[#E85D2C]/40 text-xs font-mono font-semibold text-[#1A1D29] flex items-center justify-between transition-colors shadow-xs cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <Plus className="w-3.5 h-3.5 text-[#E85D2C] group-hover:rotate-90 transition-transform" />
              <span>New Conversation</span>
            </div>
            <span className="text-[10px] text-[#6B7280] font-normal">Ctrl+K</span>
          </button>
        </div>

        {/* Mode Selector Pill inside Sidebar */}
        <div className="px-3 pt-2 pb-1 flex gap-1">
          <button
            onClick={() => setWorkspaceMode('problem_statement')}
            className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-mono text-center font-semibold transition-colors ${
              workspaceMode === 'problem_statement'
                ? 'bg-[#E85D2C] text-white'
                : 'text-[#6B7280] hover:bg-white hover:text-[#1A1D29]'
            }`}
          >
            Problem Statement
          </button>
          <button
            onClick={() => setWorkspaceMode('open_innovation')}
            className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-mono text-center font-semibold transition-colors ${
              workspaceMode === 'open_innovation'
                ? 'bg-[#E85D2C] text-white'
                : 'text-[#6B7280] hover:bg-white hover:text-[#1A1D29]'
            }`}
          >
            Open Innovation
          </button>
        </div>

        {/* Recent Conversations List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-[#6B7280] font-bold">
            Recent Chats ({allProjectsList.length})
          </div>
          {allProjectsList.map((p) => {
            const isActive = p.id === activeId;
            return (
              <div
                key={p.id}
                onClick={() => setActiveId(p.id)}
                className={`group px-2.5 py-2 rounded-xl text-xs font-mono transition-colors flex items-center justify-between cursor-pointer ${
                  isActive
                    ? 'bg-white border border-[#E85D2C]/40 text-[#E85D2C] shadow-xs'
                    : 'text-[#1A1D29] hover:bg-white border border-transparent hover:border-[#E5E1DA]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#E85D2C]' : 'text-[#6B7280]'}`} />
                  {editingTitleId === p.id ? (
                    <input
                      type="text"
                      value={titleEditValue}
                      onChange={(e) => setTitleEditValue(e.target.value)}
                      onBlur={() => handleSaveTitle(p.id)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle(p.id)}
                      autoFocus
                      className="w-full bg-transparent border-b border-[#E85D2C] focus:outline-none text-xs"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="truncate flex-1 text-[11px] font-medium">{p.title || 'Untitled Chat'}</span>
                  )}
                </div>

                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 ml-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTitleId(p.id);
                      setTitleEditValue(p.title || '');
                    }}
                    className="p-1 hover:text-[#1A1D29] text-[#6B7280]"
                    title="Rename"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => handleDeleteChat(p.id, e)}
                    className="p-1 hover:text-red-600 text-[#6B7280]"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer: Stage 2 & Provider Settings */}
        <div className="p-3 border-t border-[#E5E1DA] bg-white space-y-2">
          <button
            onClick={onGoToStage2}
            className="w-full py-2 px-3 rounded-xl bg-[#3B5FE0]/10 hover:bg-[#3B5FE0]/20 border border-[#3B5FE0]/30 text-xs font-mono font-semibold text-[#3B5FE0] flex items-center justify-between transition-colors cursor-pointer"
          >
            <span>Stage 2: Defense Suite</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-full py-1.5 px-3 rounded-xl border border-[#E5E1DA] hover:border-[#1A1D29] text-xs font-mono text-[#6B7280] hover:text-[#1A1D29] flex items-center justify-between transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-3.5 h-3.5 text-[#E85D2C]" />
              <span>AI Provider Keys</span>
            </div>
            <span
              className={`w-2 h-2 rounded-full ${
                getProviderCredential(provider) ? 'bg-emerald-500' : 'bg-amber-400'
              }`}
            />
          </button>
        </div>
      </aside>

      {/* ── MAIN WORKSPACE AREA ────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Workspace Top Header */}
        <header className="h-14 border-b border-[#E5E1DA] bg-[#FDFCFB]/95 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3">
            {!isLeftSidebarOpen && (
              <button
                onClick={() => setIsLeftSidebarOpen(true)}
                className="p-1.5 rounded-lg border border-[#E5E1DA] hover:border-[#1A1D29] bg-white text-[#6B7280] hover:text-[#1A1D29] transition-colors cursor-pointer"
                title="Open sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#1A1D29] truncate max-w-[200px] sm:max-w-md">
                {project?.title || 'DevLens AI Workspace'}
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-[#E85D2C]/10 text-[#E85D2C]">
                {workspaceMode === 'problem_statement' ? 'Problem Statement' : 'Open Innovation'}
              </span>
            </div>
          </div>

          {/* Model Selector & Action Badges */}
          <div className="flex items-center gap-2">
            {/* Active Key Status Pill */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs ${
                hasActiveKey
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 font-semibold'
              }`}
              title={
                hasActiveKey
                  ? `${provider.toUpperCase()} key is saved. Connection activates when you chat.`
                  : `API key needed for ${provider.toUpperCase()}. Click to configure.`
              }
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  hasActiveKey ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                }`}
              />
              <span className="hidden sm:inline">
                {hasActiveKey ? 'Key Ready' : 'Key Required'}
              </span>
            </button>

            {/* Quick Model Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="px-2.5 py-1.5 rounded-xl border border-[#E5E1DA] hover:border-[#E85D2C] bg-white text-xs font-mono text-[#1A1D29] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              >
                <span className={`w-2 h-2 rounded-full ${hasActiveKey ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                <span className="font-bold text-[#E85D2C] uppercase text-[10px]">{provider}</span>
                <span className="truncate max-w-[120px]">{model}</span>
              </button>

              {isModelDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-[#E5E1DA] rounded-xl shadow-xl z-50 p-2 space-y-1 animate-fade-in max-h-72 overflow-y-auto">
                  <div className="px-2 py-1 text-[10px] font-mono uppercase text-[#6B7280] font-bold">
                    Models for {provider.toUpperCase()}
                  </div>
                  {availableModels.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setModel(m.id);
                        setIsModelDropdownOpen(false);
                        updateProject(activeId, { model: m.id });
                      }}
                      className={`w-full text-left p-2 rounded-lg text-xs font-mono transition-colors flex items-center justify-between cursor-pointer ${
                        m.id === model ? 'bg-[#FFF4EE] text-[#E85D2C] font-semibold' : 'hover:bg-gray-50 text-[#1A1D29]'
                      }`}
                    >
                      <span className="truncate">{m.name}</span>
                      {m.id === model && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  ))}
                  <div className="pt-1 border-t border-[#E5E1DA]">
                    <button
                      onClick={() => {
                        setIsModelDropdownOpen(false);
                        setIsSettingsOpen(true);
                      }}
                      className="w-full text-left p-2 rounded-lg text-xs font-mono text-[#E85D2C] hover:bg-[#FFF4EE] font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Configure Providers & Keys...</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Contextual Tools Panel Toggle */}
            <button
              onClick={() => setIsToolsPanelOpen(!isToolsPanelOpen)}
              className={`p-1.5 rounded-lg border text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer ${
                isToolsPanelOpen
                  ? 'bg-[#E85D2C] border-[#E85D2C] text-white'
                  : 'bg-white border-[#E5E1DA] hover:border-[#1A1D29] text-[#6B7280] hover:text-[#1A1D29]'
              }`}
              title="Toggle Project Tools Panel"
            >
              <Layers className="w-4 h-4" />
              <span className="hidden sm:inline">Tools</span>
            </button>
          </div>
        </header>

        {/* ── CONVERSATION STREAM OR "WHAT ARE WE BUILDING TODAY?" ─────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 max-w-4xl w-full mx-auto flex flex-col justify-between">
          {messages.length === 0 ? (
            /* INITIAL WORKSPACE: "WHAT ARE WE BUILDING TODAY?" */
            <div className="flex-1 flex flex-col items-center justify-center text-center my-auto py-8 space-y-6">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-[#E85D2C]/10 text-[#E85D2C] font-bold border border-[#E85D2C]/20">
                  <Sparkles className="w-3.5 h-3.5" />
                  DevLens AI — Stage 1: Explore & Plan
                </span>
                <h1 className="text-3xl sm:text-4xl font-display font-bold text-[#1A1D29] tracking-tight">
                  What are we building today?
                </h1>
                <p className="text-sm font-sans text-[#6B7280] max-w-xl mx-auto leading-relaxed">
                  Understand your problem statement, research innovative solutions, explore technical approaches, and
                  turn your ideas into a build-ready project.
                </p>
              </div>

              {/* Two Entry Modes */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => setWorkspaceMode('problem_statement')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                    workspaceMode === 'problem_statement'
                      ? 'bg-[#E85D2C] text-white shadow-xs'
                      : 'bg-white border border-[#E5E1DA] text-[#6B7280] hover:text-[#1A1D29]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>1. Problem Statement Track</span>
                </button>
                <button
                  onClick={() => setWorkspaceMode('open_innovation')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                    workspaceMode === 'open_innovation'
                      ? 'bg-[#E85D2C] text-white shadow-xs'
                      : 'bg-white border border-[#E5E1DA] text-[#6B7280] hover:text-[#1A1D29]'
                  }`}
                >
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>2. Open Innovation Track</span>
                </button>
              </div>

              {/* Starter Suggestions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-2xl text-left pt-2">
                {STARTER_PROMPTS.map((starter, i) => (
                  <button
                    key={i}
                    onClick={() => handleSendMessage(starter.prompt)}
                    className="p-3 rounded-xl border border-[#E5E1DA] hover:border-[#E85D2C]/40 bg-white hover:bg-[#FFF4EE]/30 transition-all text-left group shadow-2xs cursor-pointer"
                  >
                    <div className="text-xs font-mono font-bold text-[#1A1D29] group-hover:text-[#E85D2C] flex items-center justify-between">
                      <span>{starter.title}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#E85D2C] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="text-[11px] font-sans text-[#6B7280] mt-0.5">{starter.subtitle}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ACTIVE CONVERSATION THREAD */
            <div className="space-y-6 pb-6">
              {messages.map((m) => {
                const isUser = m.role === 'user';
                return (
                  <div
                    key={m.id}
                    className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}
                  >
                    {!isUser && (
                      <div className="w-7 h-7 rounded-lg bg-[#E85D2C] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-xs">
                        DL
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] sm:max-w-[78%] rounded-2xl p-4 shadow-xs ${
                        isUser
                          ? 'bg-[#FFF4EE] border border-[#E85D2C]/30 text-[#1A1D29]'
                          : 'bg-white border border-[#E5E1DA] text-[#1A1D29]'
                      }`}
                    >
                      {/* Attached Document Chips in User Messages */}
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3 pb-2.5 border-b border-[#E85D2C]/20">
                          {m.attachments.map((att) => (
                            <div
                              key={att.id}
                              className="px-2.5 py-1 rounded-lg bg-white border border-[#E85D2C]/30 text-[11px] font-mono text-[#E85D2C] flex items-center gap-1.5"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span className="font-semibold">{att.name}</span>
                              {att.wordCount && (
                                <span className="text-[10px] text-[#6B7280]">({att.wordCount} words)</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Message Body */}
                      <div className="text-xs leading-relaxed">{renderMessageContent(m.content)}</div>

                      {/* Bottom Message Actions */}
                      <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px] font-mono text-[#6B7280]">
                        <span>{m.timestamp}</span>
                        {!isUser && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => navigator.clipboard.writeText(m.content)}
                              className="hover:text-[#1A1D29] flex items-center gap-1 cursor-pointer"
                              title="Copy response"
                            >
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </button>
                            <button
                              onClick={handleRegenerate}
                              className="hover:text-[#E85D2C] flex items-center gap-1 cursor-pointer"
                              title="Regenerate"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Regenerate</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {isUser && (
                      <div className="w-7 h-7 rounded-lg bg-gray-200 text-gray-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })}

              {isGenerating && (
                <div className="flex gap-3 justify-start items-center text-xs font-mono text-[#6B7280]">
                  <div className="w-7 h-7 rounded-lg bg-[#E85D2C] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                    DL
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-[#E5E1DA]">
                    <Loader2 className="w-3.5 h-3.5 text-[#E85D2C] animate-spin" />
                    <span>DevLens AI is reasoning and formatting...</span>
                    <button
                      onClick={handleStop}
                      className="ml-2 px-2 py-0.5 rounded text-[10px] bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 cursor-pointer"
                    >
                      Stop
                    </button>
                  </div>
                </div>
              )}

              {chatError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-mono text-red-700 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Generation Error</p>
                    <p className="text-[11px] mt-0.5">{chatError}</p>
                    <button
                      onClick={() => setIsSettingsOpen(true)}
                      className="mt-2 px-2.5 py-1 rounded-lg bg-white border border-red-300 text-red-700 hover:bg-red-50 text-[10px] font-bold cursor-pointer"
                    >
                      Open Provider Settings
                    </button>
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>
          )}

          {/* ── CENTRAL PROMPT COMPOSER ────────────────────────────────────────── */}
          <div className="sticky bottom-0 pt-2 pb-4 bg-gradient-to-t from-[#FDFCFB] via-[#FDFCFB] to-transparent">
            {/* Attachment Chips Preview */}
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2 p-2 rounded-xl bg-white border border-[#E5E1DA] shadow-xs">
                {attachedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FFF4EE] border border-[#E85D2C]/30 text-xs font-mono text-[#E85D2C]"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span className="font-semibold truncate max-w-[160px]">{file.name}</span>
                    <span className="text-[10px] text-[#6B7280]">
                      ({file.wordCount || Math.round(file.size / 1024)} {file.wordCount ? 'words' : 'KB'})
                    </span>
                    <button
                      onClick={() => handleRemoveAttachment(file.id)}
                      className="text-[#6B7280] hover:text-red-600 p-0.5 rounded cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="relative rounded-2xl border border-[#E5E1DA] bg-white shadow-md focus-within:border-[#E85D2C] focus-within:ring-1 focus-within:ring-[#E85D2C] transition-all">
              <textarea
                ref={textareaRef}
                value={inputMessage}
                onChange={handleTextareaChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                rows={1}
                placeholder={
                  workspaceMode === 'problem_statement'
                    ? 'Upload document or ask about requirements, tech stack, architecture, APIs...'
                    : 'Describe an open innovation idea, research topic, or hackathon theme...'
                }
                className="w-full pt-3 pb-12 px-4 text-xs font-mono bg-transparent text-[#1A1D29] placeholder-[#9CA3AF] resize-none focus:outline-none min-h-[48px]"
              />

              {/* Composer Bottom Toolbar */}
              <div className="absolute left-3 right-3 bottom-2 flex items-center justify-between pointer-events-auto">
                <div className="flex items-center gap-1.5">
                  {/* File Upload Attachment Button */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.txt,.md,.json,.csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isExtractingFiles}
                    className="p-1.5 rounded-lg border border-[#E5E1DA] hover:border-[#E85D2C] hover:bg-[#FFF4EE] text-[#6B7280] hover:text-[#E85D2C] transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-mono disabled:opacity-50"
                    title="Attach problem statement (PDF, DOCX, TXT, Markdown)"
                  >
                    {isExtractingFiles ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E85D2C]" />
                    ) : (
                      <Paperclip className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">Attach Doc</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(true)}
                    className="p-1.5 rounded-lg border border-[#E5E1DA] hover:border-[#1A1D29] text-[#6B7280] hover:text-[#1A1D29] text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                    title="Configure AI Providers"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#E85D2C]" />
                    <span className="hidden sm:inline uppercase text-[10px] font-bold text-[#E85D2C]">{provider}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-[#9CA3AF] hidden sm:inline">
                    Enter to send, Shift+Enter for newline
                  </span>
                  {isGenerating ? (
                    <button
                      type="button"
                      onClick={handleStop}
                      className="p-2 rounded-xl bg-red-600 hover:bg-red-700 text-white transition-all shadow-xs cursor-pointer"
                      title="Stop generation"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSendMessage()}
                      disabled={!inputMessage.trim() && attachedFiles.length === 0}
                      className="p-2 rounded-xl bg-[#E85D2C] hover:bg-[#D45022] text-white transition-all shadow-xs disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                      title="Send message"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── RIGHT CONTEXTUAL TOOLS PANEL (COLLAPSIBLE) ───────────────────────── */}
      <aside
        className={`${
          isToolsPanelOpen ? 'w-80 sm:w-96' : 'w-0'
        } shrink-0 bg-white border-l border-[#E5E1DA] flex flex-col transition-all duration-200 overflow-hidden z-20`}
      >
        <div className="p-3.5 border-b border-[#E5E1DA] flex items-center justify-between bg-[#FAFAF7]">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#E85D2C]" />
            <h3 className="font-display font-bold text-xs text-[#1A1D29]">Contextual Project Tools</h3>
          </div>
          <button
            onClick={() => setIsToolsPanelOpen(false)}
            className="p-1 rounded text-[#6B7280] hover:text-[#1A1D29] hover:bg-white cursor-pointer"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        </div>

        {/* Deliverable Tools Selector */}
        <div className="p-3 border-b border-[#E5E1DA] overflow-x-auto flex gap-1.5 scrollbar-none">
          {DELIVERABLE_TOOLS.map((tool) => {
            const isSelected = tool.type === activeDeliverableType;
            return (
              <button
                key={tool.type}
                onClick={() => handleGenerateDeliverable(tool.type)}
                className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-mono whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  isSelected
                    ? 'border-[#E85D2C] bg-[#FFF4EE] text-[#E85D2C] font-bold shadow-2xs'
                    : 'border-[#E5E1DA] bg-white text-[#6B7280] hover:text-[#1A1D29]'
                }`}
              >
                {tool.icon}
                <span>{tool.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Tool Output Viewer */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E5E1DA]">
            <div>
              <h4 className="text-xs font-mono font-bold text-[#1A1D29]">
                {DELIVERABLE_TOOLS.find((t) => t.type === activeDeliverableType)?.label}
              </h4>
              <p className="text-[10px] font-mono text-[#6B7280]">
                {DELIVERABLE_TOOLS.find((t) => t.type === activeDeliverableType)?.desc}
              </p>
            </div>
            <button
              onClick={() => handleGenerateDeliverable(activeDeliverableType)}
              disabled={isGeneratingDeliverable}
              className="px-2.5 py-1 rounded-lg border border-[#E5E1DA] hover:border-[#1A1D29] text-[10px] font-mono text-[#1A1D29] font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {isGeneratingDeliverable ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
              <span>Regenerate</span>
            </button>
          </div>

          {isGeneratingDeliverable ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-6 h-6 text-[#E85D2C] animate-spin" />
              <p className="text-xs font-mono text-[#6B7280]">Synthesizing technical deliverable from project context...</p>
            </div>
          ) : deliverableError ? (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-mono text-red-700">
              {deliverableError}
            </div>
          ) : deliverableData[activeDeliverableType] ? (
            <div className="space-y-3">
              {/* If Mermaid present, render Visual Mermaid Viewer */}
              {deliverableData[activeDeliverableType]?.mermaid && (
                <MermaidViewer code={deliverableData[activeDeliverableType].mermaid} />
              )}

              {/* Formatted JSON / Deliverable content */}
              <div className="p-3.5 rounded-xl bg-[#FAFAF7] border border-[#E5E1DA] space-y-3 text-xs font-mono">
                {Object.entries(deliverableData[activeDeliverableType]).map(([key, val]) => {
                  if (key === 'mermaid') return null;
                  return (
                    <div key={key} className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-[#E85D2C] tracking-wider block">
                        {key.replace(/_/g, ' ')}
                      </span>
                      {typeof val === 'string' ? (
                        <p className="text-[#1A1D29] leading-relaxed">{val}</p>
                      ) : Array.isArray(val) ? (
                        <ul className="space-y-1 pl-2">
                          {val.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 text-[#1A1D29]">
                              <span className="w-1 h-1 rounded-full bg-[#E85D2C] mt-1.5 shrink-0" />
                              <span>{typeof item === 'object' ? JSON.stringify(item) : String(item)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <pre className="p-2 rounded bg-white text-[11px] overflow-x-auto text-gray-800">
                          {JSON.stringify(val, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs font-mono text-[#6B7280] space-y-2">
              <p>No blueprint generated yet.</p>
              <button
                onClick={() => handleGenerateDeliverable(activeDeliverableType)}
                className="px-3.5 py-1.5 rounded-xl bg-[#E85D2C] text-white font-semibold text-xs cursor-pointer shadow-xs"
              >
                Generate Blueprint
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── PROVIDER SETTINGS MODAL ───────────────────────────────────────────── */}
      <ProviderSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeProvider={provider}
        activeModel={model}
        onSelectProviderModel={(newProv, newModel) => {
          setProvider(newProv);
          setModel(newModel);
          setCredentialsVersion((v) => v + 1);
          setChatError(null);
          setDeliverableError(null);
          updateProject(activeId, { provider: newProv, model: newModel });
        }}
      />
    </div>
  );
}
