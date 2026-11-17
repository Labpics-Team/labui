"""Exercise the packaged Linux app through AT-SPI and observe Orca speech output.

Run only inside the CI's private D-Bus/Xvfb session, after installing the DEB.
The installed launcher must provide GNOME accessibility without test-side JVM
options, classpath changes, or native library search paths.
"""

from pathlib import Path
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time

if sys.platform != "linux" or os.environ.get("GITHUB_ACTIONS") != "true":
    raise SystemExit("Linux accessibility interaction runs only in isolated GitHub CI")

import pyatspi
from gi.repository import GLib


consumer = Path(__file__).resolve().parents[1] / "consumer"
packages = list((consumer / "build/compose/binaries/main/deb").glob("*.deb"))
assert len(packages) == 1, f"Expected one DEB, found {packages}"
package = packages[0]
package_name = subprocess.check_output(["dpkg-deb", "--field", str(package), "Package"], text=True).strip()
package_version = subprocess.check_output(["dpkg-deb", "--field", str(package), "Version"], text=True).strip()
installed_version = subprocess.check_output(
    ["dpkg-query", "--show", "--showformat=${Version}", package_name], text=True,
).strip()
assert installed_version == package_version, "Install the current DEB before verification"
dependencies = subprocess.check_output(["dpkg-deb", "--field", str(package), "Depends"], text=True).strip()
assert re.search(r"(?:^|,)\s*libatk-wrapper-java-jni(?:\s|,|$)", dependencies), (
    f"The DEB must install its GNOME accessibility bridge: {dependencies}"
)
installed_files = subprocess.check_output(["dpkg-query", "--listfiles", package_name], text=True).splitlines()
launchers = [Path(name) for name in installed_files if name.endswith("/bin/LabUI")]
assert len(launchers) == 1 and launchers[0].is_file(), "Install the built DEB before verification"
executable = launchers[0]
evidence = consumer / "build/linux-accessibility"
evidence.mkdir(parents=True, exist_ok=True)
with package.open("rb") as archive:
    package_sha256 = hashlib.file_digest(archive, "sha256").hexdigest()
(evidence / "installation.json").write_text(json.dumps({
    "package": package_name, "version": installed_version,
    "sha256": package_sha256,
    "dependencies": dependencies, "launcher": str(executable),
    "jvm_environment_injection": False,
}, indent=2))
orca_debug = evidence / "orca-debug.txt"
events = []
processes = []
logs = []


def pump():
    context = GLib.MainContext.default()
    while context.pending():
        context.iteration(False)


def await_result(description, check, timeout=15):
    deadline = time.monotonic() + timeout
    last_error = None
    while time.monotonic() < deadline:
        pump()
        try:
            result = check()
            if result is not None and result is not False:
                return result
        except Exception as error:
            last_error = error
        time.sleep(0.05)
    raise AssertionError(f"{description}: {last_error or 'timed out'}")


def tree(node=None):
    if node is None:
        node = pyatspi.Registry.getDesktop(0)
    result = [node]
    for index in range(node.childCount):
        child = node.getChildAtIndex(index)
        if child is not None:
            result.extend(tree(child))
    return result


def find(name, role=None):
    return await_result(
        f"AT-SPI node {name!r}",
        lambda: next(
            (node for node in tree()
             if node.name == name and (role is None or node.getRole() == role)),
            None,
        ),
    )


def click(name):
    node = find(name)
    action = node.queryAction()
    assert action.nActions > 0 and action.doAction(0), f"No AT-SPI action: {name}"


def focus(name):
    node = find(name)
    assert node.queryComponent().grabFocus(), f"No AT-SPI focus action: {name}"
    await_result(f"Focus {name}", lambda: node.getState().contains(pyatspi.STATE_FOCUSED))
    return node


def await_focus(name):
    return await_result(
        f"Focus restored to {name}",
        lambda: find(name).getState().contains(pyatspi.STATE_FOCUSED),
    )


def edit(name, value):
    node = find(name)
    assert node.queryEditableText().setTextContents(value), f"No AT-SPI editable text: {name}"
    await_result(f"Text accepted by {name}", lambda: node.queryText().getText(0, -1) == value)


def speech_contains(text, start=0):
    if not orca_debug.exists():
        return False
    return any(
        "SPEECH OUTPUT:" in line and text in line
        for line in orca_debug.read_text(errors="replace")[start:].splitlines()
    )


