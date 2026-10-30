import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  Send,
  Square,
  RotateCcw,
  Sparkles,
  Sliders,
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
  Zap,
} from 'lucide-react';
import { API_BASE_URL } from '../lib/apiClient';
import {
  Project,
  ChatMessage,
  PSExplanation,
  getProject,
  updateProject,
  getActiveProjectId,
  setActiveProjectId,
  createNewProject,
  getProviderCredential,
} from '../lib/projectStore';
import ProviderSettingsModal from './ProviderSettingsModal';

interface AIWorkspaceChatProps {
  projectId: string;
  onBackToPS: () => void;
  onGoToStage2: () => void;
  onSelectProject?: (id: string) => void;
}

type DeliverableType =
  | 'architecture'
  | 'workflows'
  | 'tech_stack'
  | 'implementation_plan'
  | 'db_api_design'
  | 'pitch_deck';

const DELIVERABLE_TOOLS: {
  type: DeliverableType;
  label: string;
  desc: string;
  icon: React.ReactNode;
}[] = [
  {
    type: 'architecture',
    label: 'Architecture',
    desc: 'C4 diagrams, components & data flow sequences',
    icon: <Layers className="w-4 h-4 text-[#E85D2C]" />,
  },
  {
    type: 'workflows',
    label: 'Workflows',
    desc: 'End-to-end user journeys & interaction logic',
    icon: <GitPullRequest className="w-4 h-4 text-[#3B5FE0]" />,
  },
  {
    type: 'tech_stack',
    label: 'Tech Stack',
    desc: 'Frameworks, databases & defensible trade-offs',
    icon: <Cpu className="w-4 h-4 text-[#059669]" />,
  },
  {
    type: 'implementation_plan',
    label: 'Plan & Milestones',
    desc: 'Sprint timeline, tasks & critical path risks',
    icon: <Sparkles className="w-4 h-4 text-[#7C3AED]" />,
  },
  {
    type: 'db_api_design',
    label: 'DB & API Schemas',
    desc: 'Entity models, REST endpoints & payload contracts',
    icon: <Database className="w-4 h-4 text-[#D97706]" />,
  },
  {
    type: 'pitch_deck',
    label: 'Pitch Deck / PPT',
    desc: 'Winning 3-minute hackathon pitch storyline',
    icon: <Presentation className="w-4 h-4 text-[#E11D48]" />,
  },
];

const SUGGESTION_PROMPTS = [
  'What are 3 unique selling points (USPs) that make this solution stand out?',
  'Recommend the most cost-effective, low-latency tech stack for a 48h demo.',
  'What edge cases or security concerns should we anticipate during judging?',
  'What should be our 2-minute golden-path demo script for the judges?',
  'Help me design the core database entities and relationships.',
  'Compare building this with PostgreSQL vs MongoDB for our specific requirements.',
];

