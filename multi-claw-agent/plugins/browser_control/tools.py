# plugins/browser_control/tools.py
from plugins.browser_control.engine import PlaywrightEngine


def build_tools(engine: PlaywrightEngine, config: dict) -> list[dict]:
    async def navigate(url: str) -> dict:
        await engine.ensure_started()
        return await engine.navigate(url)

    async def click(selector: str) -> dict:
        await engine.ensure_started()
        return await engine.click(selector)

    async def fill(selector: str, value: str) -> dict:
        await engine.ensure_started()
        return await engine.fill(selector, value)

    async def submit_form(selector: str) -> dict:
        await engine.ensure_started()
        return await engine.submit_form(selector)

    async def screenshot(full_page: bool = False) -> dict:
        await engine.ensure_started()
        return await engine.screenshot(full_page)

    async def get_text(selector: str) -> dict:
        await engine.ensure_started()
        return await engine.get_text(selector)

    async def get_page_content(format: str = "text") -> dict:
        await engine.ensure_started()
        return await engine.get_page_content(format)

    async def execute_js(script: str) -> dict:
        await engine.ensure_started()
        return await engine.execute_js(script)

    async def wait_for(selector: str, timeout: int = 30000) -> dict:
        await engine.ensure_started()
        return await engine.wait_for(selector, timeout)

    async def select_option(selector: str, value: str) -> dict:
        await engine.ensure_started()
        return await engine.select_option(selector, value)

    async def go_back() -> dict:
        await engine.ensure_started()
        return await engine.go_back()

    async def new_tab(url: str = "") -> dict:
        await engine.ensure_started()
        return await engine.new_tab(url)

    async def close_tab() -> dict:
        await engine.ensure_started()
        return await engine.close_tab()

    async def list_tabs() -> dict:
        await engine.ensure_started()
        return await engine.list_tabs()

    async def switch_tab(index: int) -> dict:
        await engine.ensure_started()
        return await engine.switch_tab(index)

    async def hover(selector: str) -> dict:
        await engine.ensure_started()
        return await engine.hover(selector)

    async def press_key(key: str) -> dict:
        await engine.ensure_started()
        return await engine.press_key(key)

    async def scroll(direction: str = "down", amount: int = 500) -> dict:
        await engine.ensure_started()
        return await engine.scroll(direction, amount)

    async def get_url() -> dict:
        await engine.ensure_started()
        return await engine.get_url()

    tools = [
        {"name": "browser_navigate", "description": "Navigate to a URL", "handler": navigate},
        {"name": "browser_click", "description": "Click an element by CSS selector", "handler": click},
        {"name": "browser_fill", "description": "Fill an input field with a value", "handler": fill},
        {"name": "browser_submit_form", "description": "Submit a form (by form or button selector)", "handler": submit_form},
        {"name": "browser_screenshot", "description": "Take a screenshot of the current page", "handler": screenshot},
        {"name": "browser_get_text", "description": "Get text content of an element", "handler": get_text},
        {"name": "browser_get_page_content", "description": "Get full page content as text or HTML", "handler": get_page_content},
        {"name": "browser_wait_for", "description": "Wait for an element to appear on the page", "handler": wait_for},
        {"name": "browser_select_option", "description": "Select an option from a dropdown", "handler": select_option},
        {"name": "browser_go_back", "description": "Navigate back in browser history", "handler": go_back},
        {"name": "browser_new_tab", "description": "Open a new browser tab, optionally with a URL", "handler": new_tab},
        {"name": "browser_close_tab", "description": "Close the current browser tab", "handler": close_tab},
        {"name": "browser_list_tabs", "description": "List all open tabs with URLs and titles", "handler": list_tabs},
        {"name": "browser_switch_tab", "description": "Switch to a specific tab by index", "handler": switch_tab},
        {"name": "browser_hover", "description": "Hover over an element by CSS selector", "handler": hover},
        {"name": "browser_press_key", "description": "Press a keyboard key or combo (e.g., Enter, Escape, Control+a)", "handler": press_key},
        {"name": "browser_scroll", "description": "Scroll the page up or down by pixel amount", "handler": scroll},
        {"name": "browser_get_url", "description": "Get the current page URL and title", "handler": get_url},
    ]

    if config.get("allow_js_execution", False):
        tools.append({
            "name": "browser_execute_js",
            "description": "Execute JavaScript on the current page (opt-in, logged)",
            "handler": execute_js,
        })

    return tools
