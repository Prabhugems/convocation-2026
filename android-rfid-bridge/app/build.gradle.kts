plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.amasi.rfidbridge"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.amasi.rfidbridge"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }

    kotlinOptions {
        jvmTarget = "1.8"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("org.nanohttpd:nanohttpd:2.3.1")
    implementation("com.google.code.gson:gson:2.10.1")
    implementation("androidx.localbroadcastmanager:localbroadcastmanager:1.1.0")

    // Mivanta UHF SDK — place HCUHF_v1.1.0_20250620.aar in app/src/main/libs/
    implementation(fileTree(mapOf("dir" to "src/main/libs", "include" to listOf("*.aar"))))
}
