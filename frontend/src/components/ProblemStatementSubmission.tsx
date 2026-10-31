import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  FileText,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Settings,
  Lightbulb,
  ExternalLink,
  ShieldCheck,
  Tag,
  KeyRound,
  Cpu,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { API_BASE_URL } from '../lib/apiClient';
import {
  PSExplanation,
  Project,
  createNewProject,
  updateProject,
  getProject,
  saveProject,
  getActiveProjectId,
  setActiveProjectId,
  getProviderCredential,
  getSavedCredentials,
} from '../lib/projectStore';
import ProviderSettingsModal from './ProviderSettingsModal';

interface ProblemStatementSubmissionProps {
  onBackToMain: () => void;
  onGoToOpenInnovation: () => void;
  onContinueToChat: (projectId: string) => void;
  initialProjectId?: string | null;
}

const SAMPLE_PROBLEM_STATEMENT = `Design an autonomous AI governance and codebase verification agent for hackathon submissions.
The agent must evaluate whether developers met all stated problem requirements, verify static code evidence,
map internal module dependencies, and test developers on their technical choices prior to final judging.
Must support sub-second query response, secret sanitization, and grounded citations to exact files and lines.`;

// The API returns snake_case fields; normalize them once so the submission and
// workshop screens display the same analysis shape, including older saved projects.
function normalizePSAnalysis(value: any): PSExplanation {
  const asList = (items: unknown): string[] => {
    if (Array.isArray(items)) return items.map(String).map((item) => item.trim()).filter(Boolean);
    if (typeof items === 'string' && items.trim()) return [items.trim()];
    return [];
  };
  return {
    ...value,
    title: value?.title || 'Problem Statement Analysis',
    overview: value?.overview ?? value?.overview_objective ?? '',
    coreProblem: value?.coreProblem ?? value?.actual_problem ?? '',
    targetUsers: asList(value?.targetUsers ?? value?.target_users_stakeholders),
    requirements: asList(value?.requirements ?? value?.stated_requirements),
    inferredRecommendations: asList(value?.inferredRecommendations ?? value?.inferred_recommendations),
    constraints: asList(value?.constraints ?? value?.constraints_limitations),
    successCriteria: asList(value?.successCriteria ?? value?.success_judging_criteria),
    importantTerms: asList(value?.importantTerms ?? value?.important_terms),
  } as PSExplanation;
}

const hasRequiredBreakdown = (analysis: PSExplanation | null) => Boolean(
  analysis?.overview?.trim() &&
  analysis?.coreProblem?.trim() &&
  analysis?.requirements?.length &&
  analysis?.inferredRecommendations?.length
);

const requiredBreakdownCount = (analysis: PSExplanation | null) => [
  Boolean(analysis?.overview?.trim()),
  Boolean(analysis?.coreProblem?.trim()),
  Boolean(analysis?.requirements?.length),
  Boolean(analysis?.inferredRecommendations?.length),
].filter(Boolean).length;

