pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }
extra["colorsReleaseFile"] = file("../colors-release.json")
apply(from = "../gradle/colors-release.settings.gradle.kts")
extra["iconsReleaseFile"] = file("../icons-release.json")
apply(from = "../gradle/icons-release.settings.gradle.kts")
dependencyResolutionManagement {
    versionCatalogs { create("libs") { from(files("../gradle/libs.versions.toml")) } }
    repositories {
        maven { url = uri(providers.gradleProperty("uiRepository").orElse("https://raw.githubusercontent.com/Labpics-Team/labui/maven-compose-v0.1.0/").get()) }
        maven { url = uri(providers.gradleProperty("motionRepository").orElse("https://raw.githubusercontent.com/Labpics-Team/lab-motion/maven-compose-v0.1.0/").get()) }
        google(); mavenCentral()
    }
}
rootProject.name = "ui-compose-consumer"
include(":androidApp")
// Optional development checkout. Release verification leaves this unset and resolves Maven bytes.
providers.gradleProperty("uiSource").orNull?.let { includeBuild(it) { name = "lab-ui" } }
providers.gradleProperty("motionSource").orNull?.let { includeBuild(it) { name = "lab-motion" } }
providers.gradleProperty("iconsSource").orNull?.let { includeBuild(it) { name = "lab-icons" } }
