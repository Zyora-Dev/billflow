import React, { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../auth/AuthContext';
import LoadingScreen from '../components/LoadingScreen';
import AnimatedSplashScreen from '../components/AnimatedSplashScreen';
import OnboardingSlidesScreen, { ONBOARDING_KEY } from '../screens/onboarding/OnboardingSlidesScreen';
import AuthStack from './AuthStack';
import AppWithDrawer from './BottomTabs';

export default function RootNavigator() {
  const { token, loading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const seen = await SecureStore.getItemAsync(ONBOARDING_KEY);
        setShowOnboarding(seen !== '1');
      } catch {
        setShowOnboarding(true);
      } finally {
        setOnboardingChecked(true);
      }
    })();
  }, []);

  if (!splashDone) return <AnimatedSplashScreen onFinish={() => setSplashDone(true)} />;
  if (loading || !onboardingChecked) return <LoadingScreen />;

  // Show onboarding only once, before the user has logged in
  if (showOnboarding && !token) {
    return <OnboardingSlidesScreen onDone={() => setShowOnboarding(false)} />;
  }

  return token ? <AppWithDrawer /> : <AuthStack />;
}
