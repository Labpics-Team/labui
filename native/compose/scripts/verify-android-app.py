"""Run the app interaction, stop its process, then verify persisted state without reinstalling."""

from pathlib import Path
import argparse
import json
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
    result = subprocess.run([*adb, *arguments], text=True, encoding="utf-8", errors="replace", capture_output=True, timeout=timeout)
    if result.returncode:
        print(result.stdout)
        print(result.stderr)
        result.check_returncode()
    return result.stdout


def capture_failure(error: Exception) -> None:
    """Keep diagnostics for setup, process-control and assertion failures alike."""
    failure = {"type": type(error).__name__, "message": str(error)}
    if isinstance(error, subprocess.CalledProcessError):
        failure.update(command=error.cmd, returncode=error.returncode)
    (evidence / "failure.json").write_text(json.dumps(failure, indent=2), encoding="utf-8")
    deadline = time.monotonic() + 20
    queries = {
        "logcat-final": ["logcat", "-d", "-t", "2000", "-v", "threadtime"],
        "device-state": ["get-state"],
        "activity": ["shell", "dumpsys", "activity"],
        "package": ["shell", "dumpsys", "package", package],
    }
    for name, arguments in queries.items():
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break
        try:
            result = subprocess.run([*adb, *arguments], text=True, encoding="utf-8", errors="replace",
                                    capture_output=True, timeout=min(5, remaining))
            text = f"exit={result.returncode}\n{result.stdout}{result.stderr}"
        except (OSError, subprocess.TimeoutExpired) as diagnostic_error:
            text = str(diagnostic_error)
        (evidence / f"{name}.txt").write_text(text, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--method", action="append", dest="methods",
                        help="Run only these SettingsExperienceTest methods")
    args = parser.parse_args()
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
    with (evidence / "logcat.txt").open("w", encoding="utf-8") as log:
        logger = subprocess.Popen([*adb, "logcat", "-v", "threadtime"], stdout=log, stderr=subprocess.STDOUT)
        try:
            for method in args.methods or ["editValidateAndSaveThroughNativeAccessibility", "restoresSavedWorkspaceAfterRestart",
                           "tagsPasteWithAncestorReceiverInsertsExactlyOnce", "filePickerImportsReadsCancelsAndRemovesARealDocument"]:
                run("shell", "am", "force-stop", package)
                result = subprocess.run([*adb, "shell", "am", "instrument", "-w", "-r", "-e", "class",
                                         f"{test_class}#{method}", runner], text=True, encoding="utf-8", errors="replace",
                                        capture_output=True, timeout=180)
                output = result.stdout + result.stderr
                (evidence / f"{method}.txt").write_text(output, encoding="utf-8")
                print(output)
                result.check_returncode()
                for extension in ["png", "xml"]:
                    run("pull", f"/sdcard/Android/data/{package}/files/verification.{extension}",
                        str(evidence / f"{method}.{extension}"))
                if not re.search(r"OK \(1 test\)", output):
                    raise RuntimeError(f"Android scenario failed: {method}")
        finally:
            logger.terminate()
            try:
                logger.wait(timeout=10)
            except subprocess.TimeoutExpired:
                logger.kill()
                logger.wait(timeout=5)
    print("ANDROID_APPLICATION_PASS: all requested scenarios completed")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        try:
            capture_failure(error)
        except Exception as diagnostic_error:
            print(f"Could not preserve Android diagnostics: {diagnostic_error}")
        raise
