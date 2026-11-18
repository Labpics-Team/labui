import groovy.json.JsonSlurper

val release = JsonSlurper().parse(extra["colorsReleaseFile"] as File) as Map<*, *>
val version = release["version"] as String
require(Regex("[0-9]+\\.[0-9]+\\.[0-9]+-[0-9a-f]{40}").matches(version)) {
    "Native Colors version must identify its source commit"
}
val sourceCommit = version.substringAfterLast('-')
val tag = "colors-native-v${version.substringBefore('-')}-${sourceCommit.take(12)}"
val repository = release["githubRepository"] as String

dependencyResolutionManagement {
    repositories {
        maven {
            name = "nativeColors"
            url = uri("https://raw.githubusercontent.com/$repository/maven-$tag/")
        }
    }
    versionCatalogs {
        create("nativeColors") {
            version("release", version)
            library("desktop", "pics.lab", "colors-desktop").versionRef("release")
            library("android", "pics.lab", "colors-android").versionRef("release")
        }
    }
}
