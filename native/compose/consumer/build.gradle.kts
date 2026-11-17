import org.jetbrains.compose.desktop.application.dsl.TargetFormat

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
        }
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
            modules("java.desktop", "java.management", "jdk.unsupported")
        }
    }
}
