pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }
dependencyResolutionManagement {
    repositories {
        maven { url = uri(providers.gradleProperty("uiRepository").orElse("https://raw.githubusercontent.com/Labpics-Team/labui/maven-compose-v0.1.0/").get()) }
        maven { url = uri(providers.gradleProperty("motionRepository").orElse("https://raw.githubusercontent.com/Labpics-Team/lab-motion/maven-compose-v0.1.0/").get()) }
        google(); mavenCentral()
    }
}
rootProject.name = "ui-compose-consumer"
include(":androidApp")
// Optional development checkout. Release verification leaves this unset and resolves Maven bytes.
providers.gradleProperty("uiSource").orNull?.let { includeBuild(it) }
