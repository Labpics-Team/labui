"""Run the app interaction, stop its process, then verify persisted state without reinstalling."""

from pathlib import Path
import re
import subprocess
import time

consumer = Path(__file__).resolve().parents[1] / "consumer"
build = consumer / "androidApp/build"
evidence = build / "application-evidence"
evidence.mkdir(parents=True, exist_ok=True)
adb = ["adb", "-e"]
package = "pics.lab.ui.example"
test_class = f"{package}.SettingsExperienceTest"


def run(*arguments: str, timeout: int = 120) -> str:
    result = subprocess.run([*adb, *arguments], text=True, capture_output=True, timeout=timeout)
    if result.returncode:
        print(result.stdout)
        print(result.stderr)
        result.check_returncode()
    return result.stdout


for apk in [build / "outputs/apk/debug/androidApp-debug.apk",
            build / "outputs/apk/androidTest/debug/androidApp-debug-androidTest.apk"]:
    run("install", "-r", str(apk))
run("shell", "pm", "clear", package)
# sys.boot_completed precedes credential-encrypted storage/user readiness.
# Await the actual user/runner boundary instead of sleeping or retrying a test.
deadline = time.monotonic() + 60
while "RUNNING_UNLOCKED" not in run("shell", "am", "get-started-user-state", "0"):
    if time.monotonic() >= deadline:
        raise RuntimeError("Android user did not unlock after boot")
    time.sleep(.2)
runner = f"{package}.test/androidx.test.runner.AndroidJUnitRunner"
assert runner in run("shell", "pm", "list", "instrumentation"), "Installed runner is missing"
with (evidence / "logcat.txt").open("w") as log:
    logger = subprocess.Popen([*adb, "logcat", "-v", "threadtime"], stdout=log, stderr=subprocess.STDOUT)
    try:
        for method in ["editValidateAndSaveThroughNativeAccessibility", "restoresSavedWorkspaceAfterRestart"]:
            run("shell", "am", "force-stop", package)
            result = subprocess.run([*adb, "shell", "am", "instrument", "-w", "-r", "-e", "class",
                                     f"{test_class}#{method}", runner], text=True,
                                    capture_output=True, timeout=180)
            output = result.stdout + result.stderr
            (evidence / f"{method}.txt").write_text(output)
            print(output)
            if result.returncode:
                # Preserve ActivityManager state and a final log snapshot before
                # the emulator runner terminates the device.
                for service in ["activity", "package"]:
                    (evidence / f"{service}.txt").write_text(run("shell", "dumpsys", service))
                (evidence / "logcat-final.txt").write_text(run("logcat", "-d", "-v", "threadtime"))
                result.check_returncode()
            for extension in ["png", "xml"]:
                run("pull", f"/sdcard/Android/data/{package}/files/verification.{extension}",
                    str(evidence / f"{method}.{extension}"))
            if not re.search(r"OK \(1 test\)", output):
                raise RuntimeError(f"Android scenario failed: {method}")
    finally:
        logger.terminate()
        logger.wait(timeout=10)
print("ANDROID_RESTART_PASS: draft cancellation, validation, persisted save and new-process restore")
