import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
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
          },
        },
        apns: {
          payload: {
            aps: {
              'mutable-content': 1,
              sound: 'default',
              badge: 1,
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
