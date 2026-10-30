import unittest
import os
import sys
from unittest.mock import patch

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from app.llm.provider_manager import (
    PROVIDER_CATALOG,
    ADAPTER_REGISTRY,
    mask_api_key,
    resolve_api_key,
    get_provider_metadata_list,
    get_adapter,
    normalize_provider_error,
)
from app.llm.stage_services import (
    explain_problem_statement,
    generate_stage1_deliverable,
    explore_open_innovation,
)

class TestMultiProviderBYOK(unittest.TestCase):
    def test_provider_catalog_completeness(self):
        """Ensure all 6 required providers are defined with catalog models."""
        required_providers = ["groq", "openai", "anthropic", "gemini", "moonshot", "openrouter"]
        for p in required_providers:
            self.assertIn(p, PROVIDER_CATALOG, f"Provider {p} missing from PROVIDER_CATALOG")
            pdata = PROVIDER_CATALOG[p]
            self.assertTrue(pdata.get("name"), f"Provider {p} missing name")
            self.assertTrue(pdata.get("default_model"), f"Provider {p} missing default_model")
            self.assertTrue(len(pdata.get("models", [])) > 0, f"Provider {p} has empty models catalog")

    def test_adapter_registry(self):
        """Ensure adapter instances exist for all 6 target providers."""
        required_providers = ["groq", "openai", "anthropic", "gemini", "moonshot", "openrouter"]
        for p in required_providers:
            adapter = get_adapter(p)
            self.assertIsNotNone(adapter, f"No adapter found for {p}")
            self.assertEqual(adapter.provider_id, p)

    def test_api_key_masking_security(self):
        """Ensure API keys are securely masked and never revealed in plaintext."""
        self.assertIsNone(mask_api_key(None))
        self.assertIsNone(mask_api_key(""))
        
        # Test Groq key masking
        groq_key = "gsk_1234567890abcdef123456"
        masked = mask_api_key(groq_key)
        self.assertNotIn("1234567890abcdef", masked)
        self.assertTrue(masked.startswith("gsk_"))
        self.assertTrue(masked.endswith("3456"))
        self.assertIn("••••••••", masked)

        # Test OpenAI key masking
        openai_key = "sk-proj-9876543210zyxwvutsrqponmlkjihgfedcba"
        masked_oai = mask_api_key(openai_key)
        self.assertNotIn("zyxwvutsrqpon", masked_oai)
        self.assertTrue(masked_oai.startswith("sk-p"))

    def test_provider_metadata_safe_serialization(self):
        """Ensure get_provider_metadata_list never exposes unmasked secret keys."""
        meta_list = get_provider_metadata_list({"groq": "gsk_test1234567890abc"})
        for item in meta_list:
            self.assertIn("id", item)
            self.assertIn("name", item)
            self.assertIn("is_configured", item)
            for k, v in item.items():
                if isinstance(v, str):
                    self.assertNotIn("gsk_test1234567890abc", v)

    def test_key_resolution_priority(self):
        """Ensure caller-provided session key overrides server environment key."""
        custom_key = "sk-custom-session-key-123456"
        resolved = resolve_api_key("openai", custom_key=custom_key)
        self.assertEqual(resolved, custom_key)

    def test_validation_missing_key(self):
        """Ensure validating with empty key returns clean invalid status."""
        adapter = get_adapter("anthropic")
        result = adapter.validate_api_key("")
        self.assertFalse(result.get("valid"))
        self.assertIn("No Anthropic API key provided", result.get("message"))

    @patch("app.llm.provider_manager.execute_multi_provider_chat")
    def test_stage1_deliverable_tools_support(self, mock_chat):
        """Ensure generate_stage1_deliverable correctly dispatches all 10 contextual tools."""
        supported_tools = [
            "research",
            "solution_comparison",
            "usp_generation",
            "architecture",
            "workflows",
            "tech_stack",
            "implementation_plan",
            "db_api_design",
            "ppt_content",
            "pitch_prep",
        ]
        
        mock_chat.return_value = '{"title": "Mock Output", "status": "ok"}'

        for tool in supported_tools:
            res = generate_stage1_deliverable(
                deliverable_type=tool,
                context="Test hackathon problem statement context",
                provider="groq"
            )
            self.assertIsInstance(res, dict, f"Tool {tool} did not return a dictionary")
            self.assertEqual(res.get("title"), "Mock Output")

    @patch("app.llm.provider_manager.execute_multi_provider_chat")
    def test_explain_problem_statement_structure(self, mock_chat):
        """Ensure explain_problem_statement produces the required structured breakdown."""
        mock_chat.return_value = '''{
            "title": "AI Codebase Verifier",
            "overview": "Automated code compliance evaluator",
            "actual_problem": "Judging hackathon repos manually is slow and error prone",
            "target_users": ["Hackathon Organizers", "Participants"],
            "requirements": ["Static verification", "BYOK multi-model chat"],
            "constraints": ["Sub-second latency", "Secret redaction"],
            "expected_outcomes": ["Zero missed requirements"],
            "important_terms": ["AST", "Vector DB"],
            "markdown_content": "## 🎯 Problem Overview\\nAutomated code compliance evaluator"
        }'''

        res = explain_problem_statement("Problem statement text", provider="groq")
        self.assertEqual(res["title"], "AI Codebase Verifier")
        self.assertIn("overview", res)
        self.assertIn("actual_problem", res)
        self.assertIn("requirements", res)
        self.assertIn("constraints", res)
        self.assertIn("markdown_content", res)

if __name__ == "__main__":
    unittest.main()
