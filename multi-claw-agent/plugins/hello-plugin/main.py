"""Hello world plugin — used for testing plugin install/remove flows."""


class Plugin:
    name = "hello-plugin"
    description = "Hello world plugin for testing"

    def activate(self, config: dict) -> None:
        print("Hello plugin activated!")

    def deactivate(self) -> None:
        pass

    def get_skills(self) -> list:
        return [
            {
                "name": "say_hello",
                "description": "Says hello",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "name": {"type": "string", "description": "Name to greet"}
                    },
                    "required": []
                }
            }
        ]

    def run_skill(self, skill_name: str, parameters: dict) -> str:
        if skill_name == "say_hello":
            name = parameters.get("name", "world")
            return f"Hello, {name}!"
        raise ValueError(f"Unknown skill: {skill_name}")
