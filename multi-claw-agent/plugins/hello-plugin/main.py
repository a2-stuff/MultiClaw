class Plugin:
    name = "hello-plugin"
    description = "A hello world plugin"
    def activate(self, ctx):
        self.active = True
        print("Hello plugin activated!")
    def deactivate(self):
        self.active = False
    def get_tools(self):
        return [{"name": "say_hello", "description": "Says hello"}]
