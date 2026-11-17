plugins {
    id("com.android.application") version "9.1.1"
    kotlin("plugin.compose") version "2.3.21"
}
android {
    namespace = "pics.lab.ui.example"
    compileSdk = 37
    defaultConfig {
        applicationId = "pics.lab.ui.example"
        minSdk = 33
        targetSdk = 37
        versionCode = 1
        versionName = "0.1.0"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures { compose = true }
}
dependencies {
    implementation(project(":"))
    implementation("androidx.activity:activity-compose:1.12.0")
}
