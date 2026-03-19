import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseConfig implements OnModuleInit {
  private readonly logger = new Logger(FirebaseConfig.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const projectId = this.configService.get('FCM_PROJECT_ID');
    if (!projectId) {
      this.logger.warn(
        'FCM_PROJECT_ID not set — Firebase not initialized. Push notifications disabled.',
      );
      return;
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey: this.configService
            .get<string>('FCM_PRIVATE_KEY', '')
            .replace(/\\n/g, '\n'),
          clientEmail: this.configService.get('FCM_CLIENT_EMAIL'),
        }),
      });
      this.logger.log('Firebase Admin initialized');
    }
  }
}
