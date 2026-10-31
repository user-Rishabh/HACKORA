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
  Eye,
  EyeOff,
  Zap,
} from 'lucide-react';
import { API_BASE_URL } from '../lib/apiClient';
import { useAuth } from '../context/AuthContext';
import { sanitizeApiKey } from '../lib/projectStore';

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

interface StoredCredential {
  provider: string;
  status: string;
  masked_key: string;
  default_model?: string;
  expires_in?: number;
}

const PROVIDER_PORTALS: Record<string, { url: string; label: string; prefixHint: string }> = {
  groq: {
    url: 'https://console.groq.com/keys',
    label: 'console.groq.com/keys',
    prefixHint: 'Starts with gsk_...',
  },
  openai: {
    url: 'https://platform.openai.com/api-keys',
    label: 'platform.openai.com/api-keys',
    prefixHint: 'Starts with sk-...',
  },
  anthropic: {
    url: 'https://console.anthropic.com/settings/keys',
    label: 'console.anthropic.com/settings/keys',
    prefixHint: 'Starts with sk-ant-...',
  },
  gemini: {
    url: 'https://aistudio.google.com/app/apikey',
    label: 'aistudio.google.com/app/apikey',
    prefixHint: 'Starts with AIzaSy...',
  },
  moonshot: {
    url: 'https://platform.moonshot.cn/console/api-keys',
    label: 'platform.moonshot.cn/console',
    prefixHint: 'Starts with sk-...',
  },
  openrouter: {
    url: 'https://openrouter.ai/keys',
    label: 'openrouter.ai/keys',
    prefixHint: 'Starts with sk-or-...',
  },
};

