import org.jetbrains.compose.desktop.application.dsl.TargetFormat

plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.compose)
    alias(libs.plugins.android.multiplatform)
    alias(libs.plugins.android.application) apply false
}

kotlin {
    jvm("desktop")
    android {
        namespace = "pics.lab.ui.sample"
        compileSdk = 37
        minSdk = 33
    }
    iosArm64 { binaries.framework { baseName = "LabUIExample"; isStatic = true } }
    iosSimulatorArm64 { binaries.framework { baseName = "LabUIExample"; isStatic = true } }
    jvmToolchain(21)
    sourceSets {
        commonMain.dependencies {
            implementation("pics.lab:ui-compose:${providers.gradleProperty("uiVersion").orElse("0.1.0").get()}")
        }
        val desktopMain by getting
        desktopMain.dependencies { implementation(compose.desktop.currentOs) }
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
            modules("java.desktop", "java.management", "jdk.unsupported")
        }
    }
}
