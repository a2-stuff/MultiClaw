def run(context):
    name = context.get("name", "World")
    return {"greeting": f"Hello {name} from MultiClaw!"}