export default function ProblemStatementSubmission({
  onBackToMain,
  onGoToOpenInnovation,
  onContinueToChat,
  initialProjectId,
}: ProblemStatementSubmissionProps) {
  const [projectId, setProjectId] = useState<string | null>(initialProjectId || getActiveProjectId());
  const [inputMode, setInputMode] = useState<'upload' | 'paste'>('upload');
  const [rawPSText, setRawPSText] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedWordCount, setUploadedWordCount] = useState<number>(0);
  const [isExtractingDoc, setIsExtractingDoc] = useState(false);
  const [isAnalyzingPS, setIsAnalyzingPS] = useState(false);
  const [psAnalysis, setPsAnalysis] = useState<PSExplanation | null>(null);
  const [psError, setPsError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

interface ModelOption {
  id: string;
  name: string;
  context_window?: number;
}

  // Model & Provider configuration - directly exposed to user
  const [activeProvider, setActiveProvider] = useState<string>('groq');
  const [activeModel, setActiveModel] = useState<string>('llama-3.1-8b-instant');
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Check if active provider has an API key configured
  const hasKeyConfigured = () => {
    const creds = getSavedCredentials();
    return !!creds[activeProvider]?.apiKey || activeProvider === 'groq';
  };

  // Load existing project if available
  useEffect(() => {
    if (projectId) {
      const existing = getProject(projectId);
      if (existing) {
        setRawPSText(existing.problemStatement || '');
        if (existing.explanation) {
          const t = existing.explanation.title || '';
          const ov = existing.explanation.overview || '';
          const isCorrupted =
            t.includes('%PDF') ||
            t.includes('/Filter') ||
            t.includes('/FlateDecode') ||
            ov.includes('%PDF') ||
            ov.includes('/FlateDecode') ||
            ov.includes('stream x');
          if (!isCorrupted) {
            setPsAnalysis(normalizePSAnalysis(existing.explanation));
          } else {
            setPsAnalysis(null);
            updateProject(projectId, { explanation: undefined });
          }
        }
        if (existing.provider) setActiveProvider(existing.provider);
        if (existing.model && existing.model !== 'openai/gpt-oss-120b') {
          setActiveModel(existing.model);
        }
      }
    }
  }, [projectId]);

  // Fetch available models for active provider
  const fetchModelsForProvider = async (provider: string) => {
    setIsLoadingModels(true);
    try {
      const cred = getProviderCredential(provider);
      const res = await fetch(`${API_BASE_URL}/api/llm/models?provider=${provider}`, {
        headers: cred?.apiKey ? { 'X-Provider-Key': cred.apiKey } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.models && data.models.length > 0) {
          const normalized: ModelOption[] = data.models.map((m: any) =>
            typeof m === 'string'
              ? { id: m, name: m }
              : { id: m.id, name: m.name || m.id, context_window: m.context_window }
          );
          setAvailableModels(normalized);
          const currentValid = normalized.some((m) => m.id === activeModel);
          if (!currentValid) {
            setActiveModel(normalized[0].id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch provider models', err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  useEffect(() => {
    fetchModelsForProvider(activeProvider);
  }, [activeProvider]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Document Upload & Clean Backend Text Extraction
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setIsExtractingDoc(true);
    setPsError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      let response: Response;
      try {
        response = await fetch(`${API_BASE_URL}/api/stage1/extract-document`, {
          method: 'POST',
          body: formData,
        });
      } catch {
        throw new Error(`Cannot reach the HACKORA backend at ${API_BASE_URL}. Start the backend or set VITE_API_BASE_URL to its deployed URL, then try again.`);
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to extract text from ${file.name}`);
      }

      const data = await response.json();
      setRawPSText(data.text);
      setUploadedWordCount(data.word_count || data.text.split(/\s+/).filter(Boolean).length);
    } catch (err: any) {
      setPsError(err.message || 'Error parsing document.');
      setRawPSText('');
      setUploadedFileName(null);
    } finally {
      setIsExtractingDoc(false);
    }
  };

  // Analyze Problem Statement
  const handleAnalyze = async () => {
    if (!rawPSText.trim()) {
      setPsError('Please provide a problem statement via file upload or direct text.');
      return;
    }

    setIsAnalyzingPS(true);
    setPsError(null);

    const cred = getProviderCredential(activeProvider);
    const customKey = cred?.apiKey;

    try {
      let response: Response;
      try {
        response = await fetch(`${API_BASE_URL}/api/stage1/explain-ps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            problem_statement: rawPSText.trim(),
            provider: activeProvider,
            model: activeModel,
            api_key: customKey,
          }),
        });
      } catch {
        throw new Error(`Cannot reach the HACKORA backend at ${API_BASE_URL}. Start the backend or set VITE_API_BASE_URL to its deployed URL, then try again.`);
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to analyze problem statement.');
      }

      const data = normalizePSAnalysis(await response.json());
      setPsAnalysis(data);

      // Persist to project store
      let currentProjId = projectId;
      if (currentProjId) {
        updateProject(currentProjId, {
          title: data.title,
          problemStatement: rawPSText.trim(),
          explanation: data,
          provider: activeProvider,
          model: activeModel,
        });
      } else {
        const newProj = createNewProject({
          title: data.title,
          problemStatement: rawPSText.trim(),
          explanation: data,
          provider: activeProvider,
          model: activeModel,
        });
        currentProjId = newProj.id;
        setProjectId(newProj.id);
        setActiveProjectId(newProj.id);
      }
    } catch (err: any) {
      console.error(err);
      setPsError(err.message || 'Error communicating with HACKORA backend.');
    } finally {
      setIsAnalyzingPS(false);
    }
  };

  const handleContinue = () => {
    let targetId = projectId;
    if (!targetId) {
      const newProj = createNewProject({
        title: psAnalysis?.title || 'Problem Statement Project',
        problemStatement: rawPSText.trim(),
        explanation: psAnalysis,
        provider: activeProvider,
        model: activeModel,
      });
      targetId = newProj.id;
      setProjectId(newProj.id);
      setActiveProjectId(newProj.id);
    } else {
      setActiveProjectId(targetId);
    }
    const current = targetId ? getProject(targetId) : null;
    if (current && current.explanation && current.messages.length === 0) {
      const e = current.explanation as any;
      const list = (value: unknown) => Array.isArray(value) ? value.map((item) => `- ${item}`).join('\n') : '';
      const initialExplanation = [
        `## ${e.title || 'Problem statement explained'}`,
        `### Problem overview and objective\n${e.overview || e.overview_objective || ''}`,
        `### Actual problem to solve\n${e.coreProblem || e.actual_problem || ''}`,
        `### Target users\n${list(e.targetUsers || e.target_users_stakeholders) || '- Not stated explicitly in the brief.'}`,
        `### Requirements and deliverables\n${list(e.requirements || e.stated_requirements) || '- Review the source statement for explicit deliverables.'}`,
        `### Constraints\n${list(e.constraints || e.constraints_limitations) || '- No explicit constraints were extracted.'}`,
        `### Expected outcomes\n${e.successCriteria || e.success_judging_criteria || 'The brief does not state measurable success criteria.'}`,
        `### Important concepts\n${list(e.importantTerms || e.important_terms) || '- None identified.'}`,
        'I have kept the brief’s requirements separate from recommendations. What would you like to explore next?',
      ].join('\n\n');
      updateProject(targetId!, { messages: [{ id: `msg_${Date.now()}`, role: 'assistant', content: initialExplanation, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }] });
    }
    onContinueToChat(targetId);
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#1A1D29] flex flex-col justify-between selection:bg-[#E85D2C]/20 selection:text-[#E85D2C]">
      {/* Top Bar Header with Breadcrumbs & Model Controls */}
      <header className="border-b border-[#E5E1DA] bg-white sticky top-0 z-30 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onBackToMain}
              className="flex items-center gap-1.5 text-xs font-mono text-[#6B7280] hover:text-[#1A1D29] transition-colors p-1 rounded hover:bg-[#FAFAF7] cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Workspace</span>
            </button>
            <span className="text-[#E5E1DA]">/</span>
            <span className="text-xs font-mono font-bold text-[#E85D2C] bg-[#E85D2C]/10 px-2 py-0.5 rounded">
              Stage 1
            </span>
            <span className="text-sm font-display font-bold text-[#1A1D29]">
              Problem Statement Submission
            </span>
          </div>

          {/* Right Header: Model Selector & Settings */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={onGoToOpenInnovation}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E1DA] hover:border-[#1A1D29] bg-white text-xs font-mono text-[#6B7280] hover:text-[#1A1D29] transition-all cursor-pointer shadow-2xs"
            >
              <Lightbulb className="w-3.5 h-3.5 text-[#E85D2C]" />
              <span>Open Innovation</span>
            </button>

            {/* Model Access Selector */}
            <div className="flex items-center gap-1.5 bg-[#FAFAF7] border border-[#E5E1DA] rounded-xl px-2.5 py-1 text-xs font-mono">
              <span className="text-[#6B7280] uppercase text-[10px] font-bold hidden sm:inline">Model:</span>
              <select
                value={activeModel}
                onChange={(e) => setActiveModel(e.target.value)}
                disabled={isLoadingModels}
                className="bg-transparent font-medium text-[#1A1D29] focus:outline-none cursor-pointer max-w-[140px] sm:max-w-[180px] truncate"
              >
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.id}
                  </option>
                ))}
              </select>
            </div>

            {/* API Key / Provider Settings */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-medium transition-all cursor-pointer shadow-2xs ${
                hasKeyConfigured()
                  ? 'border-[#E5E1DA] bg-white text-[#1A1D29] hover:bg-[#FAFAF7]'
                  : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
              }`}
              title="Configure AI Providers & API Keys"
            >
              <KeyRound className={`w-3.5 h-3.5 ${hasKeyConfigured() ? 'text-[#E85D2C]' : 'text-amber-600'}`} />
              <span className="capitalize">{activeProvider}</span>
              {hasKeyConfigured() ? (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Key Active" />
              ) : (
                <span className="text-[10px] bg-amber-200 text-amber-800 px-1 rounded">Set Key</span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Intro Headline */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-[#1A1D29] tracking-tight">
            Submit & Structure Your Problem Statement
          </h1>
          <p className="text-xs sm:text-sm font-mono text-[#6B7280] mt-1.5 max-w-2xl leading-relaxed">
            Upload your challenge brief or paste text. HACKORA extracts facts, isolates constraints, and builds a grounded forensic breakdown before taking you to your conversational planning workspace.
          </p>
        </div>

        {/* 2-Column Clean Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ── LEFT COLUMN: FOCUSED SUBMISSION PANEL (5 cols) ────────────────── */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="p-5 rounded-2xl bg-white border border-[#E5E1DA] shadow-xs flex flex-col gap-4">
              {/* Tab Selector: Upload Document vs Direct Paste */}
              <div className="flex items-center justify-between border-b border-[#E5E1DA] pb-3">
                <div className="flex items-center gap-2 p-1 rounded-xl bg-[#FAFAF7] border border-[#E5E1DA]">
                  <button
                    onClick={() => setInputMode('upload')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                      inputMode === 'upload'
                        ? 'bg-white text-[#1A1D29] shadow-2xs font-bold'
                        : 'text-[#6B7280] hover:text-[#1A1D29]'
                    }`}
                  >
                    📁 Upload Document
                  </button>
                  <button
                    onClick={() => setInputMode('paste')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                      inputMode === 'paste'
                        ? 'bg-white text-[#1A1D29] shadow-2xs font-bold'
                        : 'text-[#6B7280] hover:text-[#1A1D29]'
                    }`}
                  >
                    ✍️ Direct Paste
                  </button>
                </div>

                {rawPSText && (
                  <button
                    onClick={() => {
                      setRawPSText('');
                      setUploadedFileName(null);
                      setUploadedWordCount(0);
                      setPsAnalysis(null);
                    }}
                    className="text-[11px] font-mono text-[#6B7280] hover:text-red-500 cursor-pointer transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Mode A: Upload Document (No preview textarea) */}
              {inputMode === 'upload' && (
                <div className="flex flex-col gap-3">
                  {!uploadedFileName ? (
                    <label className="border-2 border-dashed border-[#E5E1DA] hover:border-[#E85D2C]/60 rounded-xl p-8 text-center cursor-pointer transition-all bg-[#FAFAF7] hover:bg-[#FFF4EE]/30 flex flex-col items-center justify-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-[#E85D2C]/10 text-[#E85D2C] flex items-center justify-center">
                        {isExtractingDoc ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Upload className="w-5 h-5" />
                        )}
                      </div>
                      <div className="text-xs font-mono text-[#1A1D29]">
                        <span className="font-bold text-[#E85D2C]">Click to upload</span> or drag and drop
                      </div>
                      <div className="text-[11px] font-mono text-[#6B7280]">
                        PDF, DOCX, TXT, Markdown, JSON
                      </div>
                      <input
                        type="file"
                        accept=".pdf,.docx,.doc,.txt,.md,.json,.csv"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    /* Clean File Card — replaces the preview box */
                    <div className="p-4 rounded-xl bg-[#FAFAF7] border border-[#E5E1DA] flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-mono font-bold text-[#1A1D29] truncate">
                              {uploadedFileName}
                            </div>
                            <div className="text-[10px] font-mono text-[#6B7280]">
                              {uploadedWordCount} words extracted
                            </div>
                          </div>
                        </div>

                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold shrink-0">
                          Ready for Analysis
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#E5E1DA] text-[11px] font-mono">
                        <label className="text-[#E85D2C] hover:underline cursor-pointer">
                          <span>Replace file</span>
                          <input
                            type="file"
                            accept=".pdf,.docx,.doc,.txt,.md,.json,.csv"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                        <button
                          onClick={() => {
                            setUploadedFileName(null);
                            setRawPSText('');
                            setUploadedWordCount(0);
                          }}
                          className="text-[#6B7280] hover:text-red-500 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Sample problem statement chip */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => {
                        setRawPSText(SAMPLE_PROBLEM_STATEMENT);
                        setUploadedFileName('sample_hackathon_problem.txt');
                        setUploadedWordCount(SAMPLE_PROBLEM_STATEMENT.split(/\s+/).length);
                        setPsAnalysis(null);
                      }}
                      className="text-[11px] font-mono text-[#E85D2C] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Load Sample Problem Statement</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Mode B: Direct Paste */}
              {inputMode === 'paste' && (
                <div className="flex flex-col gap-2">
                  <textarea
                    rows={8}
                    value={rawPSText}
                    onChange={(e) => setRawPSText(e.target.value)}
                    placeholder="Paste your problem statement brief, challenge description, or requirements here..."
                    className="w-full p-3.5 rounded-xl border border-[#E5E1DA] bg-[#FAFAF7] text-xs font-mono text-[#1A1D29] focus:outline-none focus:border-[#E85D2C] focus:bg-white leading-relaxed resize-y"
                  />
                  <div className="flex items-center justify-between text-[11px] font-mono text-[#6B7280]">
                    <button
                      onClick={() => {
                        setRawPSText(SAMPLE_PROBLEM_STATEMENT);
                        setPsAnalysis(null);
                      }}
                      className="text-[#E85D2C] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Use sample text</span>
                    </button>
                    <span>{rawPSText.split(/\s+/).filter(Boolean).length} words</span>
                  </div>
                </div>
              )}

              {/* Model & Provider Direct Access Bar */}
              <div className="p-3.5 rounded-xl bg-[#FAFAF7] border border-[#E5E1DA] space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-[#1A1D29] flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-[#3B5FE0]" />
                    <span>Active Reasoning Model</span>
                  </span>
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="text-[11px] text-[#E85D2C] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Settings className="w-3 h-3" />
                    <span>Settings & API Key</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {/* Provider Selector */}
                  <div>
                    <label className="text-[10px] text-[#6B7280] block mb-1">Provider</label>
                    <select
                      value={activeProvider}
                      onChange={(e) => {
                        const prov = e.target.value;
                        setActiveProvider(prov);
                      }}
                      className="w-full p-2 rounded-lg border border-[#E5E1DA] bg-white text-xs font-mono text-[#1A1D29] focus:outline-none focus:border-[#E85D2C] cursor-pointer"
                    >
                      <option value="groq">Groq (Ultra-Fast)</option>
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic Claude</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="moonshot">Moonshot AI (Kimi)</option>
                      <option value="openrouter">OpenRouter</option>
                    </select>
                  </div>

                  {/* Model Selector */}
                  <div>
                    <label className="text-[10px] text-[#6B7280] block mb-1">Model</label>
                    <select
                      value={activeModel}
                      onChange={(e) => setActiveModel(e.target.value)}
                      disabled={isLoadingModels}
                      className="w-full p-2 rounded-lg border border-[#E5E1DA] bg-white text-xs font-mono text-[#1A1D29] focus:outline-none focus:border-[#E85D2C] cursor-pointer truncate"
                    >
                      {availableModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name || m.id}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Error Banner */}
              {psError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-mono text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{psError}</span>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzingPS || !rawPSText.trim()}
                className="w-full py-3 px-4 rounded-xl bg-[#E85D2C] hover:bg-[#D45022] text-white text-xs font-mono font-semibold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isAnalyzingPS ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>
                      Analyzing with {availableModels.find((m) => m.id === activeModel)?.name || activeModel} ({activeProvider.toUpperCase()})...
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Analyze Problem Statement</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ── RIGHT COLUMN: STRUCTURED FORENSIC BREAKDOWN (7 cols) ──────────── */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {psAnalysis ? (
              <div className="p-6 rounded-2xl bg-white border border-[#E5E1DA] shadow-xs flex flex-col gap-5 animate-fade-in">
                {/* Header with Continue to AI Workspace Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E1DA] pb-4">
                  <div>
                    <span className="text-[10px] font-mono text-[#E85D2C] font-bold uppercase tracking-wider bg-[#E85D2C]/10 px-2.5 py-0.5 rounded">
                      Problem Overview
                    </span>
                    <h3 className="text-base sm:text-lg font-bold font-display text-[#1A1D29] mt-1 line-clamp-2">
                      {psAnalysis.title || 'Structured Problem Analysis'}
                    </h3>
                  </div>

                  {/* Prominent Continue Button */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <button
                      onClick={handleContinue}
                      disabled={!hasRequiredBreakdown(psAnalysis)}
                      title={!hasRequiredBreakdown(psAnalysis) ? 'Analyze the problem statement and fill all four required sections before continuing.' : undefined}
                      className="px-5 py-2.5 rounded-xl bg-[#E85D2C] hover:bg-[#D45022] text-white text-xs font-mono font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span>Continue to AI Workspace</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    {!hasRequiredBreakdown(psAnalysis) && (
                      <span className="text-[10px] font-mono text-amber-700">
                        {requiredBreakdownCount(psAnalysis)}/4 required sections answered
                      </span>
                    )}
                  </div>
                </div>

                {/* 1. Overview */}
                <div className="p-4 rounded-xl bg-[#FAFAF7] border border-[#E5E1DA]">
                  <div className="text-xs font-bold font-mono text-[#1A1D29] mb-1.5 flex items-center gap-1.5">
                    <span>1. Problem Overview & High-Level Objective</span>
                  </div>
                  <p className="text-xs font-mono text-[#6B7280] leading-relaxed">
                    {psAnalysis.overview || 'No overview was returned. Re-analyze the statement to continue.'}
                  </p>
                </div>

                {/* 2. Core Problem */}
                <div className="hidden p-4 rounded-xl bg-amber-50/60 border border-amber-200">
                  <div className="text-xs font-bold font-mono text-amber-900 mb-1 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>2. Actual Problem to Solve</span>
                  </div>
                  <p className="text-xs font-mono text-amber-800 leading-relaxed">
                    {psAnalysis.coreProblem || 'No core problem was returned. Re-analyze the statement to continue.'}
                  </p>
                </div>

                {/* 3. Stakeholders */}
                {psAnalysis.targetUsers && psAnalysis.targetUsers.length > 0 && (
                  <div className="hidden p-4 rounded-xl bg-white border border-[#E5E1DA]">
                    <div className="text-xs font-bold font-mono text-[#1A1D29] mb-2">
                      3. Target Users & Stakeholders
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {psAnalysis.targetUsers.map((u, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-lg bg-[#FAFAF7] border border-[#E5E1DA] text-xs font-mono text-[#1A1D29]"
                        >
                          • {u}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Requirements: Facts vs Inferred Recommendations */}
                <div className="hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-bold font-mono text-emerald-950 mb-2 flex items-center justify-between">
                        <span>4A. Stated Requirements (Facts)</span>
                        <span className="text-[10px] bg-emerald-200/80 text-emerald-900 px-1.5 py-0.5 rounded">
                          Source
                        </span>
                      </div>
                      <ul className="space-y-1.5 text-xs font-mono text-emerald-900">
                        {psAnalysis.requirements?.map((req, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{req}</span>
                          </li>
                        ))}
                        {!psAnalysis.requirements?.length && <li className="text-amber-800">No stated requirements returned. Re-analyze the statement to continue.</li>}
                      </ul>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 flex flex-col justify-between">
                    <div>
                      <div className="text-xs font-bold font-mono text-indigo-950 mb-2 flex items-center justify-between">
                        <span>4B. Inferred Recommendations</span>
                        <span className="text-[10px] bg-indigo-200/80 text-indigo-900 px-1.5 py-0.5 rounded">
                          AI Advised
                        </span>
                      </div>
                      <ul className="space-y-1.5 text-xs font-mono text-indigo-900">
                        {psAnalysis.inferredRecommendations?.map((rec, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-indigo-600 font-bold">→</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                        {!psAnalysis.inferredRecommendations?.length && <li className="text-amber-800">No recommendations returned. Re-analyze the statement to continue.</li>}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* 5. Constraints & 6. Success Criteria */}
                <div className="hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {psAnalysis.constraints && (
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                      <div className="text-xs font-bold font-mono text-gray-800 mb-2">
                        5. Constraints & Limitations
                      </div>
                      <ul className="space-y-1 text-xs font-mono text-gray-700">
                        {psAnalysis.constraints.map((c, i) => (
                          <li key={i}>• {c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {psAnalysis.successCriteria && (
                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                      <div className="text-xs font-bold font-mono text-gray-800 mb-2">
                        6. Success / Judging Criteria
                      </div>
                      <ul className="space-y-1 text-xs font-mono text-gray-700">
                        {psAnalysis.successCriteria.map((sc, i) => (
                          <li key={i}>• {sc}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* 7. Important Terms */}
                {psAnalysis.importantTerms && psAnalysis.importantTerms.length > 0 && (
                  <div className="hidden p-4 rounded-xl bg-white border border-[#E5E1DA]">
                    <div className="text-xs font-bold font-mono text-[#1A1D29] mb-2">
                      7. Important Terms & Concepts
                    </div>
                    <div className="space-y-1.5">
                    {psAnalysis.importantTerms.map((t, i) => (
                        <div key={i} className="text-xs font-mono">
                        <span className="text-[#6B7280]">{t}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Unanalyzed Empty State */
              <div className="p-12 rounded-2xl bg-white border border-[#E5E1DA] shadow-xs flex flex-col items-center justify-center text-center my-auto min-h-[380px]">
                <div className="w-12 h-12 rounded-2xl bg-[#E85D2C]/10 border border-[#E85D2C]/20 flex items-center justify-center text-[#E85D2C] mb-4">
                  <FileText className="w-6 h-6" />
                </div>
                <p className="text-[11px] font-mono text-[#6B7280]">
                  The detailed analysis will open in your AI Workspace when you continue.
                </p>
                <h3 className="text-base font-bold font-display text-[#1A1D29] mb-1">
                  Forensic Problem Breakdown Awaiting
                </h3>
                <p className="text-xs font-mono text-[#6B7280] max-w-sm mb-4 leading-relaxed">
                  Upload a problem brief or paste requirements on the left, then click <strong>Analyze Problem Statement</strong> to extract structured deliverables and advance to your AI Workspace.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Provider & API Key Settings Modal */}
      <ProviderSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeProvider={activeProvider}
        activeModel={activeModel}
        onSelectProviderModel={(p, m) => {
          setActiveProvider(p);
          setActiveModel(m);
        }}
      />
    </div>
  );
}