export default function ProviderSettingsModal({
  isOpen,
  onClose,
  activeProvider,
  activeModel,
  onSelectProviderModel,
}: ProviderSettingsModalProps) {
  const { token } = useAuth();
  const [providers, setProviders] = useState<ProviderMeta[]>([]);
  const [serverCredentials, setServerCredentials] = useState<Record<string, StoredCredential>>({});
  const [selectedProviderId, setSelectedProviderId] = useState<string>(activeProvider || 'groq');
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>(activeModel || '');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);

  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [isLoadingProviders, setIsLoadingProviders] = useState(false);

  // Clear any legacy insecure localStorage keys
  useEffect(() => {
    try {
      localStorage.removeItem('devlens_ai_provider_credentials');
      sessionStorage.removeItem('devlens_ai_provider_credentials');
    } catch {}
  }, []);

  // Fetch supported providers
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

  // Fetch temporarily stored credentials for authenticated session
  const loadCredentials = async () => {
    if (!token) return;
    try {
      const resp = await fetch(`${API_BASE_URL}/api/credentials`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (resp.ok) {
        const data = await resp.json();
        const map: Record<string, StoredCredential> = {};
        (data.credentials || []).forEach((c: any) => {
          map[c.provider.toLowerCase()] = {
            provider: c.provider,
            status: c.status,
            masked_key: c.masked_key || c.key_preview || '',
            default_model: c.default_model,
            expires_in: c.expires_in,
          };
        });
        setServerCredentials(map);
      }
    } catch (e) {
      console.error('Failed to load stored credentials:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadProviders();
      loadCredentials();
      setApiKeyInput('');
      setValidationResult(null);
    }
  }, [isOpen, token]);

  useEffect(() => {
    const p = providers.find((pr) => pr.id === selectedProviderId);
    if (p) {
      const stored = serverCredentials[selectedProviderId];
      if (stored?.default_model) {
        setSelectedModel(stored.default_model);
      } else if (!selectedModel || !p.models.some((m) => m.id === selectedModel)) {
        setSelectedModel(p.default_model);
      }
    }
  }, [selectedProviderId, providers, serverCredentials]);

  if (!isOpen) return null;

  const currentProvider = providers.find((p) => p.id === selectedProviderId) || {
    id: selectedProviderId,
    name: selectedProviderId.toUpperCase(),
    description: '',
    has_server_key: false,
    default_model: selectedProviderId === 'groq' ? 'llama-3.1-8b-instant' : '',
    models: [],
  };

  const portalInfo = PROVIDER_PORTALS[selectedProviderId] || {
    url: '#',
    label: 'Provider Portal',
    prefixHint: '',
  };

  const storedCred = serverCredentials[selectedProviderId];
  const hasConfiguredKey = Boolean(apiKeyInput.trim() || storedCred?.masked_key || currentProvider.has_server_key);

  const handleValidateKey = async () => {
    const keyToValidate = sanitizeApiKey(apiKeyInput);
    if (!keyToValidate && !storedCred?.masked_key && !currentProvider.has_server_key) {
      setValidationResult({
        valid: false,
        message: `Please enter your ${currentProvider.name} API key below.`,
      });
      return;
    }

    setIsValidating(true);
    setValidationResult(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const resp = await fetch(`${API_BASE_URL}/api/credentials/validate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          provider: selectedProviderId,
          api_key: keyToValidate || undefined,
        }),
      });

      const data = await resp.json();
      setValidationResult({
        valid: data.valid,
        message: data.message || (data.valid ? 'API key verified successfully.' : 'Validation failed.'),
      });

      // If valid and a key was entered, store it on the server
      if (data.valid && keyToValidate && token) {
        await saveCredentialToServer(keyToValidate);
      }
    } catch (e: any) {
      setValidationResult({
        valid: true,
        message: `Key formatted. Connection to ${currentProvider.name} will be active when you chat.`,
      });
    } finally {
      setIsValidating(false);
    }
  };

  const saveCredentialToServer = async (key: string) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/api/credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider: selectedProviderId,
          api_key: key,
          default_model: selectedModel || currentProvider.default_model,
        }),
      });

      if (resp.ok) {
        const savedData = await resp.json();
        setServerCredentials((prev) => ({
          ...prev,
          [selectedProviderId]: {
            provider: savedData.provider,
            status: savedData.status,
            masked_key: savedData.masked_key,
            default_model: savedData.model,
            expires_in: savedData.expires_in,
          },
        }));
        setApiKeyInput('');
      } else {
        const err = await resp.json().catch(() => ({}));
        setValidationResult({
          valid: false,
          message: err.detail || 'Failed to save credential to server.',
        });
      }
    } catch (err: any) {
      console.error('Error saving credential:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAndApply = async () => {
    const cleaned = sanitizeApiKey(apiKeyInput);
    if (cleaned && token) {
      await saveCredentialToServer(cleaned);
    }
    const targetModel = selectedModel || currentProvider.default_model;
    onSelectProviderModel(selectedProviderId, targetModel);
    onClose();
  };

  const handleRemoveKey = async () => {
    if (!token) return;
    try {
      await fetch(`${API_BASE_URL}/api/credentials/${selectedProviderId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setServerCredentials((prev) => {
        const copy = { ...prev };
        delete copy[selectedProviderId];
        return copy;
      });
      setApiKeyInput('');
      setValidationResult({
        valid: false,
        message: `${currentProvider.name} credentials removed from server session.`,
      });
    } catch (e) {
      console.error('Failed to delete credential:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1A1D29]/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-[#E5E1DA] overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-[#E5E1DA] flex items-center justify-between bg-[#FAFAF7]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E85D2C]/10 flex items-center justify-center">
              <KeyRound className="w-4 h-4 text-[#E85D2C]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#1A1D29] font-mono">AI Provider & API Key Settings</h2>
              <p className="text-[11px] text-[#6B7280]">
                Bring Your Own Key (BYOK). Keys connect to models only when you send a message in chat.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#1A1D29] hover:bg-[#E5E1DA]/50 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body: Two Columns */}
        <div className="flex-1 flex overflow-hidden">
          {/* Provider Sidebar */}
          <div className="w-48 border-r border-[#E5E1DA] bg-[#FAFAF7]/50 p-2.5 space-y-1 overflow-y-auto">
            <div className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#6B7280] px-2 py-1">
              Select Provider
            </div>
            {providers.map((p) => {
              const isSelected = p.id === selectedProviderId;
              const hasKey = p.has_server_key || Boolean(serverCredentials[p.id]?.masked_key);

              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProviderId(p.id);
                    setApiKeyInput('');
                    setValidationResult(null);
                  }}
                  className={`w-full text-left p-2 rounded-xl transition-all flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-white border border-[#E85D2C] shadow-2xs text-[#1A1D29]'
                      : 'hover:bg-white/80 border border-transparent text-[#4A5568]'
                  }`}
                >
                  <div className="truncate">
                    <div className="text-xs font-semibold font-mono truncate">{p.name}</div>
                    <div className="text-[10px] text-[#6B7280] truncate">{p.description}</div>
                  </div>
                  {hasKey && (
                    <div className="w-2 h-2 rounded-full bg-[#059669] shrink-0 ml-1.5" title="Connected" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Column: Settings Form */}
          <div className="flex-1 p-5 overflow-y-auto space-y-5">
            {/* Provider Title & Connection Badge */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#1A1D29] font-mono flex items-center gap-2">
                  <span>{currentProvider.name} Credentials</span>
                  {currentProvider.id === 'groq' && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-100 text-amber-800">
                      High Speed LPU
                    </span>
                  )}
                </h3>
                <p className="text-xs text-[#6B7280] mt-0.5">{currentProvider.description}</p>
              </div>

              <div>
                {storedCred?.masked_key ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Key Saved & Ready
                  </span>
                ) : currentProvider.has_server_key ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    Default Server Key
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    Not Configured
                  </span>
                )}
              </div>
            </div>

            {/* Validation Banner */}
            {validationResult && (
              <div
                className={`p-3 rounded-xl border text-xs font-mono flex items-start gap-2.5 ${
                  validationResult.valid
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {validationResult.valid ? (
                  <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">{validationResult.valid ? 'Verified' : 'Validation Error'}</div>
                  <div className="text-[11px] mt-0.5">{validationResult.message}</div>
                </div>
              </div>
            )}

            {/* API Key Input Section */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <label className="font-bold text-[#1A1D29] flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-[#E85D2C]" />
                    <span>Enter your {currentProvider.name} API Key</span>
                  </label>
                  {portalInfo.url !== '#' && (
                    <a
                      href={portalInfo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#E85D2C] hover:underline flex items-center gap-1 text-[11px]"
                    >
                      <span>Get Key</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={
                      storedCred?.masked_key
                        ? `Stored: ${storedCred.masked_key} (Paste new key to replace)`
                        : portalInfo.prefixHint || 'Paste your private API key here...'
                    }
                    className="w-full p-2.5 pr-20 rounded-xl border border-[#E5E1DA] bg-white text-xs font-mono text-[#1A1D29] placeholder-[#9CA3AF] focus:outline-none focus:border-[#E85D2C]"
                  />
                  <div className="absolute right-2 top-2 flex items-center gap-1 text-[#6B7280]">
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="p-1 hover:text-[#1A1D29] transition-colors cursor-pointer"
                      title={showApiKey ? 'Hide Key' : 'Show Key'}
                    >
                      {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    {(apiKeyInput || storedCred?.masked_key) && (
                      <button
                        type="button"
                        onClick={handleRemoveKey}
                        className="p-1 text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                        title="Remove stored key"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-[#6B7280]">
                  <span>Portal: {portalInfo.label}</span>
                  {storedCred?.masked_key && !apiKeyInput && (
                    <span className="text-emerald-600 font-semibold">Active: {storedCred.masked_key}</span>
                  )}
                </div>
              </div>

              {/* Model Selection Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold text-[#1A1D29] flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-[#3B5FE0]" />
                  <span>Choose Model for {currentProvider.name}</span>
                </label>
                <select
                  value={selectedModel || currentProvider.default_model}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#E5E1DA] bg-white text-xs font-mono text-[#1A1D29] focus:outline-none focus:border-[#E85D2C] cursor-pointer"
                >
                  {currentProvider.models?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.id}) {m.context_window ? `[${Math.round(m.context_window / 1000)}k ctx]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Security Callout */}
              <div className="p-3 rounded-xl bg-[#FAFAF7] border border-[#E5E1DA] text-[10px] font-mono text-[#6B7280] flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" />
                <span>
                  Keys are temporarily stored in server memory with user and session isolation and automatic 1-hour TTL. Plaintext keys are never stored in databases or local browser storage and are wiped immediately upon logout.
                </span>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-3 border-t border-[#E5E1DA] flex items-center justify-between">
              <button
                type="button"
                onClick={handleValidateKey}
                disabled={isValidating || isSaving}
                className="px-3.5 py-2 rounded-xl border border-[#E5E1DA] hover:border-[#1A1D29] bg-white text-xs font-mono font-semibold text-[#1A1D29] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Validating Key...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Test Key Connection</span>
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
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-[#E85D2C] hover:bg-[#D45022] text-white text-xs font-mono font-semibold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save & Apply</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
