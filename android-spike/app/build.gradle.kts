plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "io.github.jindosz.audiogear.eqspike"
    compileSdk = 35

    defaultConfig {
        applicationId = "io.github.jindosz.audiogear.eqspike"
        minSdk = 28 // DynamicsProcessing(자유로운 밴드 EQ)이 안드로이드 9(API 28)부터 있음
        targetSdk = 35
        versionCode = 1
        versionName = "0.1-spike"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}
