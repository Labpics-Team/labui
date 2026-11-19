import groovy.json.JsonSlurper

// The library and its standalone consumer resolve the same published release.
val release = JsonSlurper().parse(extra["iconsReleaseFile"] as File) as Map<*, *>
val version = providers.gradleProperty("iconsVersion").orElse(release["version"] as String).get()
val repository = release["githubRepository"] as String
val repositoryCommit = release["mavenRepositoryCommit"] as String
require(Regex("[0-9a-f]{40}").matches(repositoryCommit)) {
    "Native Icons Maven repository must identify its exact commit"
}

dependencyResolutionManagement {
    repositories {
        maven {
            name = "nativeIcons"
            url = uri(providers.gradleProperty("iconsRepository")
                .orElse("https://raw.githubusercontent.com/$repository/$repositoryCommit/").get())
            content { includeModuleByRegex("pics\\.lab", "icons-compose(?:-.*)?") }
        }
    }
    versionCatalogs {
        create("nativeIcons") {
            library("compose", "pics.lab", "icons-compose").version(version)
        }
    }
}
