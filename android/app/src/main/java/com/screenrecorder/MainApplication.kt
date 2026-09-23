package com.screenrecorder

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactNativeApplicationEntryPoint
import com.facebook.react.defaults.DefaultReactHost
import com.facebook.react.defaults.DefaultReactNativeHost
import com.screenrecorder.recording.ScreenRecordPackage

class MainApplication : Application(), ReactApplication {

    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this@MainApplication) {
            override fun getPackages(): List<ReactPackage> =
                PackageList(this).packages.apply {
                    // Register custom MediaProjection Screen Recorder native package
                    add(ScreenRecordPackage())
                }

            override fun getJSMainModuleName(): String = "index"

            override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

            override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
        }

    override val reactHost: ReactHost by lazy {
        DefaultReactHost.getDefaultReactHost(applicationContext, reactNativeHost)
    }

    override fun onCreate() {
        super.onCreate()
        ReactNativeApplicationEntryPoint.loadReactNative(this)
    }
}
