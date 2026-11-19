plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.compose)
    alias(libs.plugins.android.multiplatform)
    `maven-publish`
}

group = "pics.lab"
version = providers.gradleProperty("publicationVersion").orElse("0.1.0").get()

kotlin {
    jvm("desktop")
    android {
        namespace = "pics.lab.ui"
        compileSdk = 37
        minSdk = 33
        compilerOptions.jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        androidResources.enable = true
    }
    iosArm64()
    iosSimulatorArm64()
    applyDefaultHierarchyTemplate { common { group("skiko") { withJvm(); withIos() } } }
    jvmToolchain(21)
    targets.withType<org.jetbrains.kotlin.gradle.targets.jvm.KotlinJvmTarget>().configureEach {
        compilerOptions.jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
    sourceSets {
        commonMain.dependencies {
            api(compose.runtime)
            api(compose.foundation)
            api(compose.ui)
            implementation(compose.components.resources)
            implementation("org.jetbrains.androidx.lifecycle:lifecycle-runtime-compose:2.11.0")
            implementation("dev.chrisbanes.haze:haze:2.1.0")
            implementation("dev.chrisbanes.haze:haze-blur:2.1.0")
            implementation("dev.chrisbanes.haze:haze-glass:2.1.0")
            api("pics.lab:motion-compose:0.1.0")
            implementation(libs.coil.compose)
            implementation(libs.coil.network)
            implementation("pics.lab:icons-compose:0.4.0")
        }
        val desktopMain by getting
        desktopMain.dependencies { implementation(libs.ktor.java) }
        androidMain.dependencies { implementation(libs.ktor.android) }
        iosMain.dependencies { implementation(libs.ktor.darwin) }
        commonTest.dependencies {
            implementation(kotlin("test"))
            implementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
        }
        val desktopTest by getting
        desktopTest.dependencies {
            implementation(compose.desktop.currentOs)
            implementation(compose.desktop.uiTestJUnit4)
        }
    }
}
compose.resources { publicResClass = true; packageOfResClass = "pics.lab.ui.resources" }
publishing {
    repositories {
        maven {
            name = "distribution"
            url = uri(providers.gradleProperty("publicationRepository").orElse(layout.buildDirectory.dir("repository").map { it.asFile.path }))
        }
    }
    publications.withType<MavenPublication>().configureEach {
        pom {
            name = "Lab UI for Compose"
            description = "Lab UI components and authored materials for Android, Apple and desktop"
            url = "https://github.com/Labpics-Team/labui"
            licenses { license { name = "MIT"; url = "https://opensource.org/license/mit" } }
            scm { url = "https://github.com/Labpics-Team/labui" }
        }
    }
}
