def test_provider_registry_lists_providers():
    from src.agent.providers import ProviderRegistry
    registry = ProviderRegistry()
    providers = registry.list_providers()
    assert "anthropic" in providers
    assert "openai" in providers
    assert "gemini" in providers
    assert "openrouter" in providers
    assert "deepseek" in providers

def test_provider_registry_get_default():
    from src.agent.providers import ProviderRegistry
    registry = ProviderRegistry()
    provider = registry.get("anthropic")
    assert provider is not None
    assert provider.name == "anthropic"

def test_provider_registry_models():
    from src.agent.providers import ProviderRegistry
    registry = ProviderRegistry()
    models = registry.list_models()
    assert any(m["provider"] == "anthropic" for m in models)
    assert any(m["provider"] == "openai" for m in models)
    assert any(m["provider"] == "gemini" for m in models)
    assert any(m["provider"] == "deepseek" for m in models)

def test_provider_not_configured():
    from src.agent.providers import ProviderRegistry
    registry = ProviderRegistry()
    assert registry.list_configured() == []

def test_provider_configure():
    from src.agent.providers import ProviderRegistry
    registry = ProviderRegistry()
    registry.get("anthropic").configure("test-key")
    assert "anthropic" in registry.list_configured()
