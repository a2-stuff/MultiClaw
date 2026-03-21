"""Portainer plugin — deploys Portainer CE via Docker, managed by manifest."""


class Plugin:
    name = "portainer"
    description = "Portainer CE container management UI"

    def activate(self, config: dict) -> None:
        pass

    def deactivate(self) -> None:
        pass

    def get_skills(self) -> list:
        return []