def start(command, name, environment):
    output = (evidence / f"{name}.log").open("w")
    logs.append(output)
    process = subprocess.Popen(command, cwd=consumer, env=environment,
                               stdout=output, stderr=subprocess.STDOUT)
    processes.append(process)
    return process


def stop(process):
    if process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


def record(event):
    try:
        events.append({"type": event.type, "name": event.source.name,
                       "detail1": event.detail1, "detail2": event.detail2})
    except Exception:
        pass  # A defunct node's final event must not stop the external listener.


pyatspi.Registry.registerEventListener(record, "object:state-changed:focused",
                                      "object:text-changed", "object:children-changed")
try:
    with tempfile.TemporaryDirectory(prefix="labui-atspi-") as directory:
        environment = {**os.environ, "LABUI_DATA_DIR": str(Path(directory) / "data"),
                       "XDG_CONFIG_HOME": str(Path(directory) / "config"),
                       "XDG_DATA_HOME": str(Path(directory) / "share"),
                       "XDG_CACHE_HOME": str(Path(directory) / "cache"),
                       "SKIKO_RENDER_API": "SOFTWARE"}
        environment.pop("NO_AT_BRIDGE", None)
        # An inherited CI setting must not make an incomplete launcher pass.
        for name in ("JAVA_TOOL_OPTIONS", "JDK_JAVA_OPTIONS", "_JAVA_OPTIONS", "LD_LIBRARY_PATH", "CLASSPATH"):
            environment.pop(name, None)
        start(["openbox"], "window-manager", environment)
        subprocess.run(["gsettings", "set", "org.gnome.desktop.a11y.applications",
                        "screen-reader-enabled", "true"], env=environment, check=True)
        orca = start(["orca", "--replace", f"--debug-file={orca_debug}"], "orca", environment)
        # Orca's file log is buffered (128 KiB on newer Python). Its D-Bus
        # service starts after the event manager; a file substring is not readiness.
        def orca_ready():
            assert orca.poll() is None, "Orca exited before its service became available"
            result = subprocess.run([
                "gdbus", "call", "--session", "--dest", "org.gnome.Orca.Service",
                "--object-path", "/org/gnome/Orca/Service",
                "--method", "org.gnome.Orca.Service.GetVersion",
            ], env=environment, text=True, capture_output=True, timeout=3)
            (evidence / "orca-readiness.txt").write_text(result.stdout + result.stderr)
            return result.returncode == 0
        await_result("Orca serves accessibility requests", orca_ready)

        app = start([str(executable)], "application", environment)
        find("Редактировать", pyatspi.ROLE_PUSH_BUTTON)
        focus("Редактировать")

        click("Редактировать")
        await_focus("Закрыть")
        focus("Название")
        edit("Название", "Несохранённое имя")
        click("Отмена")
        await_focus("Редактировать")

        click("Редактировать")
        assert find("Название").queryText().getText(0, -1) != "Несохранённое имя"
        edit("Название", "")
        click("Сохранить")
        find("Введите название")
        edit("Название", "Доступная лаборатория")
        edit("Описание", "Сохранено через AT-SPI")
        click("Сохранить")
        find("Изменения сохранены")
        await_focus("Редактировать")
        find("Доступная лаборатория")

        stop(app)
        app = start([str(executable)], "application-restart", environment)
        find("Доступная лаборатория")
        click("Редактировать")
        assert find("Название").queryText().getText(0, -1) == "Доступная лаборатория"
        assert find("Описание").queryText().getText(0, -1) == "Сохранено через AT-SPI"
        click("Отмена")
        await_focus("Редактировать")
        assert any(event["type"].startswith("object:text-changed") for event in events)
        assert any(event["type"] == "object:state-changed:focused" and event["detail1"]
                   for event in events)
        # Graceful shutdown flushes the real speech log. No test-side announcements
        # are injected: these must have been generated by the app's focus events.
        stop(orca)
        assert speech_contains("Редактировать"), "Orca did not announce the edit action"
        assert speech_contains("Название"), "Orca did not announce the input label"
        print("LINUX_ATSPI_ORCA_PASS: installed DEB and launcher, external edit/cancel/validation/save/restart, "
              "focus/text events and Orca action/field speech")
finally:
    try:
        snapshot = [{"name": node.name, "role": node.getRoleName()} for node in tree()]
        (evidence / "tree.json").write_text(json.dumps(snapshot, ensure_ascii=False, indent=2))
    finally:
        (evidence / "events.json").write_text(json.dumps(events, ensure_ascii=False, indent=2))
        for process in reversed(processes):
            stop(process)
        for output in logs:
            output.close()
