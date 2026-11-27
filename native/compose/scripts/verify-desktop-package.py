"""Exercise the application image using its bundled JVM and native libraries."""

from pathlib import Path
import os
import subprocess
import sys
import tempfile


consumer = Path(__file__).resolve().parents[1] / "consumer"
images = consumer / "build/compose/binaries/main/app"
if sys.platform == "win32":
    executable = images / "LabUI/LabUI.exe"
    runtime = images / "LabUI/runtime"
elif sys.platform == "darwin":
    executable = images / "LabUI.app/Contents/MacOS/LabUI"
    runtime = images / "LabUI.app/Contents/runtime/Contents/Home"
else:
    executable = images / "LabUI/bin/LabUI"
    runtime = images / "LabUI/lib/runtime"

if "jdk.accessibility" not in (runtime / "release").read_text():
    raise RuntimeError("The bundled JVM is missing jdk.accessibility")
with tempfile.TemporaryDirectory(prefix="labui-native-verification-") as directory:
    environment = {**os.environ, "LABUI_DATA_DIR": directory}
    for scenario in ["--verify", "--verify-restart"]:
        subprocess.run([str(executable), scenario], cwd=consumer, env=environment, check=True, timeout=120)
print("PACKAGED_NATIVE_SCENARIO_PASS: bundled runtime, persisted settings across restart, Colors, Icons and interaction")
