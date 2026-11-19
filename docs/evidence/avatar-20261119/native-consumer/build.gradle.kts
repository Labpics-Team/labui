plugins {
    kotlin("jvm") version "2.4.21"
    kotlin("plugin.compose") version "2.4.21"
    id("org.jetbrains.compose") version "1.12.2"
}
repositories {
    maven { url = uri(providers.gradleProperty("uiRepository").get()) }
    maven { url = uri("https://raw.githubusercontent.com/Labpics-Team/lab-motion/maven-compose-v0.1.0/") }
    google(); mavenCentral()
}
kotlin { jvmToolchain(21) }
val uiVersion = providers.gradleProperty("uiVersion").orElse("0.1.0-avatar-material-final-20261119")
dependencies {
    implementation("pics.lab:ui-compose-desktop:${uiVersion.get()}")
    implementation(compose.desktop.currentOs)
    testImplementation(kotlin("test"))
    testImplementation(compose.components.resources)
}
tasks.test {
    systemProperty("java.awt.headless", "true")
    systemProperty("skiko.renderApi", "SOFTWARE")
    systemProperty("uiVersion", uiVersion.get())
}
