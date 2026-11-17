"""Exercise the application image using its bundled JVM and native libraries."""

from pathlib import Path
import subprocess
import sys


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
subprocess.run([str(executable), "--verify"], cwd=consumer, check=True, timeout=60)
print("PACKAGED_NATIVE_SCENARIO_PASS: bundled runtime, Colors, Icons, resources and interaction")
