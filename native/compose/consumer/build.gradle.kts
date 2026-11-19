import org.jetbrains.compose.desktop.application.dsl.TargetFormat
import org.jetbrains.compose.desktop.application.tasks.AbstractJPackageTask
import org.gradle.process.CommandLineArgumentProvider

plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.compose)
    alias(libs.plugins.android.multiplatform)
    alias(libs.plugins.android.application) apply false
}

val uiVersion = providers.gradleProperty("uiVersion").orElse("0.1.0")
val uiCoordinate = uiVersion.map { "pics.lab:ui-compose:$it" }
val colorsAdapterCoordinate = uiVersion.map { "pics.lab:ui-colors:$it" }

// Ubuntu's package manager maintains the matching Java and native halves of the
// GNOME AT-SPI bridge. Resolve its multiarch location instead of assuming x64.
// Install libatk-wrapper-java-jni before building or running on Linux.
val linuxAccessibilityJvmArgs =
    if (providers.systemProperty("os.name").get() == "Linux") {
        val installedBridge = providers.exec {
            commandLine("dpkg-query", "--listfiles", "libatk-wrapper-java", "libatk-wrapper-java-jni")
            isIgnoreExitValue = true
        }
        // Keep resolution lazy: Android builds on Linux do not use the desktop bridge.
        installedBridge.standardOutput.asText.map { output ->
            check(installedBridge.result.get().exitValue == 0) {
                "Linux desktop requires GNOME accessibility: sudo apt install libatk-wrapper-java-jni"
            }
            val files = output.lineSequence().map(::File).toList()
            val wrapper = files.single { it.name == "java-atk-wrapper.jar" }
            val nativeWrapper = files.single { it.name == "libatk-wrapper.so" }
            check(wrapper.isFile && nativeWrapper.isFile) { "The installed GNOME accessibility bridge is incomplete" }
            listOf(
                "--module-path=${wrapper.path}",
                "--add-modules=ALL-MODULE-PATH",
                "-Djavax.accessibility.assistive_technologies=org.GNOME.Accessibility.AtkWrapper",
                "-Djava.library.path=${nativeWrapper.parent}",
            )
        }
    } else providers.provider { emptyList<String>() }

kotlin {
    jvm("desktop")
    android {
        namespace = "pics.lab.ui.sample"
        compileSdk = 37
        minSdk = 33
    }
    iosArm64 { binaries.framework { baseName = "LabUIExample"; isStatic = true; export(uiCoordinate) } }
    iosSimulatorArm64 { binaries.framework { baseName = "LabUIExample"; isStatic = true; export(uiCoordinate) } }
    jvmToolchain(21)
    sourceSets {
        commonMain.dependencies {
            api(uiCoordinate)
            implementation(nativeIcons.compose)
            implementation(libs.datastore.preferences)
        }
        commonTest.dependencies { implementation(kotlin("test")) }
        val desktopMain by getting {
            kotlin.srcDir("src/jvmSharedMain/kotlin")
            dependencies {
                implementation(compose.desktop.currentOs)
                implementation(colorsAdapterCoordinate)
            }
        }
        val androidMain by getting {
            kotlin.srcDir("src/jvmSharedMain/kotlin")
            dependencies { implementation(colorsAdapterCoordinate) }
        }
    }
}
compose.desktop {
    application {
        mainClass = "pics.lab.ui.sample.MainKt"
        nativeDistributions {
            targetFormats(TargetFormat.Dmg, TargetFormat.Msi, TargetFormat.Deb)
            packageName = "LabUI"
            packageVersion = "0.1.0"
            description = "Lab UI — native settings example"
            vendor = "Labpics"
            // JDK 21's macOS bundler requires a positive major version for the example app.
            macOS { packageVersion = "1.0.0" }
            modules("java.desktop", "java.management", "jdk.unsupported", "jdk.accessibility")
        }
    }
}

// Compose exposes additional jpackage flags on its packaging task. The DEB
// installer, rather than a user's shell configuration, supplies the bridge.
// Compose registers these tasks after evaluation and sets their JVM arguments;
// append after that configuration so its defaults cannot replace the bridge.
afterEvaluate {
    tasks.withType<AbstractJPackageTask>().configureEach {
        launcherJvmArgs.addAll(linuxAccessibilityJvmArgs)
        if (targetFormat == TargetFormat.Deb) {
            // freeArgs is written verbatim to jpackage's @argument file.
            freeArgs.addAll("--linux-package-deps", "\"libatk-wrapper-java-jni (>= 0.37.1)\"")
        }
    }
}

tasks.withType<JavaExec>().configureEach {
    jvmArgumentProviders.add(CommandLineArgumentProvider { linuxAccessibilityJvmArgs.get() })
}
