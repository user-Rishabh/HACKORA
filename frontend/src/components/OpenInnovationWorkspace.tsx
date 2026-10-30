import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Lightbulb,
  Sparkles,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Tag,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { API_BASE_URL } from '../lib/apiClient';
import { getProviderCredential } from '../lib/projectStore';
import ProviderSettingsModal from './ProviderSettingsModal';

interface OpenInnovationWorkspaceProps {
  onBackToMain: () => void;
  onGoToPS: () => void;
  onGoToStage2: () => void;
  onContinueToChat?: (customPrompt: string, provider: string, model: string) => void;
}

export default function OpenInnovationWorkspace({
  onBackToMain,
  onGoToPS,
  onGoToStage2,
  onContinueToChat,
}: OpenInnovationWorkspaceProps) {
  const [innovationPrompt, setInnovationPrompt] = useState('');
  const [isExploringInnovation, setIsExploringInnovation] = useState(false);
  const [innovationAnalysis, setInnovationAnalysis] = useState<any | null>(null);
  const [innovationError, setInnovationError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [provider, setProvider] = useState('groq');
  const [model, setModel] = useState('llama-3.3-70b-versatile');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleExploreInnovation = async () => {
    if (!innovationPrompt.trim()) {
      setInnovationError('Please provide a hackathon idea, domain, or target concept.');
      return;
    }

    setIsExploringInnovation(true);
    setInnovationError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/stage1/explore-open-innovation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: innovationPrompt.trim(), provider, model, api_key: getProviderCredential(provider)?.apiKey }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to explore open innovation landscape.');
      }

      const data = await response.json();
      setInnovationAnalysis({ ...data, incumbents: data.incumbents || data.existing_solutions || [] });
    } catch (err: any) {
      console.error(err);
      setInnovationError(err.message || 'Error communicating with DevLens AI backend.');
    } finally {
      setIsExploringInnovation(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] flex flex-col font-sans antialiased text-[#1A1D29]">
      {/* ── TOP HEADER ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-[#FDFCFB]/95 backdrop-blur-md border-b border-[#E5E1DA] px-4 py-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToMain}
              className="p-1.5 rounded-lg border border-[#E5E1DA] hover:border-[#1A1D29] bg-white text-[#6B7280] hover:text-[#1A1D29] transition-colors cursor-pointer"
              title="Back to Overview"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#3B5FE0] font-bold bg-[#3B5FE0]/10 px-2 py-0.5 rounded">
                  Stage 1: Explore & Plan
                </span>
                <span className="text-xs font-mono text-[#6B7280]">• Open Innovation Track</span>
              </div>
              <h1 className="text-base font-bold font-display text-[#1A1D29]">
                Open Innovation Research & Differentiation
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="px-3 py-1.5 rounded-xl border border-[#E5E1DA] hover:border-[#E85D2C] bg-white text-xs font-mono text-[#1A1D29] transition-colors cursor-pointer"
            >
              AI Provider: {provider}
            </button>
            <button
              onClick={onGoToPS}
              className="px-3 py-1.5 rounded-xl border border-[#E5E1DA] hover:border-[#E85D2C] bg-white text-xs font-mono text-[#1A1D29] transition-colors cursor-pointer"
            >
              Switch to Problem Statement
            </button>
            <button
              onClick={onGoToStage2}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-mono font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              <span>Stage 2: Audit</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 sm:px-6 flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Idea Prompt & Pre-canned Topics (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="p-5 rounded-2xl bg-white border border-[#E5E1DA] shadow-2xs flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold font-mono text-[#1A1D29] flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-[#3B5FE0]" />
                  Open Innovation Topic
                </h3>
              </div>

              <p className="text-xs font-mono text-[#6B7280] leading-relaxed">
                Working without a rigid corporate problem statement? Input a high-level concept or select a domain below to analyze market gaps, existing tools, and defensible technical edges.
              </p>

              {/* Sample Topics */}
              <div className="flex flex-col gap-1.5">
                <div className="text-[11px] font-mono text-[#6B7280]">Try a high-impact hackathon topic:</div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Federated Learning on Edge Devices for Healthcare',
                    'Voice-to-Workflow Agent with Deterministic Safety Rails',
                    'P2P Micro-Grid Energy Trading with Zero Knowledge Proofs',
                  ].map((topic) => (
                    <button
                      key={topic}
                      onClick={() => setInnovationPrompt(topic)}
                      className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-[#FAFAF7] hover:bg-[#EEF2FF] border border-[#E5E1DA] hover:border-[#3B5FE0]/40 text-[#6B7280] hover:text-[#3B5FE0] transition-colors text-left cursor-pointer"
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Textarea */}
              <textarea
                rows={6}
                value={innovationPrompt}
                onChange={(e) => setInnovationPrompt(e.target.value)}
                placeholder="Describe your open innovation idea or domain problem..."
                className="w-full p-3 rounded-xl border border-[#E5E1DA] bg-white text-xs font-mono text-[#1A1D29] focus:outline-none focus:border-[#3B5FE0] leading-relaxed resize-y"
              />

              {innovationError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-mono text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{innovationError}</span>
                </div>
              )}

              <button
                onClick={handleExploreInnovation}
                disabled={isExploringInnovation || !innovationPrompt.trim()}
                className="py-2.5 px-4 rounded-xl bg-[#3B5FE0] hover:bg-[#2F4EC2] text-white text-xs font-mono font-semibold transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isExploringInnovation ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Mapping Market Landscape & USPs...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Explore Landscape & Market Gaps</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Landscape Analysis (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {innovationAnalysis ? (
              <div className="p-6 rounded-2xl bg-white border border-[#E5E1DA] shadow-xs flex flex-col gap-5">
                <div className="flex items-center justify-between border-b border-[#E5E1DA] pb-3">
                  <div>
                    <span className="text-[10px] font-mono text-[#3B5FE0] font-bold uppercase tracking-wider bg-[#3B5FE0]/10 px-2 py-0.5 rounded">
                      Competitive Landscape Analysis
                    </span>
                    <h3 className="text-base font-bold font-display text-[#1A1D29] mt-1">
                      {innovationAnalysis.refined_concept || innovationPrompt}
                    </h3>
                  </div>
                  <button
                    onClick={() =>
                      handleCopy(JSON.stringify(innovationAnalysis, null, 2), 'innov-copy')
                    }
                    className="p-1.5 rounded-lg border border-[#E5E1DA] hover:bg-[#FAFAF7] text-[#6B7280] hover:text-[#1A1D29] transition-colors cursor-pointer text-xs font-mono flex items-center gap-1"
                  >
                    {copiedKey === 'innov-copy' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>Copy Analysis</span>
                  </button>
                </div>

                {/* Incumbents and Limitations */}
                <div>
                  <div className="text-xs font-mono font-bold text-[#1A1D29] mb-2.5 flex items-center gap-1.5">
                    <span>Incumbent Tools & Critical Limitations</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {innovationAnalysis.incumbents?.map((inc: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-[#FAFAF7] border border-[#E5E1DA] flex flex-col justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold font-mono text-[#1A1D29]">{inc.name}</div>
                          <div className="text-[11px] font-mono text-[#6B7280] mt-1">
                            {inc.description}
                          </div>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-[#E5E1DA] text-[10px] font-mono text-red-600">
                          <strong>Flaw:</strong> {inc.critical_limitation}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Defensible Opportunities & USPs */}
                <div>
                  <div className="text-xs font-mono font-bold text-emerald-900 mb-2.5">
                    Defensible Opportunities & Unique Value Propositions
                  </div>
                  <div className="space-y-2.5">
                    {innovationAnalysis.differentiation_opportunities?.map((diff: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200"
                      >
                        <div className="text-xs font-bold font-mono text-emerald-950 mb-1">
                          ✨ {diff.usp}
                        </div>
                        <div className="text-[11px] font-mono text-emerald-800">
                          <strong>Technical Implementation:</strong> {diff.technical_edge}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Winning Demo MVP Scope */}
                {innovationAnalysis.suggested_mvp_scope && (
                  <div className="p-4 rounded-xl bg-white border border-[#E5E1DA]">
                    <div className="text-xs font-mono font-bold text-[#1A1D29] mb-2">
                      Winning Demo MVP Scope
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {innovationAnalysis.suggested_mvp_scope.map((item: string, idx: number) => (
                        <div
                          key={idx}
                          className="p-2 rounded-lg bg-[#FAFAF7] border border-[#E5E1DA] text-xs font-mono text-[#1A1D29] flex items-center gap-2"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#3B5FE0]" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {onContinueToChat && (
                  <button onClick={() => onContinueToChat(innovationPrompt.trim(), provider, model)} className="px-4 py-2 rounded-xl bg-[#1A1D29] hover:bg-[#E85D2C] text-white text-xs font-mono font-semibold">
                    Continue exploring in chat
                  </button>
                )}
              </div>
            ) : (
              <div className="p-12 rounded-2xl bg-white border border-[#E5E1DA] shadow-2xs flex flex-col items-center justify-center text-center my-auto min-h-[350px]">
                <div className="w-12 h-12 rounded-2xl bg-[#3B5FE0]/10 border border-[#3B5FE0]/20 flex items-center justify-center text-[#3B5FE0] mb-4">
                  <Lightbulb className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold font-display text-[#1A1D29] mb-1">
                  Open Innovation Research Awaiting
                </h3>
                <p className="text-xs font-mono text-[#6B7280] max-w-sm mb-4 leading-relaxed">
                  Enter an idea or select a sample topic to analyze market gaps, existing tools, and defensible technical edges.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      <ProviderSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} activeProvider={provider} activeModel={model} onSelectProviderModel={(nextProvider, nextModel) => { setProvider(nextProvider); setModel(nextModel); }} />
    </div>
  );
}
