import React, { useState, useEffect } from 'react';
import {
  X,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  ShieldCheck,
  Cpu,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';
import { API_BASE_URL } from '../lib/apiClient';
import {
  getSavedCredentials,
  saveProviderCredential,
  removeProviderCredential,
} from '../lib/projectStore';

interface ProviderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProvider: string;
  activeModel: string;
  onSelectProviderModel: (provider: string, model: string) => void;
}

interface ProviderMeta {
  id: string;
  name: string;
  description: string;
  has_server_key: boolean;
  default_model: string;
  models: { id: string; name: string; context_window?: number }[];
}

export default function ProviderSettingsModal({
  isOpen,
  onClose,
  activeProvider,
  activeModel,
  onSelectProviderModel,
}: ProviderSettingsModalProps) {
  const [providers, setProviders] = useState<ProviderMeta[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>(activeProvider || 'groq');
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>(activeModel || '');

  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);

  // Load providers from backend
  const loadProviders = async () => {
    setIsLoadingProviders(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/llm/providers`);
      if (resp.ok) {
        const data = await resp.json();
        setProviders(data.providers || []);
      }
    } catch (e) {
      console.error('Failed to load LLM providers:', e);
    } finally {
      setIsLoadingProviders(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadProviders();
      const saved = getSavedCredentials();
      const cred = saved[selectedProviderId];
      setApiKeyInput(cred ? cred.apiKey : '');
      setValidationResult(null);
    }
  }, [isOpen, selectedProviderId]);

  useEffect(() => {
    const p = providers.find((pr) => pr.id === selectedProviderId);
    if (p && !selectedModel) {
      setSelectedModel(p.default_model);
    }
  }, [selectedProviderId, providers]);

  if (!isOpen) return null;

  const currentProvider = providers.find((p) => p.id === selectedProviderId) || {
    id: selectedProviderId,
    name: selectedProviderId.toUpperCase(),
    description: '',
    has_server_key: false,
    default_model: '',
    models: [],
  };

  const handleValidateKey = async () => {
    if (!apiKeyInput.trim() && !currentProvider.has_server_key) {
      setValidationResult({
        valid: false,
        message: 'Please enter an API key or use a provider with pre-configured server keys.',
      });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const resp = await fetch(`${API_BASE_URL}/api/llm/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProviderId,
          api_key: apiKeyInput.trim() || undefined,
        }),
      });

      const data = await resp.json();
      setValidationResult({
        valid: data.valid,
        message: data.message,
      });

      if (data.valid && apiKeyInput.trim()) {
        saveProviderCredential(selectedProviderId, apiKeyInput.trim(), selectedModel);
      }
    } catch (e: any) {
      setValidationResult({
        valid: false,
        message: `Validation failed: ${e.message || 'Connection timeout.'}`,
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSaveAndApply = () => {
    if (apiKeyInput.trim()) {
      saveProviderCredential(selectedProviderId, apiKeyInput.trim(), selectedModel);
    }
    onSelectProviderModel(selectedProviderId, selectedModel || currentProvider.default_model);
    onClose();
  };

  const handleRemoveKey = () => {
    removeProviderCredential(selectedProviderId);
    setApiKeyInput('');
    setValidationResult({
      valid: false,
      message: 'Credential removed from client session.',
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1A1D29]/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E5E1DA] shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden max-h-[90vh] animate-fade-in">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#E5E1DA] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#E85D2C]/10 border border-[#E85D2C]/20 flex items-center justify-center text-[#E85D2C]">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-[#1A1D29]">
                AI Provider & Model Settings
              </h3>
              <p className="text-[11px] font-mono text-[#6B7280]">
                Configure multi-provider models for grounded reasoning and planning.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border border-[#E5E1DA] text-[#6B7280] hover:text-[#1A1D29] hover:bg-[#FAFAF7] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Left provider selector + Right config */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 min-h-[380px]">
          {/* Provider List Sidebar (5 cols) */}
          <div className="md:col-span-4 border-r border-[#E5E1DA] p-3 flex flex-col gap-1.5 bg-[#FAFAF7]/60">
            <span className="text-[10px] font-mono uppercase font-bold text-[#6B7280] px-2 py-1">
              Supported Providers
            </span>
            {providers.map((p) => {
              const isSelected = p.id === selectedProviderId;
              const hasKey = p.has_server_key || !!getSavedCredentials()[p.id];
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProviderId(p.id);
                    setSelectedModel(p.default_model);
                  }}
                  className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#E85D2C] bg-white shadow-xs text-[#E85D2C]'
                      : 'border-transparent hover:border-[#E5E1DA] hover:bg-white text-[#1A1D29]'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold font-mono">{p.name}</div>
                    <div className="text-[10px] text-[#6B7280] truncate max-w-[130px]">
                      {p.description}
                    </div>
                  </div>
                  {hasKey && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Key Active" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Provider Configuration Panel (8 cols) */}
          <div className="md:col-span-8 p-5 flex flex-col justify-between gap-4">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="font-display font-bold text-sm text-[#1A1D29]">
                    {currentProvider.name} Configuration
                  </h4>
                  {currentProvider.has_server_key && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                      Server Key Ready
                    </span>
                  )}
                </div>
                <p className="text-xs font-mono text-[#6B7280] mt-0.5">
                  {currentProvider.description}
                </p>
              </div>

              {/* API Key Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-[#1A1D29] flex items-center justify-between">
                  <span>API Key</span>
                  {currentProvider.has_server_key && !apiKeyInput && (
                    <span className="text-[10px] font-normal text-[#6B7280]">
                      (Using configured server default key)
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={
                      currentProvider.has_server_key
                        ? '•••••••••••••••• (Server key active, enter custom key to override)'
                        : `Enter your ${currentProvider.name} API key...`
                    }
                    className="w-full p-2.5 rounded-xl border border-[#E5E1DA] bg-white text-xs font-mono text-[#1A1D29] focus:outline-none focus:border-[#E85D2C] pr-10"
                  />
                  {apiKeyInput && (
                    <button
                      onClick={handleRemoveKey}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-red-600 transition-colors cursor-pointer"
                      title="Clear credential"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Validation Status message */}
              {validationResult && (
                <div
                  className={`p-3 rounded-xl border text-xs font-mono flex items-start gap-2 ${
                    validationResult.valid
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                >
                  {validationResult.valid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  )}
                  <span>{validationResult.message}</span>
                </div>
              )}

              {/* Model Selection Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-[#1A1D29] flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-[#3B5FE0]" />
                  <span>Selected Model</span>
                </label>
                <select
                  value={selectedModel || currentProvider.default_model}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#E5E1DA] bg-white text-xs font-mono text-[#1A1D29] focus:outline-none focus:border-[#E85D2C]"
                >
                  {currentProvider.models?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.id}) {m.context_window ? `[${Math.round(m.context_window / 1000)}k ctx]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Security Callout */}
              <div className="p-3 rounded-xl bg-[#FAFAF7] border border-[#E5E1DA] text-[11px] font-mono text-[#6B7280] flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" />
                <span>
                  Keys are stored exclusively in your browser session for direct backend mediation and are never logged, committed to source, or exposed in public responses.
                </span>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-[#E5E1DA] flex items-center justify-between">
              <button
                type="button"
                onClick={handleValidateKey}
                disabled={isValidating}
                className="px-3.5 py-2 rounded-xl border border-[#E5E1DA] hover:border-[#1A1D29] bg-white text-xs font-mono font-semibold text-[#1A1D29] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Test Connection</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-xl text-xs font-mono text-[#6B7280] hover:text-[#1A1D29] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndApply}
                  className="px-4 py-2 rounded-xl bg-[#E85D2C] hover:bg-[#D45022] text-white text-xs font-mono font-semibold transition-all shadow-xs cursor-pointer"
                >
                  Apply & Select
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
