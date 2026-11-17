plugins {
    kotlin("multiplatform") version "2.3.21"
    kotlin("plugin.compose") version "2.3.21"
    id("org.jetbrains.compose") version "1.12.2"
    id("com.android.kotlin.multiplatform.library") version "9.1.1"
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
            implementation("dev.chrisbanes.haze:haze:2.1.0")
            implementation("dev.chrisbanes.haze:haze-blur:2.1.0")
            implementation("dev.chrisbanes.haze:haze-glass:2.1.0")
            api("pics.lab:motion-compose:0.1.0")
        }
        commonTest.dependencies { implementation(kotlin("test")) }
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
