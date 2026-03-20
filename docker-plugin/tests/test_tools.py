import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_mock_proc(stdout: str = "", stderr: str = "", returncode: int = 0):
    proc = AsyncMock()
    proc.communicate = AsyncMock(return_value=(stdout.encode(), stderr.encode()))
    proc.returncode = returncode
    return proc


SAMPLE_CONTAINER = json.dumps({
    "ID": "abc123",
    "Image": "nginx:latest",
    "Names": "my-nginx",
    "Status": "running",
})

SAMPLE_IMAGE = json.dumps({
    "ID": "sha256:abc",
    "Repository": "nginx",
    "Tag": "latest",
    "Size": "142MB",
})

SAMPLE_STATS = json.dumps({
    "ID": "abc123",
    "Name": "my-nginx",
    "CPUPerc": "0.05%",
    "MemUsage": "10MiB / 2GiB",
})


# ---------------------------------------------------------------------------
# _parse_json_lines
# ---------------------------------------------------------------------------

def test_parse_json_lines_valid():
    from tools import _parse_json_lines
    line1 = json.dumps({"a": 1})
    line2 = json.dumps({"b": 2})
    result = _parse_json_lines(f"{line1}\n{line2}\n")
    assert result == [{"a": 1}, {"b": 2}]


def test_parse_json_lines_empty():
    from tools import _parse_json_lines
    assert _parse_json_lines("") == []


def test_parse_json_lines_skips_invalid():
    from tools import _parse_json_lines
    result = _parse_json_lines('{"ok": true}\nnot-json\n{"also": true}')
    assert result == [{"ok": True}, {"also": True}]


# ---------------------------------------------------------------------------
# docker_list_containers
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_docker_list_containers_success(mock_exec):
    from tools import docker_list_containers
    mock_exec.return_value = make_mock_proc(stdout=SAMPLE_CONTAINER)
    result = await docker_list_containers()
    assert isinstance(result, list)
    assert result[0]["ID"] == "abc123"
    args = mock_exec.call_args[0]
    assert args[0] == "docker"
    assert "ps" in args


@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_docker_list_containers_failure(mock_exec):
    from tools import docker_list_containers
    mock_exec.return_value = make_mock_proc(returncode=1, stderr="error")
    result = await docker_list_containers()
    assert result == []


# ---------------------------------------------------------------------------
# docker_run
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_docker_run_basic(mock_exec):
    from tools import docker_run
    mock_exec.return_value = make_mock_proc(stdout="container_id_xyz\n")
    result = await docker_run("nginx:latest")
    assert result["success"] is True
    assert result["container_id"] == "container_id_xyz"


@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_docker_run_with_all_options(mock_exec):
    from tools import docker_run
    mock_exec.return_value = make_mock_proc(stdout="cid123\n")
    result = await docker_run(
        image="nginx:latest",
        name="web",
        ports=["80:80", "443:443"],
        volumes=["/data:/data"],
        env=["FOO=bar"],
        detach=True,
        restart="always",
    )
    assert result["success"] is True
    args = mock_exec.call_args[0]
    assert "--name" in args
    assert "web" in args
    assert "-p" in args
    assert "80:80" in args
    assert "-v" in args
    assert "/data:/data" in args
    assert "-e" in args
    assert "FOO=bar" in args
    assert "--restart" in args
    assert "always" in args


@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_docker_run_failure(mock_exec):
    from tools import docker_run
    mock_exec.return_value = make_mock_proc(returncode=1, stderr="No such image")
    result = await docker_run("nonexistent:image")
    assert result["success"] is False
    assert "error" in result


# ---------------------------------------------------------------------------
# docker_stop
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_docker_stop_success(mock_exec):
    from tools import docker_stop
    mock_exec.return_value = make_mock_proc(stdout="abc123\n")
    result = await docker_stop("abc123")
    assert result["success"] is True
    assert "error" not in result


@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_docker_stop_failure(mock_exec):
    from tools import docker_stop
    mock_exec.return_value = make_mock_proc(returncode=1, stderr="No such container")
    result = await docker_stop("missing")
    assert result["success"] is False
    assert "error" in result


