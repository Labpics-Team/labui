"""Run the app interaction, stop its process, then verify persisted state without reinstalling."""

from pathlib import Path
import re
import subprocess

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
with (evidence / "logcat.txt").open("w") as log:
    logger = subprocess.Popen([*adb, "logcat", "-v", "threadtime"], stdout=log, stderr=subprocess.STDOUT)
    try:
        for method in ["editValidateAndSaveThroughNativeAccessibility", "restoresSavedWorkspaceAfterRestart"]:
            run("shell", "am", "force-stop", package)
            output = run("shell", "am", "instrument", "-w", "-r", "-e", "class", f"{test_class}#{method}",
                         f"{package}.test/androidx.test.runner.AndroidJUnitRunner")
            (evidence / f"{method}.txt").write_text(output)
            print(output)
            for extension in ["png", "xml"]:
                run("pull", f"/sdcard/Android/data/{package}/files/verification.{extension}",
                    str(evidence / f"{method}.{extension}"))
            if not re.search(r"OK \(1 test\)", output):
                raise RuntimeError(f"Android scenario failed: {method}")
    finally:
        logger.terminate()
        logger.wait(timeout=10)
print("ANDROID_RESTART_PASS: draft cancellation, validation, persisted save and new-process restore")
