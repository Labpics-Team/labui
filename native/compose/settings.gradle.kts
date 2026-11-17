pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        maven { url = uri(providers.gradleProperty("motionRepository").orElse("https://raw.githubusercontent.com/Labpics-Team/lab-motion/maven-compose-v0.1.0/").get()) }
        google(); mavenCentral()
    }
}
rootProject.name = "ui-compose"
providers.gradleProperty("motionSource").orNull?.let { includeBuild(it) { name = "lab-motion" } }
