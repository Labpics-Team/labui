pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }
extra["colorsReleaseFile"] = file("colors-release.json")
apply(from = "gradle/colors-release.settings.gradle.kts")
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        maven {
            url = uri(providers.gradleProperty("iconsRepository").orElse("https://raw.githubusercontent.com/Labpics-Team/lab-icons/maven-compose-v0.4.0/").get())
            content { includeModule("pics.lab", "icons-compose"); includeModule("pics.lab", "icons-compose-desktop"); includeModule("pics.lab", "icons-compose-android"); includeModule("pics.lab", "icons-compose-iosarm64"); includeModule("pics.lab", "icons-compose-iossimulatorarm64") }
        }
        maven { url = uri(providers.gradleProperty("motionRepository").orElse("https://raw.githubusercontent.com/Labpics-Team/lab-motion/maven-compose-v0.1.0/").get()) }
        google(); mavenCentral()
    }
}
rootProject.name = "ui-compose"
include(":ui-colors")
project(":ui-colors").projectDir = file("colors")
providers.gradleProperty("motionSource").orNull?.let { includeBuild(it) { name = "lab-motion" } }
