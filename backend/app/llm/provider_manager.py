import os
import json
import re
import urllib.request
import urllib.error
import urllib.parse
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Generator

# ==============================================================================
# PROVIDER CATALOG & MODEL DEFINITIONS
# ==============================================================================

PROVIDER_CATALOG: Dict[str, Dict[str, Any]] = {
    "groq": {
        "id": "groq",
        "name": "Groq",
        "description": "Ultra-fast LPU inference hosting open models",
        "key_env_var": "GROQ_API_KEY",
        "default_model": "llama-3.1-8b-instant",
        "models": [
            {"id": "llama-3.1-8b-instant", "name": "Llama 3.1 8B Instant (Universal & Fast)", "context_window": 131072},
            {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B Versatile", "context_window": 131072},
            {"id": "llama-3.1-70b-versatile", "name": "Llama 3.1 70B Versatile", "context_window": 131072},
            {"id": "llama3-70b-8192", "name": "Llama 3 70B (8k)", "context_window": 8192},
            {"id": "llama3-8b-8192", "name": "Llama 3 8B (8k)", "context_window": 8192},
            {"id": "mixtral-8x7b-32768", "name": "Mixtral 8x7B (32k)", "context_window": 32768},
        ],
    },
    "openai": {
        "id": "openai",
        "name": "OpenAI",
        "description": "Industry standard reasoning and coding models",
        "key_env_var": "OPENAI_API_KEY",
        "default_model": "gpt-4o-mini",
        "models": [
            {"id": "gpt-4o", "name": "GPT-4o (Flagship Multimodal)", "context_window": 128000},
            {"id": "gpt-4o-mini", "name": "GPT-4o Mini (Fast & Efficient)", "context_window": 128000},
            {"id": "gpt-4-turbo", "name": "GPT-4 Turbo", "context_window": 128000},
            {"id": "o1-mini", "name": "o1-mini (Specialized Reasoning)", "context_window": 128000},
            {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "context_window": 16385},
        ],
    },
    "anthropic": {
        "id": "anthropic",
        "name": "Anthropic (Claude)",
        "description": "Claude 3.5 Sonnet and Haiku for nuanced technical reasoning",
        "key_env_var": "ANTHROPIC_API_KEY",
        "default_model": "claude-3-5-sonnet-20241022",
        "models": [
            {"id": "claude-3-5-sonnet-20241022", "name": "Claude 3.5 Sonnet (Latest)", "context_window": 200000},
            {"id": "claude-3-5-haiku-20241022", "name": "Claude 3.5 Haiku (Fast)", "context_window": 200000},
            {"id": "claude-3-opus-20240229", "name": "Claude 3 Opus", "context_window": 200000},
            {"id": "claude-3-sonnet-20240229", "name": "Claude 3 Sonnet", "context_window": 200000},
        ],
    },
    "gemini": {
        "id": "gemini",
        "name": "Google Gemini",
        "description": "Large context window reasoning models from Google DeepMind",
        "key_env_var": "GEMINI_API_KEY",
        "default_model": "gemini-1.5-flash",
        "models": [
            {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash (Next-Gen)", "context_window": 1000000},
            {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro (Deep Reasoning)", "context_window": 2000000},
            {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash (Fast Multimodal)", "context_window": 1000000},
        ],
    },
    "moonshot": {
        "id": "moonshot",
        "name": "Moonshot AI (Kimi)",
        "description": "Large context models optimized for document intelligence & code",
        "key_env_var": "MOONSHOT_API_KEY",
        "default_model": "moonshot-v1-8k",
        "models": [
            {"id": "moonshot-v1-8k", "name": "Moonshot v1 8K", "context_window": 8192},
            {"id": "moonshot-v1-32k", "name": "Moonshot v1 32K", "context_window": 32768},
            {"id": "moonshot-v1-128k", "name": "Moonshot v1 128K", "context_window": 128000},
        ],
    },
    "openrouter": {
        "id": "openrouter",
        "name": "OpenRouter",
        "description": "Unified router gateway accessing over 100+ open and proprietary models",
        "key_env_var": "OPENROUTER_API_KEY",
        "default_model": "openrouter/auto",
        "models": [
            {"id": "openrouter/auto", "name": "Auto (Best Route)", "context_window": 128000},
            {"id": "anthropic/claude-3.5-sonnet", "name": "Claude 3.5 Sonnet (via OpenRouter)", "context_window": 200000},
            {"id": "openai/gpt-4o", "name": "GPT-4o (via OpenRouter)", "context_window": 128000},
            {"id": "meta-llama/llama-3.3-70b-instruct", "name": "Llama 3.3 70B Instruct", "context_window": 128000},
            {"id": "google/gemini-flash-1.5", "name": "Gemini Flash 1.5 (via OpenRouter)", "context_window": 1000000},
        ],
    },
}

# ==============================================================================
# SECURITY & CREDENTIAL MANAGEMENT HELPERS
# ==============================================================================

KEY_FORMAT_PREFIXES = {
    "groq": "gsk_",
    "openai": "sk-",
    "anthropic": "sk-ant-",
    "moonshot": "sk-",
    "openrouter": "sk-or-",
}

DEFAULT_REQUEST_HEADERS = {
    "User-Agent": "HACKORA/1.0 (BYOK; Multi-Provider Client)",
    "Accept": "application/json",
}

def clean_api_key(key: Optional[str]) -> Optional[str]:
    """
    Sanitizes API keys by stripping whitespace, accidental surrounding quotes,
    and redundant 'Bearer ' authorization prefixes.
    """
    if not key:
        return None
    cleaned = str(key).strip()
    if (cleaned.startswith('"') and cleaned.endswith('"')) or (cleaned.startswith("'") and cleaned.endswith("'")):
        cleaned = cleaned[1:-1].strip()
    if cleaned.lower().startswith("bearer "):
        cleaned = cleaned[7:].strip()
    return cleaned if cleaned else None

def mask_api_key(api_key: Optional[str]) -> Optional[str]:
    """
    Returns a masked preview of the API key for display purposes.
    Never exposes the entire secret key.
    Example: 'gsk_1234567890abcdef' -> 'gsk_••••••••cdef'
    """
    cleaned = clean_api_key(api_key)
    if not cleaned:
        return None
    if len(cleaned) <= 8:
        return "••••••••"
    prefix = cleaned[:4]
    suffix = cleaned[-4:]
    return f"{prefix}••••••••{suffix}"

def resolve_api_key(provider: str, custom_key: Optional[str] = None) -> Optional[str]:
    """
    Resolves the active API key for a provider.
    Prioritizes the caller's session-specific custom key,
    falling back to server environment variables if configured and valid non-placeholder.
    """
    cleaned_custom = clean_api_key(custom_key)
    if cleaned_custom:
        return cleaned_custom

    provider_info = PROVIDER_CATALOG.get(provider.lower())
    if provider_info and provider_info.get("key_env_var"):
        env_key = clean_api_key(os.getenv(provider_info["key_env_var"]))
        if env_key and not env_key.lower().startswith("gsk_placeholder") and not env_key.lower().startswith("sk-placeholder") and not env_key.startswith("gsk_q0E8"):
            return env_key

    if provider.lower() == "groq":
        raw_groq = clean_api_key(os.getenv("GROQ_API_KEY"))
        if raw_groq and not raw_groq.lower().startswith("gsk_placeholder") and not raw_groq.startswith("gsk_q0E8"):
            return raw_groq
    return None

def normalize_provider_error(provider: str, error: Exception, raw_body: Optional[str] = None) -> str:
    """
    Translates raw provider HTTP/socket exceptions into clear, actionable messages.
    """
    msg = str(error)
    if isinstance(error, urllib.error.HTTPError):
        code = error.code
        body_text = raw_body
        if not body_text:
            try:
                body_text = error.read().decode("utf-8", errors="ignore")
            except Exception:
                body_text = ""
        try:
            body = json.loads(body_text) if body_text else {}
            if "error" in body:
                if isinstance(body["error"], dict):
                    msg = body["error"].get("message", msg)
                else:
                    msg = str(body["error"])
            elif "message" in body:
                msg = str(body["message"])
        except Exception:
            if body_text:
                msg = body_text

        if code in (401, 403):
            return f"Invalid or unauthorized API key for {provider.capitalize()}. Please verify your key in Provider Settings."
        if code == 429:
            return f"Rate limit reached for {provider.capitalize()}. {msg}"
        if code == 400:
            return f"{provider.capitalize()} rejected the request format: {msg}"
        return f"{provider.capitalize()} API error (HTTP {code}): {msg}"

    if "timed out" in msg.lower():
        return f"Request to {provider.capitalize()} timed out. The provider might be experiencing high traffic."
    return f"{provider.capitalize()} connection error: {msg}"

# ==============================================================================
# ABSTRACT BASE ADAPTER
# ==============================================================================

class BaseLLMAdapter(ABC):
    """
    Abstract Base Class for all LLM Provider Adapters.
    Encapsulates message generation, streaming, model discovery, and validation.
    """
    def __init__(self, provider_id: str):
        self.provider_id = provider_id
        self.meta = PROVIDER_CATALOG.get(provider_id, {})

    @abstractmethod
    def send_message(
        self,
        model: str,
        messages: List[Dict[str, str]],
        system_prompt: str = "",
        api_key: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 2048,
    ) -> str:
        pass

    @abstractmethod
    def stream_message(
        self,
        model: str,
        messages: List[Dict[str, str]],
        system_prompt: str = "",
        api_key: Optional[str] = None,
        temperature: float = 0.3,
    ) -> Generator[str, None, None]:
        pass

    @abstractmethod
    def validate_api_key(self, api_key: Optional[str] = None) -> Dict[str, Any]:
        pass

    @abstractmethod
    def list_models(self, api_key: Optional[str] = None) -> List[Dict[str, Any]]:
        pass

    def get_effective_key(self, custom_key: Optional[str] = None) -> str:
        key = resolve_api_key(self.provider_id, custom_key)
        if not key:
            raise ValueError(
                f"No API key configured for {self.provider_id.upper()}. "
                f"Please enter your key in Provider Settings."
            )
        return key

# ==============================================================================
# OPENAI-COMPATIBLE ADAPTER (Groq, OpenAI, Moonshot, OpenRouter)
# ==============================================================================

class OpenAICompatibleAdapter(BaseLLMAdapter):
    """
    Adapter for providers using OpenAI-compatible chat completion endpoints.
    """
    def __init__(
        self,
        provider_id: str,
        base_url: str,
        models_url: Optional[str] = None,
        extra_headers: Optional[Dict[str, str]] = None
    ):
        super().__init__(provider_id)
        self.base_url = base_url
        self.models_url = models_url or f"{base_url.rsplit('/chat', 1)[0]}/models"
        self.extra_headers = extra_headers or {}

    def _prepare_payload(
        self,
        model: str,
        messages: List[Dict[str, str]],
        system_prompt: str,
        temperature: float,
        max_tokens: Optional[int] = None,
        stream: bool = False,
    ) -> Dict[str, Any]:
        chat_msgs: List[Dict[str, str]] = []
        if system_prompt:
            chat_msgs.append({"role": "system", "content": system_prompt})
        for m in messages:
            chat_msgs.append({"role": m.get("role", "user"), "content": m.get("content", "")})

        chosen_model = model or self.meta.get("default_model", "gpt-4o-mini")
        payload: Dict[str, Any] = {
            "model": chosen_model,
            "messages": chat_msgs,
            "temperature": temperature,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens
        if stream:
            payload["stream"] = True
        return payload

    def _get_candidate_models(self, preferred_model: str) -> List[str]:
        candidates = [preferred_model] if preferred_model else []
        default_model = self.meta.get("default_model")
        if default_model and default_model not in candidates:
            candidates.append(default_model)
        for m in self.meta.get("models", []):
            mid = m.get("id") if isinstance(m, dict) else m
            if mid and mid not in candidates:
                candidates.append(mid)
        return candidates

    def send_message(
        self,
        model: str,
        messages: List[Dict[str, str]],
        system_prompt: str = "",
        api_key: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 2048,
    ) -> str:
        key = self.get_effective_key(api_key)
        candidates = self._get_candidate_models(model)
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            **DEFAULT_REQUEST_HEADERS,
            **self.extra_headers,
        }
        last_error = None
        last_raw_body = ""
        for candidate in candidates:
            payload = self._prepare_payload(candidate, messages, system_prompt, temperature, max_tokens, stream=False)
            req = urllib.request.Request(self.base_url, data=json.dumps(payload).encode("utf-8"), headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=60) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    choices = data.get("choices", [])
                    if choices:
                        return choices[0].get("message", {}).get("content", "").strip()
                    return "Empty response received from model."
            except urllib.error.HTTPError as he:
                last_error = he
                try:
                    last_raw_body = he.read().decode("utf-8", errors="ignore")
                except Exception:
                    last_raw_body = ""

                # Handle TPM (Tokens Per Minute) limit / 413 Payload Too Large by pruning context and retrying
                if he.code == 413 or "tokens per minute" in last_raw_body or "too large" in last_raw_body:
                    try:
                        shorter_msgs = [{"role": m.get("role", "user"), "content": m.get("content", "")[:2000]} for m in messages[-4:]]
                        shorter_prompt = (system_prompt[:2500] if system_prompt else "")
                        retry_payload = self._prepare_payload(candidate, shorter_msgs, shorter_prompt, temperature, max_tokens=1024, stream=False)
                        retry_req = urllib.request.Request(self.base_url, data=json.dumps(retry_payload).encode("utf-8"), headers=headers)
                        with urllib.request.urlopen(retry_req, timeout=45) as r_resp:
                            r_data = json.loads(r_resp.read().decode("utf-8"))
                            r_choices = r_data.get("choices", [])
                            if r_choices:
                                return r_choices[0].get("message", {}).get("content", "").strip()
                    except Exception:
                        pass
                    continue

                # Check if this model is unavailable, decommissioned, or unauthorized on this key
                is_unavailable = (
                    he.code == 404 or
                    "does not exist" in last_raw_body or
                    "decommissioned" in last_raw_body or
                    "model_not_found" in last_raw_body or
                    "not have access" in last_raw_body
                )
                if is_unavailable:
                    continue
                raise RuntimeError(normalize_provider_error(self.provider_id, he, raw_body=last_raw_body)) from he
            except Exception as e:
                last_error = e
                raise RuntimeError(normalize_provider_error(self.provider_id, e)) from e

        if last_error:
            raise RuntimeError(normalize_provider_error(self.provider_id, last_error, raw_body=last_raw_body))
        return "Empty response received from model."

    def stream_message(
        self,
        model: str,
        messages: List[Dict[str, str]],
        system_prompt: str = "",
        api_key: Optional[str] = None,
        temperature: float = 0.3,
    ) -> Generator[str, None, None]:
        try:
            key = self.get_effective_key(api_key)
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"
            return

        candidates = self._get_candidate_models(model)
        headers = {
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            **DEFAULT_REQUEST_HEADERS,
            **self.extra_headers,
        }
        last_error = None
        last_raw_body = ""
        for candidate in candidates:
            payload = self._prepare_payload(candidate, messages, system_prompt, temperature, stream=True)
            req = urllib.request.Request(self.base_url, data=json.dumps(payload).encode("utf-8"), headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=90) as resp:
                    for line in resp:
                        line_str = line.decode("utf-8").strip()
                        if not line_str or line_str.startswith(":"):
                            continue
                        if line_str.startswith("data: "):
                            data_part = line_str[6:]
                            if data_part == "[DONE]":
                                yield "data: [DONE]\n\n"
                                return
                            try:
                                parsed = json.loads(data_part)
                                delta = parsed.get("choices", [{}])[0].get("delta", {})
                                content = delta.get("content", "")
                                if content:
                                    yield f"data: {json.dumps({'text': content})}\n\n"
                            except Exception:
                                continue
                    # Successfully completed stream
                    yield "data: [DONE]\n\n"
                    return
            except urllib.error.HTTPError as he:
                last_error = he
                try:
                    last_raw_body = he.read().decode("utf-8", errors="ignore")
                except Exception:
                    last_raw_body = ""

                # Handle TPM / 413 by trimming context and retrying
                if he.code == 413 or "tokens per minute" in last_raw_body or "too large" in last_raw_body:
                    try:
                        shorter_msgs = [{"role": m.get("role", "user"), "content": m.get("content", "")[:2000]} for m in messages[-4:]]
                        shorter_prompt = (system_prompt[:2500] if system_prompt else "")
                        retry_payload = self._prepare_payload(candidate, shorter_msgs, shorter_prompt, temperature, stream=True)
                        retry_req = urllib.request.Request(self.base_url, data=json.dumps(retry_payload).encode("utf-8"), headers=headers)
                        with urllib.request.urlopen(retry_req, timeout=90) as r_resp:
                            for r_line in r_resp:
                                r_str = r_line.decode("utf-8").strip()
                                if not r_str or r_str.startswith(":"):
                                    continue
                                if r_str.startswith("data: "):
                                    dp = r_str[6:]
                                    if dp == "[DONE]":
                                        yield "data: [DONE]\n\n"
                                        return
                                    try:
                                        p_data = json.loads(dp)
                                        txt = p_data.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                        if txt:
                                            yield f"data: {json.dumps({'text': txt})}\n\n"
                                    except Exception:
                                        continue
                            yield "data: [DONE]\n\n"
                            return
                    except Exception:
                        pass
                    continue

                is_unavailable = (
                    he.code == 404 or
                    "does not exist" in last_raw_body or
                    "decommissioned" in last_raw_body or
                    "model_not_found" in last_raw_body or
                    "not have access" in last_raw_body
                )
                if is_unavailable:
                    continue
                yield f"data: {json.dumps({'error': normalize_provider_error(self.provider_id, he, raw_body=last_raw_body)})}\n\n"
                yield "data: [DONE]\n\n"
                return
            except Exception as e:
                last_error = e
                yield f"data: {json.dumps({'error': normalize_provider_error(self.provider_id, e)})}\n\n"
                yield "data: [DONE]\n\n"
                return

        if last_error:
            yield f"data: {json.dumps({'error': normalize_provider_error(self.provider_id, last_error, raw_body=last_raw_body)})}\n\n"
        yield "data: [DONE]\n\n"

    def validate_api_key(self, api_key: Optional[str] = None) -> Dict[str, Any]:
        key = resolve_api_key(self.provider_id, api_key)
        if not key:
            return {"valid": False, "message": f"No API key provided or found for {self.provider_id}."}
        
        # Local format checks first
        prefix = KEY_FORMAT_PREFIXES.get(self.provider_id)
        if prefix and not key.startswith(prefix):
            return {
                "valid": False,
                "message": f"{self.meta.get('name', self.provider_id)} API keys typically start with '{prefix}'."
            }

        headers = {
            "Authorization": f"Bearer {key}",
            **DEFAULT_REQUEST_HEADERS,
            **self.extra_headers,
        }
        req = urllib.request.Request(self.models_url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode())
                    models = [m.get("id") for m in data.get("data", []) if m.get("id")]
                    return {
                        "valid": True,
                        "message": f"{self.meta.get('name', self.provider_id)} credentials successfully verified.",
                        "key_preview": mask_api_key(key),
                        "available_models": models[:12] if models else None
                    }
        except urllib.error.HTTPError as he:
            return {"valid": False, "message": normalize_provider_error(self.provider_id, he)}
        except Exception as e:
            # If network is offline, sandbox blocked, or timeout, accept the formatted key for chat
            return {
                "valid": True,
                "message": f"{self.meta.get('name', self.provider_id)} key format validated. Connection will occur when using chat.",
                "key_preview": mask_api_key(key),
            }
        return {"valid": False, "message": f"Validation failed for {self.provider_id}."}

    def list_models(self, api_key: Optional[str] = None) -> List[Dict[str, Any]]:
        # Always return the curated catalog immediately to avoid connecting to network before chat
        return self.meta.get("models", [])

# ==============================================================================
# CONCRETE ADAPTERS
# ==============================================================================

class GroqAdapter(OpenAICompatibleAdapter):
    def __init__(self):
        super().__init__(
            provider_id="groq",
            base_url="https://api.groq.com/openai/v1/chat/completions",
            models_url="https://api.groq.com/openai/v1/models"
        )

class OpenAIAdapter(OpenAICompatibleAdapter):
    def __init__(self):
        super().__init__(
            provider_id="openai",
            base_url="https://api.openai.com/v1/chat/completions",
            models_url="https://api.openai.com/v1/models"
        )

class MoonshotAdapter(OpenAICompatibleAdapter):
    def __init__(self):
        super().__init__(
            provider_id="moonshot",
            base_url="https://api.moonshot.cn/v1/chat/completions",
            models_url="https://api.moonshot.cn/v1/models"
        )

class OpenRouterAdapter(OpenAICompatibleAdapter):
    def __init__(self):
        super().__init__(
            provider_id="openrouter",
            base_url="https://openrouter.ai/api/v1/chat/completions",
            models_url="https://openrouter.ai/api/v1/models",
            extra_headers={"HTTP-Referer": "https://hackora.ai", "X-Title": "HACKORA"}
        )

# ==============================================================================
# ANTHROPIC (CLAUDE) ADAPTER
# ==============================================================================

class AnthropicAdapter(BaseLLMAdapter):
    def __init__(self):
        super().__init__("anthropic")
        self.endpoint = "https://api.anthropic.com/v1/messages"
        self.version = "2023-06-01"

    def _format_messages(self, messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
        out = []
        for m in messages:
            role = "user" if m.get("role") == "user" else "assistant"
            out.append({"role": role, "content": m.get("content", "")})
        return out

    def send_message(
        self,
        model: str,
        messages: List[Dict[str, str]],
        system_prompt: str = "",
        api_key: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 2048,
    ) -> str:
        key = self.get_effective_key(api_key)
        payload: Dict[str, Any] = {
            "model": model or self.meta.get("default_model", "claude-3-5-sonnet-20241022"),
            "max_tokens": max_tokens,
            "messages": self._format_messages(messages),
            "temperature": temperature,
        }
        if system_prompt:
            payload["system"] = system_prompt

        req = urllib.request.Request(
            self.endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "x-api-key": key,
                "anthropic-version": self.version,
                "content-type": "application/json",
                **DEFAULT_REQUEST_HEADERS,
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                contents = data.get("content", [])
                text_parts = [c.get("text", "") for c in contents if c.get("type") == "text"]
                return "".join(text_parts).strip()
        except Exception as e:
            raise RuntimeError(normalize_provider_error(self.provider_id, e)) from e

    def stream_message(
        self,
        model: str,
        messages: List[Dict[str, str]],
        system_prompt: str = "",
        api_key: Optional[str] = None,
        temperature: float = 0.3,
    ) -> Generator[str, None, None]:
        try:
            key = self.get_effective_key(api_key)
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"
            return

        payload: Dict[str, Any] = {
            "model": model or self.meta.get("default_model", "claude-3-5-sonnet-20241022"),
            "max_tokens": 4096,
            "messages": self._format_messages(messages),
            "temperature": temperature,
            "stream": True,
        }
        if system_prompt:
            payload["system"] = system_prompt

        req = urllib.request.Request(
            self.endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "x-api-key": key,
                "anthropic-version": self.version,
                "content-type": "application/json",
                **DEFAULT_REQUEST_HEADERS,
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                for line in resp:
                    line_str = line.decode("utf-8").strip()
                    if not line_str or line_str.startswith(":"):
                        continue
                    if line_str.startswith("data: "):
                        data_str = line_str[6:]
                        try:
                            event_data = json.loads(data_str)
                            event_type = event_data.get("type")
                            if event_type == "content_block_delta":
                                delta = event_data.get("delta", {})
                                text = delta.get("text", "")
                                if text:
                                    yield f"data: {json.dumps({'text': text})}\n\n"
                            elif event_type == "message_stop":
                                yield "data: [DONE]\n\n"
                                return
                        except Exception:
                            continue
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': normalize_provider_error(self.provider_id, e)})}\n\n"
            yield "data: [DONE]\n\n"

    def validate_api_key(self, api_key: Optional[str] = None) -> Dict[str, Any]:
        key = resolve_api_key(self.provider_id, api_key)
        if not key:
            return {"valid": False, "message": "No Anthropic API key provided or found."}
        payload = {
            "model": "claude-3-5-haiku-20241022",
            "max_tokens": 1,
            "messages": [{"role": "user", "content": "ping"}]
        }
        req = urllib.request.Request(
            self.endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "x-api-key": key,
                "anthropic-version": self.version,
                "content-type": "application/json",
                **DEFAULT_REQUEST_HEADERS,
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status in (200, 201):
                    return {
                        "valid": True,
                        "message": "Anthropic API credentials successfully verified.",
                        "key_preview": mask_api_key(key)
                    }
        except Exception as e:
            return {"valid": False, "message": normalize_provider_error(self.provider_id, e)}
        return {"valid": False, "message": "Anthropic validation failed."}

    def list_models(self, api_key: Optional[str] = None) -> List[Dict[str, Any]]:
        # Anthropic provides a static curated list of Claude models
        return self.meta.get("models", [])

# ==============================================================================
# GOOGLE GEMINI ADAPTER
# ==============================================================================

class GeminiAdapter(BaseLLMAdapter):
    def __init__(self):
        super().__init__("gemini")

    def _format_contents(self, messages: List[Dict[str, str]]) -> List[Dict[str, Any]]:
        contents = []
        for m in messages:
            role = "user" if m.get("role") == "user" else "model"
            contents.append({
                "role": role,
                "parts": [{"text": m.get("content", "")}]
            })
        return contents

    def send_message(
        self,
        model: str,
        messages: List[Dict[str, str]],
        system_prompt: str = "",
        api_key: Optional[str] = None,
        temperature: float = 0.3,
        max_tokens: int = 2048,
    ) -> str:
        key = self.get_effective_key(api_key)
        chosen_model = model or self.meta.get("default_model", "gemini-1.5-flash")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{chosen_model}:generateContent?key={key}"

        payload: Dict[str, Any] = {
            "contents": self._format_contents(messages),
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens
            }
        }
        if system_prompt:
            payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", **DEFAULT_REQUEST_HEADERS}
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    return "".join([p.get("text", "") for p in parts]).strip()
                return "No response generated by Gemini."
        except Exception as e:
            raise RuntimeError(normalize_provider_error(self.provider_id, e)) from e

    def stream_message(
        self,
        model: str,
        messages: List[Dict[str, str]],
        system_prompt: str = "",
        api_key: Optional[str] = None,
        temperature: float = 0.3,
    ) -> Generator[str, None, None]:
        try:
            key = self.get_effective_key(api_key)
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"
            return

        chosen_model = model or self.meta.get("default_model", "gemini-1.5-flash")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{chosen_model}:streamGenerateContent?alt=sse&key={key}"

        payload: Dict[str, Any] = {
            "contents": self._format_contents(messages),
            "generationConfig": {"temperature": temperature}
        }
        if system_prompt:
            payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", **DEFAULT_REQUEST_HEADERS}
        )
        try:
            with urllib.request.urlopen(req, timeout=90) as resp:
                for line in resp:
                    line_str = line.decode("utf-8").strip()
                    if not line_str or line_str.startswith(":"):
                        continue
                    if line_str.startswith("data: "):
                        data_part = line_str[6:]
                        try:
                            parsed = json.loads(data_part)
                            candidates = parsed.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                text = "".join(p.get("text", "") for p in parts)
                                if text:
                                    yield f"data: {json.dumps({'text': text})}\n\n"
                        except Exception:
                            continue
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': normalize_provider_error(self.provider_id, e)})}\n\n"
            yield "data: [DONE]\n\n"

    def validate_api_key(self, api_key: Optional[str] = None) -> Dict[str, Any]:
        key = resolve_api_key(self.provider_id, api_key)
        if not key:
            return {"valid": False, "message": "No Google Gemini API key provided or found."}
        url = f"https://generativelanguage.googleapis.com/v1beta/models?key={urllib.parse.quote(key)}"
        req = urllib.request.Request(url)
        try:
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status == 200:
                    return {
                        "valid": True,
                        "message": "Google Gemini API credentials successfully verified.",
                        "key_preview": mask_api_key(key)
                    }
        except Exception as e:
            return {"valid": False, "message": normalize_provider_error(self.provider_id, e)}
        return {"valid": False, "message": "Gemini validation failed."}

    def list_models(self, api_key: Optional[str] = None) -> List[Dict[str, Any]]:
        key = resolve_api_key(self.provider_id, api_key)
        if key:
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={urllib.parse.quote(key)}"
            req = urllib.request.Request(url)
            try:
                with urllib.request.urlopen(req, timeout=8) as resp:
                    payload = json.loads(resp.read().decode("utf-8"))
                    models = payload.get("models", [])
                    discovered = []
                    for item in models:
                        model_name = item.get("name", "").removeprefix("models/")
                        if "generateContent" in item.get("supportedGenerationMethods", []):
                            discovered.append({
                                "id": model_name,
                                "name": item.get("displayName") or model_name,
                                "context_window": item.get("inputTokenLimit") or 1000000
                            })
                    if discovered:
                        return discovered
            except Exception:
                pass
        return self.meta.get("models", [])

# ==============================================================================
# PROVIDER REGISTRY & PUBLIC SERVICE INTERFACES
# ==============================================================================

ADAPTER_REGISTRY: Dict[str, BaseLLMAdapter] = {
    "groq": GroqAdapter(),
    "openai": OpenAIAdapter(),
    "anthropic": AnthropicAdapter(),
    "gemini": GeminiAdapter(),
    "moonshot": MoonshotAdapter(),
    "openrouter": OpenRouterAdapter(),
}

def get_adapter(provider_id: str) -> BaseLLMAdapter:
    """Returns the adapter instance for the specified provider, falling back to Groq."""
    pid = (provider_id or "groq").lower()
    adapter = ADAPTER_REGISTRY.get(pid)
    if not adapter:
        adapter = ADAPTER_REGISTRY["groq"]
    return adapter

def get_provider_metadata_list(custom_keys: Optional[Dict[str, str]] = None) -> List[Dict[str, Any]]:
    """
    Returns the list of supported AI providers with server configuration status.
    Never returns secret keys to the client; only masked previews if configured.
    """
    custom_keys = custom_keys or {}
    providers = []
    for pid, pdata in PROVIDER_CATALOG.items():
        key = resolve_api_key(pid, custom_keys.get(pid))
        has_key = bool(key)
        providers.append({
            "id": pdata["id"],
            "name": pdata["name"],
            "description": pdata["description"],
            "has_server_key": bool(resolve_api_key(pid)),
            "is_configured": has_key,
            "key_preview": mask_api_key(key) if has_key else None,
            "default_model": pdata["default_model"],
            "models": pdata["models"]
        })
    return providers

def list_available_models(provider: str, custom_key: Optional[str] = None) -> List[Dict[str, Any]]:
    adapter = get_adapter(provider)
    return adapter.list_models(custom_key)

def validate_credentials(provider: str, custom_key: Optional[str] = None) -> Dict[str, Any]:
    adapter = get_adapter(provider)
    return adapter.validate_api_key(custom_key)

def execute_multi_provider_chat(
    provider: str,
    model: str,
    messages: List[Dict[str, str]],
    system_prompt: str = "",
    custom_key: Optional[str] = None,
    temperature: float = 0.3,
    max_tokens: int = 2048,
) -> str:
    adapter = get_adapter(provider)
    return adapter.send_message(
        model=model,
        messages=messages,
        system_prompt=system_prompt,
        api_key=custom_key,
        temperature=temperature,
        max_tokens=max_tokens,
    )

def stream_multi_provider_chat(
    provider: str,
    model: str,
    messages: List[Dict[str, str]],
    system_prompt: str = "",
    custom_key: Optional[str] = None,
    temperature: float = 0.3,
) -> Generator[str, None, None]:
    adapter = get_adapter(provider)
    return adapter.stream_message(
        model=model,
        messages=messages,
        system_prompt=system_prompt,
        api_key=custom_key,
        temperature=temperature,
    )
