import os
import json
import urllib.request
import urllib.error
from typing import List, Dict, Any, Optional, Iterator, Generator

# Built-in catalog of standard models per provider (updated dynamically when API credentials are provided)
PROVIDER_CATALOG = {
    "groq": {
        "id": "groq",
        "name": "Groq",
        "description": "Ultra-fast LPU inference hosting open models",
        "key_env_var": "GROQ_API_KEY",
        "default_model": "llama-3.3-70b-versatile",
        "models": [
            {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B Versatile", "context_window": 128000},
            {"id": "llama-3.1-8b-instant", "name": "Llama 3.1 8B Instant", "context_window": 128000},
            {"id": "mixtral-8x7b-32768", "name": "Mixtral 8x7B", "context_window": 32768},
            {"id": "gemma2-9b-it", "name": "Gemma 2 9B IT", "context_window": 8192},
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
            {"id": "gpt-4o-mini", "name": "GPT-4o Mini (Fast & Cost Efficient)", "context_window": 128000},
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
        "description": "Long context window models from Google DeepMind",
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
        "description": "Large context models optimized for document intelligence",
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

def resolve_api_key(provider: str, custom_key: Optional[str] = None) -> Optional[str]:
    """
    Resolves the API key for a provider. Prioritizes the caller's session-specific custom key,
    falling back to server environment variables if configured.
    """
    if custom_key and custom_key.strip():
        return custom_key.strip()
    
    provider_info = PROVIDER_CATALOG.get(provider.lower())
    if provider_info and provider_info.get("key_env_var"):
        env_key = os.getenv(provider_info["key_env_var"])
        if env_key and env_key.strip():
            return env_key.strip()
            
    # Also check generic GROQ_API_KEY if provider is groq
    if provider.lower() == "groq":
        return os.getenv("GROQ_API_KEY")
    return None

def get_provider_metadata_list() -> List[Dict[str, Any]]:
    """
    Returns available providers with server configuration status.
    Never returns secret keys to client.
    """
    providers = []
    for pid, pdata in PROVIDER_CATALOG.items():
        has_server_key = bool(resolve_api_key(pid))
        providers.append({
            "id": pdata["id"],
            "name": pdata["name"],
            "description": pdata["description"],
            "has_server_key": has_server_key,
            "default_model": pdata["default_model"],
            "models": pdata["models"]
        })
    return providers

def list_available_models(provider: str, custom_key: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Returns the supported models for a provider. If a valid key is provided, attempts
    to query dynamic model lists for OpenAI/OpenRouter/Groq where appropriate.
    """
    pid = provider.lower()
    pdata = PROVIDER_CATALOG.get(pid)
    if not pdata:
        return []
    
    # Return known models catalogue
    return pdata["models"]

def validate_credentials(provider: str, custom_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Validates credentials by pinging the provider's API.
    """
    pid = provider.lower()
    api_key = resolve_api_key(pid, custom_key)
    
    if not api_key:
        return {
            "valid": False,
            "message": f"No API key provided or found in server environment for {provider}."
        }

    try:
        if pid == "groq":
            req = urllib.request.Request(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": f"Bearer {api_key}"}
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode())
                    available_ids = [m["id"] for m in data.get("data", [])]
                    return {
                        "valid": True,
                        "message": "Groq credentials successfully verified.",
                        "available_models": available_ids[:15]
                    }

        elif pid == "openai":
            req = urllib.request.Request(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {api_key}"}
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status == 200:
                    return {"valid": True, "message": "OpenAI API credentials successfully verified."}

        elif pid == "anthropic":
            # Quick lightweight test call to Anthropic messages
            test_body = json.dumps({
                "model": "claude-3-5-haiku-20241022",
                "max_tokens": 1,
                "messages": [{"role": "user", "content": "ping"}]
            }).encode()
            req = urllib.request.Request(
                "https://api.anthropic.com/v1/messages",
                data=test_body,
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                }
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status in (200, 201):
                    return {"valid": True, "message": "Anthropic API credentials successfully verified."}

        elif pid == "gemini":
            # Test Gemini API key via models endpoint
            url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status == 200:
                    return {"valid": True, "message": "Google Gemini API credentials successfully verified."}

        elif pid == "moonshot":
            req = urllib.request.Request(
                "https://api.moonshot.cn/v1/models",
                headers={"Authorization": f"Bearer {api_key}"}
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status == 200:
                    return {"valid": True, "message": "Moonshot AI credentials successfully verified."}

        elif pid == "openrouter":
            req = urllib.request.Request(
                "https://openrouter.ai/api/v1/models",
                headers={"Authorization": f"Bearer {api_key}"}
            )
            with urllib.request.urlopen(req, timeout=8) as resp:
                if resp.status == 200:
                    return {"valid": True, "message": "OpenRouter API credentials successfully verified."}

        return {"valid": False, "message": f"Unsupported provider: {provider}"}

    except urllib.error.HTTPError as e:
        status_code = e.code
        err_msg = f"HTTP {status_code}"
        try:
            body = json.loads(e.read().decode())
            if "error" in body and isinstance(body["error"], dict):
                err_msg = body["error"].get("message", err_msg)
            elif "message" in body:
                err_msg = body["message"]
        except Exception:
            pass
        return {"valid": False, "message": f"Authentication failed ({err_msg})"}
    except Exception as e:
        return {"valid": False, "message": f"Connection error: {str(e)}"}


def execute_multi_provider_chat(
    provider: str,
    model: str,
    messages: List[Dict[str, str]],
    system_prompt: str = "",
    custom_key: Optional[str] = None,
    temperature: float = 0.3,
    max_tokens: int = 2048,
) -> str:
    """
    Executes a chat completion across any supported provider with unified schema.
    Returns the complete assistant response text.
    """
    pid = provider.lower() if provider else "groq"
    api_key = resolve_api_key(pid, custom_key)
    
    if not api_key:
        raise ValueError(
            f"No API key configured for {pid.upper()}. Please provide your key in Settings or check server configuration."
        )

    # 1. ANTHROPIC (Claude)
    if pid == "anthropic":
        anthropic_messages = []
        for m in messages:
            anthropic_messages.append({
                "role": "user" if m.get("role") == "user" else "assistant",
                "content": m.get("content", "")
            })
        
        payload: Dict[str, Any] = {
            "model": model or "claude-3-5-sonnet-20241022",
            "max_tokens": max_tokens,
            "messages": anthropic_messages,
            "temperature": temperature,
        }
        if system_prompt:
            payload["system"] = system_prompt

        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            }
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                contents = data.get("content", [])
                text_parts = [c.get("text", "") for c in contents if c.get("type") == "text"]
                return "".join(text_parts).strip()
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"Anthropic API error (HTTP {e.code}): {err_body}")

    # 2. GOOGLE GEMINI (Direct REST API)
    elif pid == "gemini":
        gemini_model = model or "gemini-1.5-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={api_key}"
        
        contents = []
        for m in messages:
            role = "user" if m.get("role") == "user" else "model"
            contents.append({
                "role": role,
                "parts": [{"text": m.get("content", "")}]
            })
            
        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens
            }
        }
        if system_prompt:
            payload["systemInstruction"] = {
                "parts": [{"text": system_prompt}]
            }

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    return "".join([p.get("text", "") for p in parts]).strip()
                return "No response generated by Gemini."
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"Gemini API error (HTTP {e.code}): {err_body}")

    # 3. OPENAI-COMPATIBLE ENDPOINTS (Groq, OpenAI, Moonshot, OpenRouter)
    else:
        endpoint_map = {
            "groq": "https://api.groq.com/openai/v1/chat/completions",
            "openai": "https://api.openai.com/v1/chat/completions",
            "moonshot": "https://api.moonshot.cn/v1/chat/completions",
            "openrouter": "https://openrouter.ai/api/v1/chat/completions",
        }
        endpoint = endpoint_map.get(pid, "https://api.groq.com/openai/v1/chat/completions")
        
        chat_messages = []
        if system_prompt:
            chat_messages.append({"role": "system", "content": system_prompt})
        for m in messages:
            chat_messages.append({
                "role": m.get("role", "user"),
                "content": m.get("content", "")
            })

        chosen_model = model or PROVIDER_CATALOG.get(pid, {}).get("default_model", "openai/gpt-oss-120b")
        payload = {
            "model": chosen_model,
            "messages": chat_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        if pid == "openrouter":
            headers["HTTP-Referer"] = "https://devlens.ai"
            headers["X-Title"] = "DevLens AI"

        req = urllib.request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                choices = data.get("choices", [])
                if choices:
                    return choices[0].get("message", {}).get("content", "").strip()
                return "Empty response received from model."
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"{pid.upper()} API error (HTTP {e.code}): {err_body}")


def stream_multi_provider_chat(
    provider: str,
    model: str,
    messages: List[Dict[str, str]],
    system_prompt: str = "",
    custom_key: Optional[str] = None,
    temperature: float = 0.3,
) -> Generator[str, None, None]:
    """
    Streams SSE formatted chunks from any supported provider for real-time typewriter effect.
    Yields chunks formatted as `data: {"text": "..."}\n\n` followed by `data: [DONE]\n\n`.
    """
    pid = provider.lower() if provider else "groq"
    api_key = resolve_api_key(pid, custom_key)
    
    if not api_key:
        yield f"data: {json.dumps({'error': f'No API key configured for {pid.upper()}.'})}\n\n"
        yield "data: [DONE]\n\n"
        return

    # OpenAI-compatible streaming endpoints (Groq, OpenAI, Moonshot, OpenRouter)
    if pid in ("groq", "openai", "moonshot", "openrouter"):
        endpoint_map = {
            "groq": "https://api.groq.com/openai/v1/chat/completions",
            "openai": "https://api.openai.com/v1/chat/completions",
            "moonshot": "https://api.moonshot.cn/v1/chat/completions",
            "openrouter": "https://openrouter.ai/api/v1/chat/completions",
        }
        endpoint = endpoint_map.get(pid, endpoint_map["groq"])
        
        chat_messages = []
        if system_prompt:
            chat_messages.append({"role": "system", "content": system_prompt})
        for m in messages:
            chat_messages.append({"role": m.get("role", "user"), "content": m.get("content", "")})

        chosen_model = model or PROVIDER_CATALOG.get(pid, {}).get("default_model", "openai/gpt-oss-120b")
        payload = {
            "model": chosen_model,
            "messages": chat_messages,
            "temperature": temperature,
            "stream": True,
        }

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        if pid == "openrouter":
            headers["HTTP-Referer"] = "https://devlens.ai"
            headers["X-Title"] = "DevLens AI"

        req = urllib.request.Request(endpoint, data=json.dumps(payload).encode("utf-8"), headers=headers)
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
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"

    else:
        # Fallback to non-streaming execution and emit chunks
        try:
            full_reply = execute_multi_provider_chat(
                provider=pid,
                model=model,
                messages=messages,
                system_prompt=system_prompt,
                custom_key=custom_key,
                temperature=temperature
            )
            # Emit in readable token chunks
            words = full_reply.split(" ")
            chunk = []
            for w in words:
                chunk.append(w)
                if len(chunk) >= 4:
                    yield f"data: {json.dumps({'text': ' '.join(chunk) + ' '})}\n\n"
                    chunk = []
            if chunk:
                yield f"data: {json.dumps({'text': ' '.join(chunk)})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"