export default function AIWorkspaceChat({
  projectId,
  onBackToPS,
  onGoToStage2,
}: AIWorkspaceChatProps) {
  const [project, setProject] = useState<Project | null>(() => {
    if (projectId) {
      const found = getProject(projectId);
      if (found) return found;
    }
    const active = getActiveProjectId();
    return active ? getProject(active) : null;
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const targetId = projectId || getActiveProjectId();
    const p = targetId ? getProject(targetId) : null;
    return p?.messages || [];
  });

  const [inputMessage, setInputMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'auth' | 'rate_limit' | 'general' | null>(null);

  // Model & Provider state
  const [provider, setProvider] = useState<string>(() => project?.provider || 'groq');
  const [model, setModel] = useState<string>(() => project?.model || 'openai/gpt-oss-120b');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // UI state
  const [isPSDrawerOpen, setIsPSDrawerOpen] = useState(false);
  const [isToolsSidebarOpen, setIsToolsSidebarOpen] = useState(false);
  const [activeDeliverableType, setActiveDeliverableType] = useState<DeliverableType | null>(null);
  const [deliverableData, setDeliverableData] = useState<Record<string, any>>(() => {
    const targetId = projectId || getActiveProjectId();
    const p = targetId ? getProject(targetId) : null;
    return p?.deliverables || {};
  });
  const [isGeneratingDeliverable, setIsGeneratingDeliverable] = useState(false);
  const [deliverableError, setDeliverableError] = useState<string | null>(null);

  // Clipboard & scrolling
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load project on mount or projectId change
  useEffect(() => {
    if (!projectId) return;
    const p = getProject(projectId);
    if (p) {
      setProject(p);
      setMessages(p.messages || []);
      setDeliverableData(p.deliverables || {});
      if (p.provider) setProvider(p.provider);
      if (p.model) setModel(p.model);
    }
  }, [projectId]);

  // Load available models for active provider
  const fetchModels = useCallback(async (prov: string) => {
    setIsLoadingModels(true);
    try {
      const cred = getProviderCredential(prov);
      const res = await fetch(`${API_BASE_URL}/api/llm/models?provider=${prov}`, {
        headers: cred?.apiKey ? { 'X-Provider-Key': cred.apiKey } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.models && data.models.length > 0) {
          setAvailableModels(data.models);
          if (!data.models.includes(model)) {
            setModel(data.models[0]);
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingModels(false);
    }
  }, [model]);

  useEffect(() => {
    fetchModels(provider);
  }, [provider, fetchModels]);

  // Scroll to bottom on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Build full grounded context string
  const getFullContextString = () => {
    if (!project) return '';
    const parts: string[] = [];
    if (project.problemStatement) {
      parts.push(`=== ORIGINAL PROBLEM STATEMENT ===\n${project.problemStatement}`);
    }
    if (project.explanation) {
      parts.push(
        `=== STRUCTURED PS ANALYSIS ===\nOverview: ${project.explanation.overview}\nCore Problem: ${project.explanation.coreProblem}\nStakeholders: ${project.explanation.targetUsers?.join(', ')}\nRequirements: ${project.explanation.requirements?.join('; ')}\nConstraints: ${project.explanation.constraints?.join('; ')}\nSuccess Criteria: ${project.explanation.successCriteria?.join('; ')}`
      );
    }
    return parts.join('\n\n');
  };

  // Stop Generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  };

  // Send message with streaming or fallback
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputMessage).trim();
    if (!textToSend || isGenerating) return;

    setChatError(null);
    setErrorType(null);

    const userMsg: ChatMessage = {
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    if (projectId) {
      updateProject(projectId, { messages: updatedMessages });
    }

    setIsGenerating(true);

    const cred = getProviderCredential(provider);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Create placeholder for assistant response
    const assistantIndex = updatedMessages.length;
    const initialAssistantMsg: ChatMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([...updatedMessages, initialAssistantMsg]);

    const contextStr = getFullContextString();
    let accumulatedText = '';

    try {
      // Try SSE stream
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
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
          context: contextStr,
          api_key: cred?.apiKey,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errDetail = 'Failed to generate response.';
        try {
          const errJson = await response.json();
          errDetail = errJson.detail || errDetail;
        } catch {
          // ignore
        }

        if (response.status === 401 || errDetail.toLowerCase().includes('api key') || errDetail.toLowerCase().includes('auth')) {
          setErrorType('auth');
          throw new Error(`Authentication error with ${provider}: ${errDetail}. Click Settings to provide a valid API key.`);
        } else if (response.status === 429 || errDetail.toLowerCase().includes('rate limit')) {
          setErrorType('rate_limit');
          throw new Error(`Rate limit reached for ${provider}. Please switch models or wait a moment.`);
        } else {
          setErrorType('general');
          throw new Error(errDetail);
        }
      }

      // Read SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');

      if (!reader) {
        throw new Error('Streaming response body is unavailable.');
      }

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
              if (parsed.content) {
                accumulatedText += parsed.content;
                setMessages((prev) => {
                  const copy = [...prev];
                  if (copy[assistantIndex]) {
                    copy[assistantIndex] = {
                      ...copy[assistantIndex],
                      content: accumulatedText,
                    };
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

      // If streaming finished with accumulated text, save to project store
      if (accumulatedText.trim() && projectId) {
        const finalMsgs = [
          ...updatedMessages,
          {
            role: 'assistant' as const,
            content: accumulatedText,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ];
        updateProject(projectId, { messages: finalMsgs });
      } else if (!accumulatedText.trim()) {
        // Fallback: If streaming yielded nothing, try standard non-streaming chat
        const fallbackRes = await fetch(`${API_BASE_URL}/api/stage1/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(cred?.apiKey ? { 'X-Provider-Key': cred.apiKey } : {}),
          },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({ role: m.role, content: m.content })),
            context: contextStr,
            provider,
            model,
            api_key: cred?.apiKey,
          }),
        });
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          const reply = fallbackData.reply || 'No response generated.';
          const finalMsgs = [
            ...updatedMessages,
            {
              role: 'assistant' as const,
              content: reply,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ];
          setMessages(finalMsgs);
          if (projectId) updateProject(projectId, { messages: finalMsgs });
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User deliberately aborted
        return;
      }
      setChatError(err.message || 'Error communicating with AI reasoning service.');
      // Remove empty assistant placeholder on error
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

  // Retry / Regenerate latest message
  const handleRegenerate = () => {
    if (messages.length === 0 || isGenerating) return;
    // Find last user prompt
    let lastUserPrompt = '';
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserPrompt = messages[i].content;
        // Trim messages up to that user message
        const trimmed = messages.slice(0, i);
        setMessages(trimmed);
        if (projectId) updateProject(projectId, { messages: trimmed });
        break;
      }
    }
    if (lastUserPrompt) {
      handleSendMessage(lastUserPrompt);
    }
  };

  // Generate Deliverable
  const handleGenerateDeliverable = async (type: DeliverableType) => {
    setActiveDeliverableType(type);
    setIsToolsSidebarOpen(true);
    setIsGeneratingDeliverable(true);
    setDeliverableError(null);

    const cred = getProviderCredential(provider);
    const contextStr = getFullContextString();

    try {
      const response = await fetch(`${API_BASE_URL}/api/stage1/generate-deliverable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cred?.apiKey ? { 'X-Provider-Key': cred.apiKey } : {}),
        },
        body: JSON.stringify({
          deliverable_type: type,
          context: contextStr,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          provider,
          model,
          api_key: cred?.apiKey,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to generate ${type} blueprint.`);
      }

      const data = await response.json();
      const updatedDeliverables = {
        ...deliverableData,
        [type]: data.deliverable || data,
      };
      setDeliverableData(updatedDeliverables);
      if (projectId) {
        updateProject(projectId, { deliverables: updatedDeliverables });
      }
    } catch (err: any) {
      setDeliverableError(err.message || `Error generating ${type}`);
    } finally {
      setIsGeneratingDeliverable(false);
    }
  };

  // Render simple markdown formatted content (headers, bold, lists, code blocks, tables)
  const renderFormattedContent = (content: string) => {
    // Check if contains code blocks
    const parts = content.split(/(```[\s\S]*?```)/g);

    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        const lang = lines[0].trim();
        const code = (lang ? lines.slice(1) : lines).join('\n');
        const codeKey = `code-${index}`;

        return (
          <div key={index} className="my-3 rounded-xl border border-[#E5E1DA] overflow-hidden bg-[#1A1D29] text-white">
            <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#12141C] border-b border-[#2A2E3D] text-[11px] font-mono text-gray-400">
              <span className="font-semibold uppercase tracking-wider">{lang || 'Code'}</span>
              <button
                onClick={() => handleCopy(code, codeKey)}
                className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
              >
                {copiedKey === codeKey ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3.5 text-xs font-mono overflow-x-auto text-emerald-300 leading-relaxed">
              <code>{code}</code>
            </pre>
          </div>
        );
      }

      // Regular text block with paragraphs, bullet lists, bold
      const paragraphs = part.split(/\n\n+/);
      return (
        <div key={index} className="space-y-2">
          {paragraphs.map((p, pIdx) => {
            if (!p.trim()) return null;

            // Check if bullet list
            if (p.includes('\n- ') || p.startsWith('- ') || p.includes('\n* ') || p.startsWith('* ')) {
              const listLines = p.split('\n').filter((l) => l.trim().startsWith('- ') || l.trim().startsWith('* ') || l.trim().startsWith('• '));
              return (
                <ul key={pIdx} className="space-y-1.5 my-2">
                  {listLines.map((line, lIdx) => {
                    const text = line.replace(/^[-*•]\s+/, '');
                    return (
                      <li key={lIdx} className="flex items-start gap-2 text-xs font-mono leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E85D2C] mt-1.5 shrink-0" />
                        <span dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(text) }} />
                      </li>
                    );
                  })}
                </ul>
              );
            }

            // Headers
            if (p.startsWith('### ')) {
              return (
                <h4 key={pIdx} className="text-sm font-bold font-mono text-[#1A1D29] mt-3 mb-1">
                  {p.replace(/^###\s+/, '')}
                </h4>
              );
            }
            if (p.startsWith('## ')) {
              return (
                <h3 key={pIdx} className="text-base font-bold font-display text-[#1A1D29] mt-4 mb-1 border-b border-[#E5E1DA] pb-1">
                  {p.replace(/^##\s+/, '')}
                </h3>
              );
            }
            if (p.startsWith('# ')) {
              return (
                <h2 key={pIdx} className="text-lg font-bold font-display text-[#1A1D29] mt-4 mb-2">
                  {p.replace(/^#\s+/, '')}
                </h2>
              );
            }

            return (
              <p
                key={pIdx}
                className="text-xs font-mono leading-relaxed text-[#1A1D29]"
                dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(p) }}
              />
            );
          })}
        </div>
      );
    });
  };

  const formatInlineMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-[#1A1D29]">$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 rounded bg-gray-100 text-[#E85D2C] font-mono text-[11px]">$1</code>');
  };

  // If no project loaded, show friendly empty state
  if (!project) {
    return (
      <div className="min-h-screen bg-[#FDFCFB] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#E85D2C]/10 border border-[#E85D2C]/20 flex items-center justify-center text-[#E85D2C] mb-4">
          <Sparkles className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold font-display text-[#1A1D29] mb-2">
          No Problem Statement Loaded
        </h2>
        <p className="text-xs font-mono text-[#6B7280] max-w-md mb-6 leading-relaxed">
          The AI Planning Workspace grounds its technical reasoning in an analyzed problem statement. Please start by submitting or selecting a problem statement on Page A.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToPS}
            className="px-4 py-2.5 rounded-xl bg-[#E85D2C] hover:bg-[#D45022] text-white text-xs font-mono font-semibold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go to Problem Statement Submission</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFCFB] flex flex-col font-sans antialiased text-[#1A1D29]">
      {/* ── TOP HEADER ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#FDFCFB]/95 backdrop-blur-md border-b border-[#E5E1DA] px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Left: Back & Project Context Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBackToPS}
              className="p-1.5 rounded-lg border border-[#E5E1DA] hover:border-[#1A1D29] bg-white text-[#6B7280] hover:text-[#1A1D29] transition-colors cursor-pointer shrink-0"
              title="Return to Problem Statement Explanation"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#E85D2C] font-bold bg-[#E85D2C]/10 px-2 py-0.5 rounded">
                  Stage 1 Workspace
                </span>
                <span className="text-xs font-mono text-[#6B7280] truncate max-w-[200px] sm:max-w-xs font-semibold">
                  {project?.title || 'DevLens AI Project'}
                </span>
              </div>
            </div>

            {/* Compact PS Context Drawer Trigger */}
            <button
              onClick={() => setIsPSDrawerOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAFAF7] hover:bg-[#FFF4EE] border border-[#E5E1DA] hover:border-[#E85D2C]/40 text-xs font-mono text-[#6B7280] hover:text-[#E85D2C] transition-colors cursor-pointer"
              title="Inspect attached Problem Statement and 7-bullet analysis"
            >
              <FileText className="w-3.5 h-3.5 text-[#E85D2C]" />
              <span>PS Context</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            </button>
          </div>

          {/* Right: Model Selector, Settings & Contextual Tools Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Model Selector Dropdown */}
            <div className="flex items-center gap-1.5 bg-white border border-[#E5E1DA] rounded-xl px-2.5 py-1 shadow-2xs">
              <span className="text-[10px] font-mono text-[#6B7280] uppercase tracking-wider hidden md:inline">
                Model:
              </span>
              <select
                value={model}
                onChange={(e) => {
                  const m = e.target.value;
                  setModel(m);
                  if (projectId) updateProject(projectId, { model: m });
                }}
                disabled={isLoadingModels}
                className="bg-transparent text-xs font-mono font-medium text-[#1A1D29] focus:outline-none cursor-pointer max-w-[140px] sm:max-w-[200px] truncate"
              >
                {availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Provider Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl bg-white hover:bg-[#FAFAF7] border border-[#E5E1DA] text-[#6B7280] hover:text-[#1A1D29] transition-colors cursor-pointer shadow-2xs"
              title="Configure AI Providers (OpenAI, Claude, Gemini, Groq, Kimi, OpenRouter)"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Contextual Tools Panel Toggle */}
            <button
              onClick={() => setIsToolsSidebarOpen(!isToolsSidebarOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-medium transition-all cursor-pointer shadow-2xs ${
                isToolsSidebarOpen
                  ? 'bg-[#1A1D29] text-white border-[#1A1D29]'
                  : 'bg-white hover:bg-[#FAFAF7] text-[#1A1D29] border-[#E5E1DA]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-[#E85D2C]" />
              <span className="hidden sm:inline">Deliverables</span>
            </button>

            {/* Go to Stage 2 button */}
            <button
              onClick={onGoToStage2}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-mono font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              <span>Stage 2: Audit</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN WORKSPACE BODY ──────────────────────────────────────────────── */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto relative overflow-hidden">
        {/* ── CENTRAL CHAT CONVERSATION AREA ─────────────────────────────────── */}
        <div className="flex-1 flex flex-col h-[calc(100vh-61px)] min-w-0">
          {/* Chat Messages Log */}
          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 space-y-6">
            {messages.length === 0 ? (
              <div className="max-w-2xl mx-auto py-12 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#FFF4EE] to-[#FFE8DE] border border-[#E85D2C]/30 flex items-center justify-center text-[#E85D2C] mb-4 shadow-sm">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold font-display text-[#1A1D29] mb-2">
                  DevLens Conversational Planning
                </h3>
                <p className="text-xs font-mono text-[#6B7280] max-w-lg mb-6 leading-relaxed">
                  Grounded in your problem statement: <strong>{project?.title}</strong>. Ask about technical trade-offs, architecture patterns, API contracts, unique selling points, or prepare for judge inquiries.
                </p>

                {/* Initial Quick Suggestion Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
                  {SUGGESTION_PROMPTS.slice(0, 4).map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(prompt)}
                      className="p-3 rounded-xl bg-white hover:bg-[#FFF4EE]/50 border border-[#E5E1DA] hover:border-[#E85D2C]/40 text-xs font-mono text-[#1A1D29] transition-all text-left flex items-start gap-2.5 cursor-pointer shadow-2xs group"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#E85D2C] shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                      <span className="line-clamp-2">{prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-6">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-3.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {m.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-xl bg-[#E85D2C]/10 border border-[#E85D2C]/30 flex items-center justify-center text-[#E85D2C] shrink-0 mt-1 shadow-2xs">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`relative group max-w-[85%] rounded-2xl p-4 text-xs font-mono leading-relaxed shadow-2xs ${
                        m.role === 'user'
                          ? 'bg-[#1A1D29] text-white rounded-tr-xs'
                          : 'bg-white border border-[#E5E1DA] text-[#1A1D29] rounded-tl-xs'
                      }`}
                    >
                      {/* Message Content */}
                      <div className="prose prose-sm max-w-none">
                        {m.role === 'user' ? (
                          <div className="whitespace-pre-wrap">{m.content}</div>
                        ) : (
                          renderFormattedContent(m.content)
                        )}
                      </div>

                      {/* Footer: timestamp + copy */}
                      <div
                        className={`flex items-center justify-between gap-3 text-[10px] mt-2 pt-1 border-t ${
                          m.role === 'user'
                            ? 'text-gray-400 border-white/10'
                            : 'text-[#6B7280] border-[#E5E1DA]/50'
                        }`}
                      >
                        <span>{m.timestamp}</span>
                        <button
                          onClick={() => handleCopy(m.content, `msg-${idx}`)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 cursor-pointer hover:underline"
                        >
                          {copiedKey === `msg-${idx}` ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>Copy</span>
                        </button>
                      </div>
                    </div>

                    {m.role === 'user' && (
                      <div className="w-8 h-8 rounded-xl bg-[#1A1D29] text-white flex items-center justify-center shrink-0 mt-1 shadow-2xs font-mono text-xs font-bold">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}

                {/* Streaming Assistant Indicator */}
                {isGenerating && (
                  <div className="flex gap-3.5 items-center text-xs font-mono text-[#E85D2C]">
                    <div className="w-8 h-8 rounded-xl bg-[#E85D2C]/10 border border-[#E85D2C]/30 flex items-center justify-center text-[#E85D2C] shrink-0 animate-pulse">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-2xl bg-white border border-[#E5E1DA] shadow-2xs">
                      <Loader2 className="w-4 h-4 animate-spin text-[#E85D2C]" />
                      <span>Reasoning with {model}...</span>
                    </div>
                  </div>
                )}

                {/* Chat Error Banner */}
                {chatError && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs font-mono text-red-700 flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <span>{chatError}</span>
                    </div>
                    <div className="flex items-center gap-3 ml-6">
                      <button
                        onClick={handleRegenerate}
                        className="font-bold underline hover:no-underline cursor-pointer flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Retry</span>
                      </button>
                      {errorType === 'auth' && (
                        <button
                          onClick={() => setIsSettingsOpen(true)}
                          className="px-2.5 py-1 rounded bg-red-600 text-white font-semibold cursor-pointer hover:bg-red-700 transition-colors"
                        >
                          Open Provider Settings
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div ref={chatBottomRef} />
              </div>
            )}
          </div>

          {/* ── BOTTOM COMPOSER ──────────────────────────────────────────────── */}
          <div className="bg-[#FDFCFB] border-t border-[#E5E1DA] p-4 sm:px-8">
            <div className="max-w-3xl mx-auto space-y-2">
              {/* Quick suggestions if chat is active */}
              {messages.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px] font-mono">
                  <span className="text-[#6B7280] shrink-0">Quick prompts:</span>
                  {[
                    'Design database schema',
                    '3 critical judge questions',
                    '2-minute demo path',
                    'Compare alternative tech stacks',
                  ].map((chip) => (
                    <button
                      key={chip}
                      onClick={() => handleSendMessage(chip)}
                      className="px-2.5 py-0.5 rounded-full bg-white hover:bg-[#FFF4EE] border border-[#E5E1DA] hover:border-[#E85D2C]/40 text-[#6B7280] hover:text-[#E85D2C] shrink-0 transition-colors cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}

              {/* Textarea Composer */}
              <div className="relative rounded-2xl border border-[#E5E1DA] bg-white shadow-2xs focus-within:border-[#E85D2C] focus-within:ring-1 focus-within:ring-[#E85D2C]/20 transition-all p-2 flex flex-col gap-2">
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
                  rows={2}
                  placeholder={`Ask ${model} about architecture, tech stack, edge cases... (Enter to send, Shift+Enter for newline)`}
                  className="w-full p-2 bg-transparent text-xs font-mono text-[#1A1D29] placeholder:text-[#6B7280] focus:outline-none resize-none leading-relaxed"
                />

                <div className="flex items-center justify-between border-t border-[#E5E1DA]/60 pt-2 px-1">
                  <div className="flex items-center gap-2 text-[10px] font-mono text-[#6B7280]">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-[#E85D2C]" />
                      <span>{provider}</span>
                    </span>
                    <span>•</span>
                    <span className="hidden sm:inline">Context: PS + Explanation Grounded</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isGenerating ? (
                      <button
                        onClick={handleStopGeneration}
                        className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Stop</span>
                      </button>
                    ) : (
                      <>
                        {messages.length > 0 && (
                          <button
                            onClick={handleRegenerate}
                            title="Regenerate last response"
                            className="p-1.5 rounded-lg border border-[#E5E1DA] hover:bg-[#FAFAF7] text-[#6B7280] hover:text-[#1A1D29] transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleSendMessage()}
                          disabled={!inputMessage.trim()}
                          className="px-4 py-1.5 rounded-xl bg-[#1A1D29] hover:bg-[#E85D2C] text-white text-xs font-mono font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs"
                        >
                          <span>Send</span>
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── COLLAPSIBLE CONTEXTUAL TOOLS SIDEBAR ────────────────────────────── */}
        {isToolsSidebarOpen && (
          <aside className="w-80 sm:w-96 border-l border-[#E5E1DA] bg-white h-[calc(100vh-61px)] flex flex-col shadow-lg z-20 transition-all">
            <div className="p-4 border-b border-[#E5E1DA] flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold font-mono text-[#1A1D29] uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#E85D2C]" />
                  <span>On-Demand Deliverables</span>
                </h3>
                <p className="text-[11px] font-mono text-[#6B7280]">
                  Grounded in PS & chat decisions
                </p>
              </div>
              <button
                onClick={() => setIsToolsSidebarOpen(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-[#6B7280] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Deliverable Tool Buttons */}
            <div className="p-3 border-b border-[#E5E1DA] grid grid-cols-2 gap-2 bg-[#FAFAF7]">
              {DELIVERABLE_TOOLS.map((tool) => {
                const isSelected = activeDeliverableType === tool.type;
                const isCached = !!deliverableData[tool.type];
                return (
                  <button
                    key={tool.type}
                    onClick={() => handleGenerateDeliverable(tool.type)}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between gap-1 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#E85D2C] bg-[#FFF4EE] shadow-2xs'
                        : 'border-[#E5E1DA] hover:border-[#E85D2C]/40 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      {tool.icon}
                      {isCached && <span className="w-2 h-2 rounded-full bg-emerald-500" title="Generated" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold font-mono text-[#1A1D29]">{tool.label}</div>
                      <div className="text-[10px] font-mono text-[#6B7280] line-clamp-1">{tool.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Deliverable Content Display */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {!activeDeliverableType ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[#6B7280]">
                  <Sliders className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-xs font-mono">
                    Select a deliverable above to synthesize blueprints, Mermaid charts, DB schemas, or slide content.
                  </p>
                </div>
              ) : isGeneratingDeliverable ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-xs font-mono text-[#E85D2C]">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Synthesizing {activeDeliverableType.replace('_', ' ')}...</span>
                </div>
              ) : deliverableError ? (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs font-mono text-red-700">
                  {deliverableError}
                </div>
              ) : deliverableData[activeDeliverableType] ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold font-mono text-[#1A1D29] uppercase tracking-wider">
                      {deliverableData[activeDeliverableType].title || activeDeliverableType.replace('_', ' ')}
                    </span>
                    <button
                      onClick={() =>
                        handleCopy(
                          JSON.stringify(deliverableData[activeDeliverableType], null, 2),
                          'deliv-copy'
                        )
                      }
                      className="px-2 py-1 rounded bg-[#FAFAF7] hover:bg-gray-100 border border-[#E5E1DA] text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === 'deliv-copy' ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>Copy JSON</span>
                    </button>
                  </div>

                  {/* Render based on deliverable type */}
                  {activeDeliverableType === 'architecture' && (
                    <div className="space-y-3">
                      {deliverableData.architecture.mermaid && (
                        <div className="p-3 rounded-xl bg-[#1A1D29] text-emerald-400 text-xs font-mono overflow-x-auto">
                          <pre>{deliverableData.architecture.mermaid}</pre>
                        </div>
                      )}
                      <div className="space-y-2">
                        {deliverableData.architecture.components?.map((c: any, i: number) => (
                          <div key={i} className="p-3 rounded-lg border border-[#E5E1DA] bg-[#FAFAF7]">
                            <div className="font-bold text-xs font-mono">{c.name}</div>
                            <div className="text-[11px] font-mono text-[#6B7280]">{c.role}</div>
                            <div className="text-[10px] font-mono text-[#E85D2C] mt-1 font-semibold">{c.tech}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeDeliverableType === 'workflows' && (
                    <div className="space-y-3">
                      {deliverableData.workflows.user_journeys?.map((uj: any, i: number) => (
                        <div key={i} className="p-3 rounded-lg border border-[#E5E1DA] bg-[#FAFAF7] space-y-1">
                          <div className="font-bold text-xs font-mono text-[#3B5FE0]">Journey: {uj.journey}</div>
                          <ul className="space-y-1 text-[11px] font-mono text-[#1A1D29]">
                            {uj.steps?.map((step: string, sIdx: number) => (
                              <li key={sIdx} className="flex items-start gap-1.5">
                                <span className="font-bold text-[#3B5FE0]">{sIdx + 1}.</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeDeliverableType === 'tech_stack' && (
                    <div className="space-y-2">
                      {deliverableData.tech_stack.recommended_stack?.map((t: any, i: number) => (
                        <div key={i} className="p-3 rounded-lg border border-[#E5E1DA] bg-[#FAFAF7]">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs font-mono">{t.layer}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                              {t.selection}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-[#6B7280] mt-1">{t.rationale}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeDeliverableType === 'implementation_plan' && (
                    <div className="space-y-3">
                      {deliverableData.implementation_plan.phases?.map((phase: any, i: number) => (
                        <div key={i} className="p-3 rounded-lg border border-[#E5E1DA] bg-[#FAFAF7] space-y-1">
                          <div className="font-bold text-xs font-mono flex items-center justify-between">
                            <span>{phase.phase}</span>
                            <span className="text-[10px] font-mono text-[#7C3AED]">{phase.duration}</span>
                          </div>
                          <ul className="space-y-1 text-[11px] font-mono text-[#6B7280]">
                            {phase.deliverables?.map((d: string, dIdx: number) => (
                              <li key={dIdx}>• {d}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeDeliverableType === 'db_api_design' && (
                    <div className="space-y-3">
                      {deliverableData.db_api_design.entities?.map((e: any, i: number) => (
                        <div key={i} className="p-3 rounded-lg border border-[#E5E1DA] bg-[#FAFAF7] space-y-1">
                          <div className="font-bold text-xs font-mono text-[#D97706]">{e.entity}</div>
                          <div className="text-[11px] font-mono text-[#6B7280]">
                            Fields: {e.fields?.join(', ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeDeliverableType === 'pitch_deck' && (
                    <div className="space-y-3">
                      {deliverableData.pitch_deck.slides?.map((slide: any, i: number) => (
                        <div key={i} className="p-3 rounded-lg border border-[#E5E1DA] bg-[#FAFAF7] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs font-mono text-[#E11D48]">
                              Slide {slide.slide_number}: {slide.title}
                            </span>
                            <span className="text-[10px] font-mono text-[#6B7280]">{slide.time_allocation}</span>
                          </div>
                          <ul className="space-y-1 text-[11px] font-mono text-[#6B7280]">
                            {slide.bullet_points?.map((bp: string, bpIdx: number) => (
                              <li key={bpIdx}>• {bp}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </aside>
        )}
      </div>

      {/* ── PROBLEM STATEMENT SLIDE-OVER DRAWER ──────────────────────────────── */}
      {isPSDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col animate-slide-left">
            <div className="p-5 border-b border-[#E5E1DA] flex items-center justify-between bg-[#FAFAF7]">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#E85D2C] font-bold">
                  Problem Statement Context
                </div>
                <h3 className="text-sm font-bold font-mono text-[#1A1D29]">
                  {project?.title || 'Problem Statement'}
                </h3>
              </div>
              <button
                onClick={() => setIsPSDrawerOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-200 text-[#6B7280] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Back to Edit Button */}
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setIsPSDrawerOpen(false);
                    onBackToPS();
                  }}
                  className="px-3 py-1.5 rounded-lg border border-[#E5E1DA] hover:border-[#1A1D29] bg-white text-xs font-mono text-[#1A1D29] flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Edit in Page A</span>
                </button>
              </div>

              {/* 7 Structured Bullet Points */}
              {project?.explanation && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[#FFF4EE]/60 border border-[#E85D2C]/30">
                    <div className="text-xs font-bold font-mono text-[#E85D2C] mb-1">
                      1. Problem Overview & Objective
                    </div>
                    <p className="text-xs font-mono text-[#1A1D29] leading-relaxed">
                      {project.explanation.overview}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-[#E5E1DA]">
                    <div className="text-xs font-bold font-mono text-[#1A1D29] mb-1">
                      2. Actual Problem to Solve
                    </div>
                    <p className="text-xs font-mono text-[#6B7280] leading-relaxed">
                      {project.explanation.coreProblem}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-[#E5E1DA]">
                    <div className="text-xs font-bold font-mono text-[#1A1D29] mb-1">
                      3. Target Users & Stakeholders
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {project.explanation.targetUsers?.map((u, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-[#FAFAF7] border border-[#E5E1DA] text-[11px] font-mono text-[#1A1D29]"
                        >
                          {u}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-[#E5E1DA]">
                    <div className="text-xs font-bold font-mono text-[#1A1D29] mb-1">
                      4. Requirements & Expected Deliverables
                    </div>
                    <ul className="space-y-1.5 mt-2">
                      {project.explanation.requirements?.map((req, i) => (
                        <li key={i} className="text-xs font-mono text-[#6B7280] flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#E85D2C] mt-1.5 shrink-0" />
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200">
                    <div className="text-xs font-bold font-mono text-amber-900 mb-1">
                      5. Constraints & Limitations
                    </div>
                    <ul className="space-y-1 mt-1 text-xs font-mono text-amber-800">
                      {project.explanation.constraints?.map((c, i) => (
                        <li key={i}>• {c}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
                    <div className="text-xs font-bold font-mono text-emerald-900 mb-1">
                      6. Success / Judging Criteria
                    </div>
                    <ul className="space-y-1 mt-1 text-xs font-mono text-emerald-800">
                      {project.explanation.successCriteria?.map((sc, i) => (
                        <li key={i}>• {sc}</li>
                      ))}
                    </ul>
                  </div>

                  {project.explanation.importantTerms && project.explanation.importantTerms.length > 0 && (
                    <div className="p-4 rounded-xl bg-white border border-[#E5E1DA]">
                      <div className="text-xs font-bold font-mono text-[#1A1D29] mb-1">
                        7. Important Terms & Clarifications
                      </div>
                      <div className="space-y-1.5 mt-2">
                        {project.explanation.importantTerms.map((t, i) => (
                          <div key={i} className="text-xs font-mono">
                            <span className="font-bold text-[#1A1D29]">{t.term}: </span>
                            <span className="text-[#6B7280]">{t.explanation}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Raw PS Text */}
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                <div className="text-xs font-bold font-mono text-gray-700 mb-2">
                  Original Source Document Text
                </div>
                <pre className="text-xs font-mono text-gray-600 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                  {project?.problemStatement}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PROVIDER SETTINGS MODAL ─────────────────────────────────────────── */}
      <ProviderSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeProvider={provider}
        activeModel={model}
        onSelectProvider={(p, m) => {
          setProvider(p);
          setModel(m);
          if (projectId) {
            updateProject(projectId, { provider: p, model: m });
          }
        }}
      />
    </div>
  );
}
