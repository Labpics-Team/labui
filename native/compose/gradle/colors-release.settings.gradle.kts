import groovy.json.JsonSlurper

val release = JsonSlurper().parse(extra["colorsReleaseFile"] as File) as Map<*, *>
val version = release["version"] as String
require(Regex("[0-9]+\\.[0-9]+\\.[0-9]+-[0-9a-f]{40}").matches(version)) {
    "Native Colors version must identify its source commit"
}
val repository = release["githubRepository"] as String
val repositoryCommit = release["mavenRepositoryCommit"] as String
require(Regex("[0-9a-f]{40}").matches(repositoryCommit)) {
    "Native Colors Maven repository must identify its exact commit"
}

dependencyResolutionManagement {
    repositories {
        maven {
            name = "nativeColors"
            url = uri("https://raw.githubusercontent.com/$repository/$repositoryCommit/")
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
