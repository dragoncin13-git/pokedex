plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.ejemplo.pokedex"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.ejemplo.pokedex"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    // La web (index.html, css, js, icons…) vive en la carpeta de arriba (pokedex/).
    // Se copia sola a los assets del APK en cada compilación: una sola fuente de verdad.
    sourceSets {
        getByName("main") {
            assets.srcDir(layout.buildDirectory.dir("web-assets"))
        }
    }
}

val copiarWeb by tasks.registering(Copy::class) {
    val web = rootProject.projectDir.parentFile
    doFirst {
        if (!File(web, "index.html").exists()) {
            throw GradleException(
                "No encuentro index.html en ${web.absolutePath}. " +
                "La carpeta 'android' debe quedar DENTRO de la carpeta 'pokedex' (junto a index.html)."
            )
        }
    }
    from(web) {
        include("index.html", "manifest.json", "sw.js", "css/**", "js/**", "icons/**")
    }
    into(layout.buildDirectory.dir("web-assets"))
}

tasks.matching { it.name.startsWith("merge") && it.name.endsWith("Assets") }
    .configureEach { dependsOn(copiarWeb) }

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.11.0")
}
