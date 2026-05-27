import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  /**
   * Android NotificationManager tag. 같은 tag으로 보낸 알림은 자동
   * 으로 한 슬롯에서 덮어쓰고, 클라가 처리 후 native에서 그 tag만
   * cancel 가능.
   */
  androidTag?: string;
  /**
   * APNS thread-id (UNNotificationContent.threadIdentifier로 매핑).
   * iOS native에서 getDeliveredNotifications iterate 시 같은 thread-id
   * 알림을 식별해 removeDeliveredNotifications로 정리. 사용자가 in-app
   * 으로 처리한 알림이 알림 센터에 stale로 남는 걸 방지.
   */
  iosThreadId?: string;
}

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private readonly isEnabled: boolean;

  constructor(private configService: ConfigService) {
    this.isEnabled = !!this.configService.get('FCM_PROJECT_ID');
  }

  async sendToDevice(token: string, payload: PushPayload): Promise<boolean> {
    if (!this.isEnabled) {
      this.logger.debug(
        `[DRY RUN] Push to ${token.substring(0, 20)}...: ${payload.title}`,
      );
      return true;
    }

    try {
      await admin.messaging().send({
        token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data,
        android: {
          priority: 'high',
          notification: {
            channelId: 'lingoloop_learning',
            priority: 'high',
            ...(payload.androidTag ? { tag: payload.androidTag } : {}),
          },
        },
        apns: {
          payload: {
            aps: {
              'mutable-content': 1,
              sound: 'default',
              badge: 1,
              ...(payload.iosThreadId
                ? { 'thread-id': payload.iosThreadId }
                : {}),
            },
          },
        },
      });
      this.logger.debug(`Push sent to ${token.substring(0, 20)}...`);
      return true;
    } catch (error: any) {
      this.logger.error(`Push failed: ${error.message}`);
      // Token invalid — mark for cleanup
      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered'
      ) {
        return false;
      }
      return false;
    }
  }

  /**
   * Data-only "silent" push used to wake the client just long enough to
   * refresh the home screen widget. No notification fields → no sound,
   * no banner, no badge change. APNS requires content-available=1 and
   * push-type=background; Android needs priority=high so the message
   * delivers promptly even on a doze device.
   */
  async sendSilentToMultiple(
    tokens: string[],
    data: Record<string, string>,
  ): Promise<{ success: number; failure: number; invalidTokens: string[] }> {
    if (!this.isEnabled) {
      this.logger.debug(
        `[DRY RUN] Silent push to ${tokens.length} devices`,
      );
      return { success: tokens.length, failure: 0, invalidTokens: [] };
    }

    const message: admin.messaging.MulticastMessage = {
      tokens,
      data,
      android: {
        priority: 'high',
      },
      apns: {
        headers: {
          'apns-push-type': 'background',
          'apns-priority': '5',
        },
        payload: {
          aps: {
            'content-available': 1,
          },
        },
      },
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      const invalidTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (
          !resp.success &&
          (resp.error?.code === 'messaging/invalid-registration-token' ||
            resp.error?.code ===
              'messaging/registration-token-not-registered')
        ) {
          invalidTokens.push(tokens[idx]);
        }
      });
      return {
        success: response.successCount,
        failure: response.failureCount,
        invalidTokens,
      };
    } catch (error: any) {
      this.logger.error(`Silent multicast failed: ${error.message}`);
      return { success: 0, failure: tokens.length, invalidTokens: [] };
    }
  }

  async sendToMultiple(
    tokens: string[],
    payload: PushPayload,
  ): Promise<{ success: number; failure: number; invalidTokens: string[] }> {
    if (!this.isEnabled) {
      this.logger.debug(
        `[DRY RUN] Push to ${tokens.length} devices: ${payload.title}`,
      );
      return { success: tokens.length, failure: 0, invalidTokens: [] };
    }

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data,
      android: {
        priority: 'high',
        notification: {
          channelId: 'lingoloop_learning',
        },
      },
      apns: {
        payload: {
          aps: {
            'mutable-content': 1,
            sound: 'default',
          },
        },
      },
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      const invalidTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (
          !resp.success &&
          (resp.error?.code === 'messaging/invalid-registration-token' ||
            resp.error?.code ===
              'messaging/registration-token-not-registered')
        ) {
          invalidTokens.push(tokens[idx]);
        }
      });
      return {
        success: response.successCount,
        failure: response.failureCount,
        invalidTokens,
      };
    } catch (error: any) {
      this.logger.error(`Multicast push failed: ${error.message}`);
      return { success: 0, failure: tokens.length, invalidTokens: [] };
    }
  }
}
