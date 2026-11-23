pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }
extra["colorsReleaseFile"] = file("colors-release.json")
apply(from = "gradle/colors-release.settings.gradle.kts")
extra["iconsReleaseFile"] = file("icons-release.json")
apply(from = "gradle/icons-release.settings.gradle.kts")
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        maven {
            url = uri(providers.gradleProperty("motionRepository").orElse("https://raw.githubusercontent.com/Labpics-Team/lab-motion/maven-compose-v0.1.0/").get())
            content { includeModuleByRegex("pics\\.lab", "motion-compose(?:-.*)?") }
        }
        google(); mavenCentral()
    }
}
rootProject.name = "ui-compose"
include(":ui-colors")
project(":ui-colors").projectDir = file("colors")
providers.gradleProperty("motionSource").orNull?.let { includeBuild(it) { name = "lab-motion" } }
