package com.jiny.lingoloop

import android.app.NotificationManager
import android.content.Context
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val notificationChannelName = "com.jiny.lingoloop/notifications"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, notificationChannelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    // 인자: { tag: String } — 해당 tag으로 발행된 모든
                    // 활성 알림을 cancel. 다른 tag의 알림(학습/퀴즈)은
                    // 영향 없음. inquiry_reply 처리 후 호출.
                    "cancelByTag" -> {
                        val tag = call.argument<String>("tag")
                        if (tag.isNullOrEmpty()) {
                            result.error("BAD_ARG", "tag is required", null)
                            return@setMethodCallHandler
                        }
                        val nm = getSystemService(Context.NOTIFICATION_SERVICE)
                            as NotificationManager
                        // activeNotifications API (M+) — tag이 같은 알림
                        // 들의 정확한 id를 알아내 한 건씩 cancel.
                        for (n in nm.activeNotifications) {
                            if (n.tag == tag) {
                                nm.cancel(n.tag, n.id)
                            }
                        }
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            }
    }
}
