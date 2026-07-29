<p align="center">
  <img src="MultiClaw_Icon.png" alt="MultiClaw" width="200" /><br />
  <img src="MultiClaw_GIF_Dashboard.gif" alt="MultiClaw" width="1200" />
</p>

# MultiClaw

**Plataforma distribuida de gestión de agentes de IA.** Ejecuta, gestiona y orquestra flotas de agentes de IA en tu infraestructura desde un único panel de control.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB.svg?logo=python&logoColor=white)](https://www.python.org/)
[![Node.js 20](https://img.shields.io/badge/Node.js-20-339933.svg?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![React 18](https://img.shields.io/badge/React-18-61dafb.svg?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**Proveedores de IA:**
[![Anthropic](https://img.shields.io/badge/Anthropic-Claude-d4a373.svg?logo=anthropic&logoColor=white)](https://www.anthropic.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991.svg?logo=openai&logoColor=white)](https://openai.com/)
[![Google Gemini](https://img.shields.io/badge/Google-Gemini-4285F4.svg?logo=googlegemini&logoColor=white)](https://deepmind.google/technologies/gemini/)
[![OpenRouter](https://img.shields.io/badge/OpenRouter-API-6366f1.svg)](https://openrouter.ai/)
[![DeepSeek](https://img.shields.io/badge/DeepSeek-V3%20%7C%20R1-0055ff.svg)](https://www.deepseek.com/)

**Plataformas:**
[![Ubuntu](https://img.shields.io/badge/Ubuntu-E95420.svg?logo=ubuntu&logoColor=white)](https://ubuntu.com/)
[![Debian](https://img.shields.io/badge/Debian-A81D33.svg?logo=debian&logoColor=white)](https://www.debian.org/)
[![Fedora](https://img.shields.io/badge/Fedora-51A2DA.svg?logo=fedora&logoColor=white)](https://fedoraproject.org/)
[![Arch Linux](https://img.shields.io/badge/Arch_Linux-1793D1.svg?logo=archlinux&logoColor=white)](https://archlinux.org/)
[![macOS](https://img.shields.io/badge/macOS-000000.svg?logo=apple&logoColor=white)](https://www.apple.com/macos/)
[![Windows](https://img.shields.io/badge/Windows-0078D4.svg?logo=windows&logoColor=white)](https://www.microsoft.com/windows/)

**Infraestructura:**
[![Docker](https://img.shields.io/badge/Docker-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com/)
[![Tailscale](https://img.shields.io/badge/Tailscale-242424.svg?logo=tailscale&logoColor=white)](https://tailscale.com/)
[![Let's Encrypt](https://img.shields.io/badge/Let's_Encrypt-003A70.svg?logo=letsencrypt&logoColor=white)](https://letsencrypt.org/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57.svg?logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Vite](https://img.shields.io/badge/Vite-646CFF.svg?logo=vite&logoColor=white)](https://vite.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-06B6D4.svg?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Express.js](https://img.shields.io/badge/Express.js-000000.svg?logo=express&logoColor=white)](https://expressjs.com/)
[![WebSocket](https://img.shields.io/badge/WebSocket-010101.svg?logo=socketdotio&logoColor=white)](#)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-C5F74F.svg?logo=drizzle&logoColor=black)](https://orm.drizzle.team/)

> GitHub: [a2-stuff/MultiClaw](https://github.com/a2-stuff/MultiClaw) — Twitter: [@not_jarod](https://twitter.com/not_jarod) & [@MultiClaw](https://twitter.com/MultiClaw)

---

## Descripción General

MultiClaw es una plataforma auto-alojada para gestionar flotas de agentes de IA. Un panel central en React se conecta a uno o más agentes de Python que se ejecutan en localhost o en máquinas remotas. Cada agente opera de forma independiente —con su propia identidad, habilidades, plugins, tareas cron y configuración— mientras que el panel te ofrece una visión unificada para asignar tareas, monitorear el estado, recibir respuestas en tiempo real, orquestar flujos de trabajo multi-agente y aplicar cambios de configuración en toda tu flota.

**Lo que puedes hacer con MultiClaw:**

- Asignar tareas mediante etiquetas `@mención` — escribe `@` para etiquetar agentes, o pregunta directamente al panel.
- Ejecutar tareas en paralelo a través de múltiples agentes con síntesis automática de resultados.
- Desplegar agentes locales aislados con un solo clic — cada uno obtiene su propio virtualenv, puerto y directorio de trabajo bajo `~/.multiclaw/agents/`.
- Registrar y gestionar agentes remotos ejecutándose en cualquier host de tu infraestructura.
- Dar a cada agente una identidad única con un prompt de sistema personalizado (soporta subida de archivos `.md`).
- Instalar habilidades desde el marketplace (proveedores ClawHub, SkillSSH) y desplegarlas por agente.
- Extender agentes con plugins basados en git — clonación, instalación y configuración automática con scripts de post-instalación.
- Programar tareas recurrentes en cualquier agente con tareas cron individuales.
- Construir flujos de trabajo multi-agente y delegar tareas entre ellos.
- Compartir estado y conocimiento entre agentes con un almacén de memoria común.
- Monitorear la salud del sistema (CPU, memoria, disco, red) de todos los agentes en tiempo real.
- Sincronizar claves y ajustes de proveedores de IA desde el panel a todos los agentes conectados a la vez.
- Gestionar usuarios con control de acceso basado en roles (RBAC) y un registro de auditoría completo.
- Networking seguro y sin configuración entre el panel y los agentes mediante Tailscale.

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS v4 |
| **Backend** | Express.js, SQLite, Drizzle ORM, SSE, WebSocket |
| **Agente** | Python 3.11+, FastAPI, uvicorn, pydantic-settings |
| **Proveedores IA** | Anthropic (Claude), OpenAI (GPT-4o), Google (Gemini), OpenRouter, DeepSeek |
| **Autenticación** | JWT (sesiones de panel), claves API HMAC (agentes), bcrypt |
| **Autorización** | Control de acceso basado en roles — `admin`, `operator`, `viewer` |
| **Seguridad** | Helmet CSP, limitación de tasa (rate limiting), validación de entrada, protección contra path traversal, logs de auditoría |
| **Networking** | Tailscale (opcional), gestión dinámica de orígenes CORS, HTTPS/TLS, Let's Encrypt / certbot |
| **CLI / TUI** | Python Click + Rich (`manage.py`), Rich TUI (`tui.py`) |

---

## Estructura del Proyecto

```
MultiClaw/
├── multi-claw-dashboard/     # Panel de control React + Express
│   ├── client/               # Frontend React (Vite + TailwindCSS)
│   ├── server/               # Backend Express + rutas de API
│   ├── drizzle/              # Esquema de base de datos y migraciones
│   └── data/                 # Base de datos SQLite
├── multi-claw-agent/         # Agente Python FastAPI
│   ├── src/                  # Código fuente del agente
│   ├── skills/               # Habilidades instaladas
│   ├── plugins/              # Plugins instalados
│   ├── cron_runs/            # Historial de ejecución de tareas cron
│   └── tests/                # Suite de pruebas
├── manage.py                 # Herramienta de gestión CLI
├── tui.py                    # TUI interactiva con Rich
├── install.sh                # Asistente de instalación interactivo
└── ~/.multiclaw/agents/      # Instancias de agentes locales desplegadas
```

---

## Inicio Rápido

### 1. Instalar el panel

```bash
git clone https://github.com/a2-stuff/MultiClaw.git
cd MultiClaw
./install.sh
```

El instalador es un asistente interactivo completo. Te solicitará:

- Puerto del panel
- Secreto JWT (se genera automáticamente si se deja en blanco)
- Email y contraseña del administrador (se generan automáticamente si se dejan en blanco)
- Orígenes CORS
- Claves API de proveedores de IA (Anthropic, OpenAI, Google, OpenRouter, DeepSeek)
- Integración con Tailscale (opcional)
- Configuración de certificados TLS / Let's Encrypt (opcional)

El usuario administrador se crea desde el `.env` en el primer inicio. El registro público está desactivado; los usuarios adicionales deben ser creados por un administrador desde la página de Usuarios.

### 2. Revisar tu entorno

```bash
# El instalador escribe el archivo .env por ti. Variables clave:
JWT_SECRET=<generado-automáticamente>
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<generado-automáticamente>
CORS_ORIGINS=http://localhost:5173
```

### 3. Instalar como servicio del sistema

```bash
python manage.py install -y
```

Esto registra el panel (y opcionalmente el agente local) como servicios de systemd con reinicio automático.

### 4. Abrir el panel

Navega a `http://localhost:<puerto>` (o `https://` si TLS está configurado). Inicia sesión con las credenciales de administrador de tu `.env`.

### 5. Generar una clave API

Ve a la página de **Keys** y crea una clave API. La necesitarás al conectar agentes adicionales.

### 6. Añadir un agente

**Desplegar un agente local** directamente desde el panel — un clic crea un agente aislado con su propio virtualenv, puerto y directorio bajo `~/.multiclaw/agents/`.

**O instalar un agente en un host remoto:**

```bash
./install.sh   # elige la opción Agent
```

El agente se conecta automáticamente al panel al iniciar usando la clave API que proporciones durante la configuración.

---

## CLI de Gestión

Todas las operaciones están disponibles a través de `manage.py`:

```bash
# Control de servicios
python manage.py start   [dashboard|agent|all]
python manage.py stop    [dashboard|agent|all]
python manage.py restart [dashboard|agent|all]

# Estado y gestión de flota
python manage.py status                  # mostrar salud de todos los servicios
python manage.py agents                  # listar todos los agentes registrados
python manage.py restart-agent <name>    # reiniciar un agente específico por nombre

# Logs
python manage.py logs [dashboard|agent]  # ver logs del servicio en tiempo real

# Ciclo de vida
python manage.py install                 # registrar servicios systemd
python manage.py uninstall               # eliminar servicios systemd
python manage.py update                  # git pull, reconstruir, reiniciar

# TUI Interactiva
python manage.py tui
```

### Rich TUI

La interfaz de terminal `tui.py` proporciona una experiencia de panel completa sin navegador — monitorea agentes, asigna tareas y visualiza logs directamente desde tu terminal.

```bash
python manage.py tui
# o directamente:
python tui.py
```

---

## Características del Panel

### Agentes

La página de Agentes es la vista principal de la flota. Cada tarjeta de agente muestra su nombre, host, proveedor, modelo y estado de salud en tiempo real. Desde la vista de detalle de un agente, tienes acceso a pestañas dedicadas:

- **Identity** — establece un prompt de sistema personalizado para el agente; sube un archivo `.md` para usarlo como prompt.
- **Logs** — visor de logs en tiempo real con filtrado por nivel y texto, y autorefresco.
- **Skills** — visualiza y gestiona las habilidades instaladas en este agente.
- **Plugins** — visualiza y gestiona los plugins instalados en este agente.
- **Tasks** — asigna tareas y visualiza el historial de tareas con opción de eliminar entradas.
- **Crons** — gestiona comandos recurrentes programados para este agente.
- **Settings** — configuración por agente (proveedor, modelo, puerto, etc.).

### Tareas y Asignación por @Mención

El sistema de asignación de tareas utiliza **etiquetado @mención** — escribe `@` en el prompt para desplegar un menú autocompletado estilo Slack que muestra todos los agentes con indicadores de estado en vivo. Los agentes etiquetados aparecen como etiquetas azules. El enrutamiento de la asignación es automático:

- **Sin agentes etiquetados** → El panel responde directamente usando su perfil de administrador integrado y acceso a la base de datos.
- **1 agente etiquetado** → Asignación directa a ese agente.
- **2+ agentes etiquetados** → Asignación paralela a todos los agentes simultáneamente, con una síntesis del panel que resume todos los resultados.

Las respuestas se transmiten en tiempo real vía SSE y WebSocket. Para la ejecución paralela, el resultado de cada agente aparece a medida que se completa, seguido de una tarjeta de **Dashboard Summary** unificada que sintetiza todas las respuestas. El historial completo de tareas se almacena y es consultable.

### Marketplace de Habilidades

Explora e instala habilidades desde el marketplace. Las habilidades son herramientas que el modelo de IA puede invocar durante una tarea. Se admiten dos proveedores:

- **ClawHub** — el registro de habilidades integrado de MultiClaw.
- **SkillSSH** — instala habilidades directamente desde repositorios accesibles vía SSH.

Las habilidades se despliegan por agente desde la interfaz del marketplace.

### Plugins

Los plugins extienden el tiempo de ejecución del agente con nuevos endpoints, integraciones y servicios en segundo plano. Consulta el registro completo de plugins y el estándar de manifiesto en **[PLUGINS.md](PLUGINS.md)**.

### Crons

Programa comandos recurrentes en cualquier agente usando expresiones cron estándar. El historial de ejecución se almacena y es visible por agente. Los resultados y cualquier salida se registran en `cron_runs/`.

### Plantillas

Las plantillas de agentes te permiten definir y reutilizar configuraciones predefinidas —proveedor, modelo, habilidades y ajustes base— para que puedas desplegar agentes consistentes sin repetir la configuración.

### Flujos de Trabajo (Workflows)

El constructor de flujos de trabajo te permite encadenar agentes en secuencias y grafos acíclicos dirigidos (DAGs) para una orquestación de múltiples pasos. Define el flujo de datos entre agentes y activa tuberías complejas desde una sola acción.

### Delegación

Los agentes pueden delegar subtareas a otros agentes. El sistema de delegación enruta las tareas entre agentes de forma transparente, permitiendo patrones de trabajo jerárquicos y paralelos sin coordinación manual.

### Memoria

Una base de conocimientos y memoria compartida se extiende a través de los agentes. Los agentes pueden leer y escribir en una memoria común, permitiendo un estado persistente, contexto acumulado y el intercambio de conocimientos en toda la flota.

### Sandbox

Un entorno de ejecución aislado (sandbox) para ejecutar código de agentes y plugins de forma segura, protegiendo el sistema host de efectos secundarios no deseados.

### Log de Auditoría

Un registro completo de todas las acciones realizadas en la plataforma —asignaciones de tareas, cambios de configuración, instalaciones de plugins, inicios de sesión de usuarios y más— para cumplimiento y depuración.

### Claves

Crea y gestiona claves API HMAC utilizadas por los agentes para autenticarse con el panel. Las claves pueden tener alcances específicos y ser revocadas en cualquier momento.

### Usuarios

Control de acceso basado en roles con tres niveles:

| Rol | Capacidades |
|---|---|
| `admin` | Acceso total — gestionar usuarios, claves, ajustes, todos los agentes |
| `operator` | Asignar tareas, gestionar agentes, instalar habilidades y plugins |
| `viewer` | Acceso de solo lectura a agentes, tareas y logs |

### Ajustes

- Configura las claves API de los proveedores de IA (Anthropic, OpenAI, Google, OpenRouter, DeepSeek).
- **Dashboard Profile** — personaliza la personalidad del administrador de IA del panel y visualiza el contexto en vivo auto-inyectado (lista de agentes, estados, capacidades).
- Envía ajustes a todos los agentes conectados simultáneamente (sincronización de configuración).
- Gestiona los orígenes CORS permitidos dinámicamente sin reiniciar el servidor.
- Configuración general del panel.

### Ayuda

Página de ayuda integrada con FAQ y guías que cubren escenarios comunes de configuración, resolución de problemas y recorridos por las funciones.

---

## Seguridad

MultiClaw está diseñado para entornos auto-alojados con una estrategia de defensa en profundidad, siendo apto tanto para redes privadas como para exposición a internet público:

- **Autenticación:** Tokens JWT para sesiones del panel; claves API firmadas con HMAC para la comunicación agente-panel; hashing de contraseñas con bcrypt. El registro público está desactivado; todas las cuentas son creadas por el administrador.
- **Autorización:** Control de acceso basado en roles (`admin`, `operator`, `viewer`) aplicado en todas las rutas de la API, incluyendo plugins, habilidades, tareas, sandbox y gestión de agentes.
- **Endurecimiento de entradas:** Límites de tamaño en el cuerpo de las solicitudes (1 MB JSON, 50 MB subidas); sanitización de nombres de archivo en subidas; protección contra path traversal en archivos ZIP; validación estricta de entradas en todos los endpoints.
- **Seguridad de transporte:** Política de Seguridad de Contenido (CSP) con directivas estrictas; X-Frame-Options: DENY; cabeceras Referrer-Policy; soporte HTTPS/TLS; orígenes CORS gestionados dinámicamente.
- **Seguridad SSE:** Intercambio de tickets de corta duración para Server-Sent Events — los tokens JWT nunca aparecen en los parámetros de consulta de la URL.
- **Limitación de tasa:** Aplicada a los endpoints de autenticación y todas las rutas sensibles de la API.
- **Aislamiento de agentes:** Los agentes desplegados se vinculan a `127.0.0.1` — accesibles solo a través del proxy autenticado del panel. Cada agente se ejecuta en su propio virtualenv con configuración aislada.
- **Log de auditoría:** Cada acción significativa es registrada con el actor, la marca de tiempo y el resultado.
- **Networking:** La integración opcional con Tailscale proporciona una red mesh cifrada entre el panel y los agentes remotos sin necesidad de configurar firewalls.

---

## Configuración de TLS

El asistente `install.sh` ofrece tres opciones de TLS:

1. **Skip** — configurar más tarde editando el `.env`.
2. **Existing certificates** — proporciona las rutas a tu `fullchain.pem` y `privkey.pem`.
3. **Let's Encrypt (certbot)** — emisión automatizada:
   - Instala certbot si no está presente (apt, dnf, pacman, o snap).
   - Ejecuta `certbot certonly --standalone` para tu dominio.
   - Opcionalmente configura la autorenovación vía cron (diariamente a las 3 AM).
   - Otorga permisos de archivo para el usuario del servicio.
   - Escribe `TLS_CERT` y `TLS_KEY` en el `.env` automáticamente.

**Requisitos para certbot:**
- Un nombre de dominio que apunte a la IP pública del servidor.
- Puerto 80 accesible (HTTP challenge).
- Ningún otro servicio vinculado al puerto 80 durante la emisión del certificado.

**Configuración manual (sin el instalador):**

```bash
sudo certbot certonly --standalone -d multiclaw.example.com
```

Luego añade al `.env` del panel:

```
TLS_CERT=/etc/letsencrypt/live/multiclaw.example.com/fullchain.pem
TLS_KEY=/etc/letsencrypt/live/multiclaw.example.com/privkey.pem
```

---

## Integración con Tailscale

Para agentes remotos, MultiClaw soporta Tailscale como una capa de networking opcional sin configuración. Cuando tanto el host del panel como el host del agente están en la misma red de Tailscale, los agentes se conectan a través de la IP de Tailscale — sin necesidad de redireccionamiento de puertos, reglas de firewall o configuración de VPN. El instalador te guía para activar esto durante la configuración.

---

## Comunicación en Tiempo Real

MultiClaw utiliza dos mecanismos de transporte en tiempo real en paralelo:

- **Server-Sent Events (SSE):** Utilizado para transmitir la salida de tareas y el seguimiento de logs del agente desde el panel. Bajo consumo de recursos, funciona a través de la mayoría de los proxies.
- **WebSocket:** Canal bidireccional para comunicación de menor latencia, actualizaciones de estado en vivo y características interactivas en toda la flota.

Ambos transportes están disponibles simultáneamente; el cliente utiliza el más apropiado para una operación determinada.

---

## Licencia

MIT — consulta el archivo [LICENSE](LICENSE) para más detalles.
