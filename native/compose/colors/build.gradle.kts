plugins {
    alias(libs.plugins.kotlin.multiplatform)
    alias(libs.plugins.android.multiplatform)
    `maven-publish`
}

group = rootProject.group
version = rootProject.version

kotlin {
    jvm("desktop")
    android {
        namespace = "pics.lab.ui.colors"
        compileSdk = 37
        minSdk = 33
        compilerOptions.jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
    jvmToolchain(21)
    targets.withType<org.jetbrains.kotlin.gradle.targets.jvm.KotlinJvmTarget>().configureEach {
        compilerOptions.jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
    sourceSets {
        // The generated Kotlin/JNA surface is identical on Android and desktop.
        // Only their native artifact packaging differs; the adapter has one source.
        val desktopMain by getting {
            kotlin.srcDir("src/jvmSharedMain/kotlin")
            dependencies {
                api(project(":"))
                implementation(providers.gradleProperty("colorsDesktopVersion")
                    .orElse(providers.gradleProperty("colorsVersion"))
                    .map { "pics.lab:colors-desktop:$it" })
            }
        }
        val androidMain by getting {
            kotlin.srcDir("src/jvmSharedMain/kotlin")
            dependencies {
                api(project(":"))
                implementation(providers.gradleProperty("colorsAndroidVersion")
                    .orElse(providers.gradleProperty("colorsVersion"))
                    .map { "pics.lab:colors-android:$it" })
            }
        }
        val desktopTest by getting {
            dependencies { implementation(kotlin("test")) }
        }
    }
}
publishing {
    repositories {
        maven {
            name = "distribution"
            url = uri(providers.gradleProperty("publicationRepository")
                .orElse(rootProject.layout.buildDirectory.dir("repository").map { it.asFile.path }))
        }
    }
    publications.withType<MavenPublication>().configureEach {
        pom {
            name = "Lab UI Colors adapter"
            description = "Native Lab Colors Program host for Lab UI on Android and desktop"
            url = "https://github.com/Labpics-Team/labui"
            licenses { license { name = "MIT"; url = "https://opensource.org/license/mit" } }
        }
    }
}
