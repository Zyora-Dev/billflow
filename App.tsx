import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/auth/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { installNotificationTapHandler } from './src/lib/push';
import { ToastProvider } from './src/components/Toast';
import { NetworkProvider } from './src/components/NetworkProvider';

export default function App() {
  const navRef = useRef<NavigationContainerRef<any>>(null);

  useEffect(() => {
    installNotificationTapHandler((route, params) => {
      try { (navRef.current as any)?.navigate(route, params); } catch {}
    });
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navRef}>
        <AuthProvider>
          <ToastProvider>
            <NetworkProvider>
              <StatusBar style="light" />
              <RootNavigator />
            </NetworkProvider>
          </ToastProvider>
        </AuthProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
