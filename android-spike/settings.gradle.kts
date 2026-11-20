// 시험 앱(스파이크): 폰 전체 소리에 EQ가 걸리는지만 확인하는 작은 안드로이드 앱
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "eq-spike"
include(":app")
