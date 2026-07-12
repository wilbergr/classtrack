import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import SparkBurst from './src/components/SparkBurst';
import { getDb } from './src/db/database';
import type { RootStackParamList, TabParamList } from './src/navigation';
import { initNotificationsAsync, refreshDailyDigestsAsync } from './src/notifications';
import { getSettingAsync, loadSettingsAsync } from './src/settings';
import { settleMomentumAsync } from './src/gamification/engine';
import AssignmentEditScreen from './src/screens/AssignmentEditScreen';
import OnboardingScreen, { ONBOARDED_KEY } from './src/screens/OnboardingScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SubjectDetailScreen from './src/screens/SubjectDetailScreen';
import SubjectsScreen from './src/screens/SubjectsScreen';
import TodayScreen from './src/screens/TodayScreen';
import { colors } from './src/theme';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: colors.bg,
    card: colors.card,
    text: colors.text,
    border: colors.border,
  },
};

const TAB_ICONS: Record<keyof TabParamList, string> = {
  Today: '📅',
  Subjects: '📚',
  Settings: '⚙️',
};

function TabIcon({ name, focused }: { name: keyof TabParamList; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{TAB_ICONS[name]}</Text>;
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      })}
    >
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen name="Subjects" component={SubjectsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboarded, setOnboarded] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        await getDb(); // open + migrate before any screen queries
        await loadSettingsAsync();
        setOnboarded(await getSettingAsync(ONBOARDED_KEY, false));
        await settleMomentumAsync(); // lazy momentum/grace evaluation on open
        await initNotificationsAsync();
        // Roll the 7-day digest window forward; never blocks startup.
        refreshDailyDigestsAsync().catch(() => undefined);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!ready) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.splash}>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorBody}>{error}</Text>
      </View>
    );
  }

  if (!onboarded) {
    return <OnboardingScreen onDone={() => setOnboarded(true)} />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="dark" />
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="SubjectDetail" component={SubjectDetailScreen} options={{ title: '' }} />
        <Stack.Screen
          name="AssignmentEdit"
          component={AssignmentEditScreen}
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen name="Progress" component={ProgressScreen} options={{ title: 'Progress' }} />
      </Stack.Navigator>
      <SparkBurst />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: { color: colors.danger, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  errorBody: { color: colors.textMuted, fontSize: 14, textAlign: 'center' },
});
