"""Docker plugin — installs Docker CE via manifest post-install steps."""


class Plugin:
    name = "docker"
    description = "Docker CE installation and management"

    def activate(self, config: dict) -> None:
        pass

    def deactivate(self) -> None:
        pass

    def get_skills(self) -> list:
        return []