# ---------------------------------------------------------------------------
# docker_start
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_docker_start_success(mock_exec):
    from tools import docker_start
    mock_exec.return_value = make_mock_proc(stdout="abc123\n")
    result = await docker_start("abc123")
    assert result["success"] is True


@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_docker_start_failure(mock_exec):
    from tools import docker_start
    mock_exec.return_value = make_mock_proc(returncode=1, stderr="No such container")
    result = await docker_start("missing")
    assert result["success"] is False
    assert "error" in result


# ---------------------------------------------------------------------------
# docker_remove
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_docker_remove_success(mock_exec):
    from tools import docker_remove
    mock_exec.return_value = make_mock_proc(stdout="abc123\n")
    result = await docker_remove("abc123")
    assert result["success"] is True


@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_docker_remove_failure(mock_exec):
    from tools import docker_remove
    mock_exec.return_value = make_mock_proc(returncode=1, stderr="container still running")
    result = await docker_remove("abc123")
    assert result["success"] is False
    assert "error" in result


# ---------------------------------------------------------------------------
# docker_logs
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_docker_logs_success(mock_exec):
    from tools import docker_logs
    mock_exec.return_value = make_mock_proc(stdout="line1\nline2\n")
    result = await docker_logs("abc123")
    assert "logs" in result
    assert "line1" in result["logs"]
    args = mock_exec.call_args[0]
    assert "--tail" in args
    assert "100" in args


@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_docker_logs_custom_tail(mock_exec):
    from tools import docker_logs
    mock_exec.return_value = make_mock_proc(stdout="recent log\n")
    result = await docker_logs("abc123", tail=50)
    assert result["logs"] == "recent log\n"
    args = mock_exec.call_args[0]
    assert "50" in args


@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_docker_logs_failure(mock_exec):
    from tools import docker_logs
    mock_exec.return_value = make_mock_proc(returncode=1, stderr="No such container")
    result = await docker_logs("missing")
    assert "error" in result


# ---------------------------------------------------------------------------
# docker_pull
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_docker_pull_success(mock_exec):
    from tools import docker_pull
    mock_exec.return_value = make_mock_proc(stdout="Pulling from library/nginx\n")
    result = await docker_pull("nginx:latest")
    assert result["success"] is True
    assert "output" in result


@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_docker_pull_failure(mock_exec):
    from tools import docker_pull
    mock_exec.return_value = make_mock_proc(returncode=1, stderr="repository does not exist")
    result = await docker_pull("nonexistent/image:tag")
    assert result["success"] is False
    assert "error" in result
    assert "output" in result


# ---------------------------------------------------------------------------
# docker_images
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_docker_images_success(mock_exec):
    from tools import docker_images
    mock_exec.return_value = make_mock_proc(stdout=SAMPLE_IMAGE)
    result = await docker_images()
    assert isinstance(result, list)
    assert result[0]["Repository"] == "nginx"
    args = mock_exec.call_args[0]
    assert "images" in args


@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_docker_images_failure(mock_exec):
    from tools import docker_images
    mock_exec.return_value = make_mock_proc(returncode=1, stderr="error")
    result = await docker_images()
    assert result == []


# ---------------------------------------------------------------------------
# docker_stats
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_docker_stats_success(mock_exec):
    from tools import docker_stats
    mock_exec.return_value = make_mock_proc(stdout=SAMPLE_STATS)
    result = await docker_stats()
    assert isinstance(result, list)
    assert result[0]["Name"] == "my-nginx"
    args = mock_exec.call_args[0]
    assert "stats" in args
    assert "--no-stream" in args


@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_docker_stats_failure(mock_exec):
    from tools import docker_stats
    mock_exec.return_value = make_mock_proc(returncode=1, stderr="error")
    result = await docker_stats()
    assert result == []


@pytest.mark.asyncio
@patch("asyncio.create_subprocess_exec")
async def test_docker_stats_no_containers(mock_exec):
    from tools import docker_stats
    mock_exec.return_value = make_mock_proc(stdout="")
    result = await docker_stats()
    assert result == []
