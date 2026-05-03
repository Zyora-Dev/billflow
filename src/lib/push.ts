// Expo push notification registration + tap handler.
// Safe to import even when running in Expo Go — guards device & permission failures.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import api from '../api/client';

let cachedToken: string | null = null;
let listenersInstalled = false;

// Foreground handler — show banner + sound + badge while the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }) as any,
});

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0EA5E9',
      sound: 'default',
    });
  } catch {}
}

export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null; // simulators won't get tokens
  await ensureAndroidChannel();
  try {
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.status === 'granted';
    if (!granted) {
      const r = await Notifications.requestPermissionsAsync();
      granted = r.status === 'granted';
    }
    if (!granted) return null;

    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ||
      (Constants as any)?.easConfig?.projectId;
    const tokenResp = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined as any
    );
    cachedToken = tokenResp.data;
    return cachedToken;
  } catch (e) {
    return null;
  }
}

export async function registerPushTokenWithBackend(): Promise<void> {
  const token = await getExpoPushToken();
  if (!token) return;
  try {
    await api.post('/api/devices/register', {
      token,
      platform: Platform.OS,
      device_name: `${Device.brand || ''} ${Device.modelName || ''}`.trim() || Platform.OS,
    });
  } catch {}
}

export async function unregisterPushToken(): Promise<void> {
  if (!cachedToken) return;
  try {
    await api.post('/api/devices/unregister', { token: cachedToken });
  } catch {}
}

export function installNotificationTapHandler(navigate: (route: string, params?: any) => void) {
  if (listenersInstalled) return;
  listenersInstalled = true;
  // Tapped from background / killed
  Notifications.addNotificationResponseReceivedListener((resp) => {
    try {
      const data: any = resp.notification.request.content.data || {};
      switch (data.type) {
        case 'task_assigned':
        case 'task_status':
        case 'task_update':
          if (data.task_id) navigate('TaskDetail', { id: data.task_id });
          break;
        case 'order_created':
          if (data.task_id) navigate('TaskDetail', { id: data.task_id });
          break;
        case 'payment_received':
          navigate('Payments');
          break;
        case 'payment_made':
          navigate('PurchasePayments');
          break;
        default:
          navigate('Notifications');
      }
    } catch {}
  });
}
