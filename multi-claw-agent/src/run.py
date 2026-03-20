import uvicorn
from src.config import settings

if __name__ == "__main__":
    kwargs = {
        "app": "src.main:app",
        "host": settings.host,
        "port": settings.port,
    }
    if settings.tls_cert and settings.tls_key:
        kwargs["ssl_certfile"] = settings.tls_cert
        kwargs["ssl_keyfile"] = settings.tls_key
    uvicorn.run(**kwargs)
