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
  HelpCircle,
  ListCheck,
  Tag,
  AlertTriangle
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
} from '../lib/projectStore';
import ProviderSettingsModal from './ProviderSettingsModal';

interface ProblemStatementSubmissionProps {
  onBackToMain: () => void;
  onGoToOpenInnovation: () => void;
  onContinueToChat: (projectId: string) => void;
  initialProjectId?: string | null;
}

export default function ProblemStatementSubmission({
  onBackToMain,
  onGoToOpenInnovation,
  onContinueToChat,
  initialProjectId,
}: ProblemStatementSubmissionProps) {
  const [projectId, setProjectId] = useState<string | null>(initialProjectId || getActiveProjectId());
  const [rawPSText, setRawPSText] = useState<string>('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isExtractingDoc, setIsExtractingDoc] = useState(false);
  const [isAnalyzingPS, setIsAnalyzingPS] = useState(false);
  const [psAnalysis, setPsAnalysis] = useState<PSExplanation | null>(null);
  const [psError, setPsError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Model & Provider configuration
  const [activeProvider, setActiveProvider] = useState<string>('groq');
  const [activeModel, setActiveModel] = useState<string>('openai/gpt-oss-120b');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Load existing project if available
  useEffect(() => {
    if (projectId) {
      const existing = getProject(projectId);
      if (existing) {
        setRawPSText(existing.problemStatement || '');
        if (existing.explanation) {
          setPsAnalysis(existing.explanation);
        }
        if (existing.provider) setActiveProvider(existing.provider);
        if (existing.model) setActiveModel(existing.model);
      }
    }
  }, [projectId]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Document Upload & Text Extraction
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setIsExtractingDoc(true);
    setPsError(null);

    try {
      if (
        file.name.endsWith('.txt') ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.json') ||
        file.name.endsWith('.csv')
      ) {
        const text = await file.text();
        setRawPSText(text);
      } else {
        // Fallback for docx/pdf or binary stream
        try {
          const text = await file.text();
          const readable = text.replace(/[^\x20-\x7E\t\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
          if (readable.length > 50) {
            setRawPSText(readable);
          } else {
            throw new Error('Binary stream unreadable directly.');
          }
        } catch {
          setPsError(
            `Uploaded "${file.name}". If this document contains complex formatting or scanned pages, please paste the text directly into the editor below.`
          );
        }
      }
    } catch (err: any) {
      setPsError(`Failed to extract text from file: ${err.message || 'Unknown error'}`);
    } finally {
      setIsExtractingDoc(false);
    }
  };

  // Analyze Problem Statement
  const handleAnalyze = async () => {
    if (!rawPSText.trim()) {
      setPsError('Please paste or upload a problem statement first.');
      return;
    }

    setIsAnalyzingPS(true);
    setPsError(null);

    const cred = getProviderCredential(activeProvider);
    const customKey = cred?.apiKey;

    try {
      const response = await fetch(`${API_BASE_URL}/api/stage1/explain-ps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem_statement: rawPSText.trim(),
          provider: activeProvider,
          model: activeModel,
          api_key: customKey,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to analyze problem statement.');
      }

      const data: PSExplanation = await response.json();
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
      setPsError(err.message || 'Error communicating with DevLens AI backend.');
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
    onContinueToChat(targetId);
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7] text-[#1A1D29] flex flex-col justify-between selection:bg-[#E85D2C]/20 selection:text-[#E85D2C]">
      {/* Top Bar Header with Breadcrumbs */}
      <header className="border-b border-[#E5E1DA] bg-white sticky top-0 z-30 px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
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

          <div className="flex items-center gap-3">
            <button
              onClick={onGoToOpenInnovation}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E1DA] hover:border-[#1A1D29] bg-white text-xs font-mono text-[#6B7280] hover:text-[#1A1D29] transition-all cursor-pointer shadow-2xs"
            >
              <Lightbulb className="w-3.5 h-3.5 text-[#E85D2C]" />
              <span>Open Innovation</span>
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E1DA] hover:border-[#1A1D29] bg-white text-xs font-mono text-[#1A1D29] transition-all cursor-pointer shadow-2xs"
              title="Configure AI Models & Providers"
            >
              <Settings className="w-3.5 h-3.5 text-[#6B7280]" />
              <span className="capitalize">{activeProvider}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Intro Banner */}
        <div className="border-b border-[#E5E1DA] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-display font-extrabold text-[#1A1D29] tracking-tight">
              Submit & Understand Your Problem Statement
            </h1>
            <p className="text-xs font-mono text-[#6B7280] mt-1 max-w-3xl leading-relaxed">
              Upload your hackathon challenge brief or paste text. DevLens AI extracts the stated facts, identifies constraints, and prepares a forensic breakdown before continuing to your conversational AI workspace.
            </p>
          </div>

          {psAnalysis && (
            <button
              onClick={handleContinue}
              className="px-5 py-2.5 rounded-xl bg-[#E85D2C] hover:bg-[#D45022] text-white text-xs font-mono font-bold transition-all shadow-md shadow-[#E85D2C]/20 flex items-center gap-2 cursor-pointer shrink-0 self-start sm:self-auto animate-pulse"
            >
              <span>Continue to AI Workspace</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>

        {/* Two-Column Grid: Left Upload/Editor + Right Structured Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* ================= LEFT COLUMN: INPUT & EXTRACTION (5 cols) ================= */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="p-5 rounded-2xl bg-white border border-[#E5E1DA] shadow-2xs flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold font-mono text-[#1A1D29] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#E85D2C]" />
                  Document Upload & Text
                </h3>
                {rawPSText && (
                  <span className="text-[11px] font-mono text-[#6B7280]">
                    {rawPSText.split(/\s+/).filter(Boolean).length} words
                  </span>
                )}
              </div>

              {/* Upload Dropzone */}
              <label className="border-2 border-dashed border-[#E5E1DA] hover:border-[#E85D2C]/60 rounded-xl p-5 text-center cursor-pointer transition-colors bg-[#FAFAF7] hover:bg-[#FFF4EE]/30 flex flex-col items-center justify-center gap-2">
                <Upload className="w-5 h-5 text-[#E85D2C]" />
                <div className="text-xs font-mono text-[#1A1D29]">
                  <span className="font-bold text-[#E85D2C]">Click to upload</span> or drag and drop
                </div>
                <div className="text-[10px] font-mono text-[#6B7280]">
                  PDF, DOCX, TXT, Markdown, JSON (document text extracted below)
                </div>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.md,.json,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {uploadedFileName && (
                <div className="flex items-center justify-between text-xs font-mono p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                  <span className="truncate">Loaded: {uploadedFileName}</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
              )}

              {/* Editable Preview Area */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs font-mono text-[#6B7280]">
                  <span>Review & Edit Extracted Text:</span>
                  {rawPSText && (
                    <button
                      onClick={() => setRawPSText('')}
                      className="text-red-600 hover:underline cursor-pointer text-[11px]"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <textarea
                  rows={9}
                  value={rawPSText}
                  onChange={(e) => setRawPSText(e.target.value)}
                  placeholder="Paste your problem statement here or review extracted document text..."
                  className="w-full p-3 rounded-xl border border-[#E5E1DA] bg-white text-xs font-mono text-[#1A1D29] focus:outline-none focus:border-[#E85D2C] leading-relaxed resize-y"
                />
              </div>

              {/* Sample Problem Statement Option */}
              <div className="flex items-center justify-between pt-1 text-xs font-mono">
                <button
                  type="button"
                  onClick={() => {
                    const sample = `Design an autonomous AI governance and codebase verification agent that evaluates whether developers met all stated hackathon criteria, verifies static code evidence, maps internal dependencies, and tests developers on their technical choices prior to final judging. Must support sub-second query response, secret sanitization, and grounded citations to exact files and lines.`;
                    setRawPSText(sample);
                  }}
                  className="text-[11px] text-[#E85D2C] hover:underline cursor-pointer flex items-center gap-1 font-semibold"
                >
                  <Sparkles className="w-3 h-3" />
                  Load Sample Problem Statement
                </button>
              </div>

              {/* Error Box */}
              {psError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-mono text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{psError}</span>
                </div>
              )}

              {/* Analyze Button */}
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={isAnalyzingPS || !rawPSText.trim()}
                className="w-full py-3 px-4 rounded-xl bg-[#E85D2C] hover:bg-[#D45022] text-white text-xs font-mono font-bold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isAnalyzingPS ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Analyzing Problem Statement...</span>
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

          {/* ================= RIGHT COLUMN: STRUCTURED BREAKDOWN (7 cols) ================= */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {psAnalysis ? (
              <div className="p-6 rounded-2xl bg-white border border-[#E5E1DA] shadow-xs flex flex-col gap-5 animate-fade-in">
                {/* Header of explanation */}
                <div className="flex items-start justify-between border-b border-[#E5E1DA] pb-4">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#E85D2C] font-bold bg-[#E85D2C]/10 px-2 py-0.5 rounded">
                      Forensic Problem Breakdown
                    </span>
                    <h2 className="text-xl font-bold font-display text-[#1A1D29] mt-2">
                      {psAnalysis.title || 'Structured Problem Explanation'}
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(JSON.stringify(psAnalysis, null, 2), 'ps')}
                      className="p-1.5 rounded-lg border border-[#E5E1DA] text-[#6B7280] hover:text-[#1A1D29] text-xs font-mono flex items-center gap-1 cursor-pointer"
                      title="Copy JSON"
                    >
                      {copiedKey === 'ps' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* 1. Problem Overview & Objective */}
                <div className="p-4 rounded-xl bg-[#FAFAF7] border border-[#E5E1DA]">
                  <div className="text-xs font-mono font-bold text-[#1A1D29] mb-1">
                    Problem Overview & High-Level Objective
                  </div>
                  <div className="text-xs text-[#6B7280] leading-relaxed font-mono">
                    {psAnalysis.overview_objective}
                  </div>
                </div>

                {/* 2. Actual Root Problem */}
                <div className="p-4 rounded-xl bg-orange-50/70 border border-orange-200">
                  <div className="text-xs font-mono font-bold text-orange-950 mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-orange-700" />
                    Actual Core Problem to Solve
                  </div>
                  <div className="text-xs text-orange-900 leading-relaxed font-mono">
                    {psAnalysis.actual_problem}
                  </div>
                </div>

                {/* 3. Target Users & Stakeholders */}
                <div className="p-4 rounded-xl bg-[#FAFAF7] border border-[#E5E1DA]">
                  <div className="text-xs font-mono font-bold text-[#1A1D29] mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3B5FE0]" />
                    Target Users & Stakeholders
                  </div>
                  <ul className="text-xs font-mono text-[#6B7280] space-y-1.5">
                    {psAnalysis.target_users_stakeholders?.map((user: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-[#3B5FE0]">•</span>
                        <span>{user}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 4. Requirements & Expected Deliverables (Stated Facts vs Inferred Recommendations) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Stated Facts */}
                  <div className="p-4 rounded-xl bg-white border border-emerald-200 shadow-2xs">
                    <div className="text-xs font-mono font-bold text-emerald-950 mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Stated Requirements (Facts)
                      </span>
                      <span className="text-[10px] bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-mono">
                        Document
                      </span>
                    </div>
                    <ul className="space-y-1.5 text-xs font-mono text-[#1A1D29]">
                      {psAnalysis.stated_requirements?.map((req: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-emerald-600 font-bold">✓</span>
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Inferred Recommendations */}
                  <div className="p-4 rounded-xl bg-white border border-indigo-200 shadow-2xs">
                    <div className="text-xs font-mono font-bold text-indigo-950 mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        Inferred Recommendations
                      </span>
                      <span className="text-[10px] bg-indigo-50 text-indigo-800 px-1.5 py-0.5 rounded font-mono">
                        AI Advised
                      </span>
                    </div>
                    <ul className="space-y-1.5 text-xs font-mono text-[#6B7280]">
                      {psAnalysis.inferred_recommendations?.map((rec: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-indigo-600 font-bold">→</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* 5. Constraints and Limitations */}
                <div className="p-4 rounded-xl bg-[#FAFAF7] border border-[#E5E1DA]">
                  <div className="text-xs font-mono font-bold text-[#1A1D29] mb-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E85D2C]" />
                    Stated Constraints & Limitations
                  </div>
                  <ul className="text-xs font-mono text-[#6B7280] space-y-1.5">
                    {psAnalysis.constraints_limitations?.map((c: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-[#E85D2C]">•</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* 6. Success Criteria / Judging Criteria */}
                <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200">
                  <div className="text-xs font-mono font-bold text-amber-950 mb-1">
                    Success & Judging Criteria
                  </div>
                  <div className="text-xs font-mono text-amber-900 leading-relaxed">
                    {psAnalysis.success_judging_criteria}
                  </div>
                </div>

                {/* 7. Important Terms Needing Clarification */}
                {psAnalysis.important_terms && psAnalysis.important_terms.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-[#FAFAF7] border border-[#E5E1DA]">
                    <div className="text-xs font-mono font-bold text-[#1A1D29] mb-2">
                      Important Terms & Domain Clarifications
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {psAnalysis.important_terms.map((term: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-white border border-[#E5E1DA] text-xs font-mono text-[#1A1D29] shadow-2xs"
                        >
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prominent CTA to Continue to AI Workspace */}
                <div className="pt-4 border-t border-[#E5E1DA] flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs font-mono text-[#6B7280]">
                    Explanation verified. Ready to brainstorm architectures, USPs, and tech choices?
                  </div>
                  <button
                    onClick={handleContinue}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#E85D2C] hover:bg-[#D45022] text-white text-xs font-mono font-bold transition-all shadow-md shadow-[#E85D2C]/25 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <span>Continue to AI Workspace</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-12 rounded-2xl bg-white border border-[#E5E1DA] shadow-2xs flex flex-col items-center justify-center text-center my-auto min-h-[420px]">
                <div className="w-12 h-12 rounded-2xl bg-[#E85D2C]/10 border border-[#E85D2C]/20 flex items-center justify-center text-[#E85D2C] mb-4">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold font-display text-[#1A1D29] mb-1">
                  Problem Statement Breakdown Awaiting
                </h3>
                <p className="text-xs font-mono text-[#6B7280] max-w-sm mb-4 leading-relaxed">
                  Upload or paste your problem statement on the left and click "Analyze Problem Statement" to generate a detailed, verifiable breakdown.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Provider Settings Modal */}
      <ProviderSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeProvider={activeProvider}
        activeModel={activeModel}
        onSelectProviderModel={(prov, mod) => {
          setActiveProvider(prov);
          setActiveModel(mod);
        }}
      />
    </div>
  );
}
