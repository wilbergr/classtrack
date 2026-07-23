import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  SafeAreaProvider,
  initialWindowMetrics,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import SparkBurst from './src/components/SparkBurst';
import TabBarIcon from './src/components/TabBarIcon';
import { getDb } from './src/db/database';
import { settleMomentumAsync } from './src/gamification/engine';
import type { RootStackParamList, TabParamList } from './src/navigation';
import { initNotificationsAsync, refreshDailyDigestsAsync } from './src/notifications';
import AssignmentEditScreen from './src/screens/AssignmentEditScreen';
import HomeScreen from './src/screens/HomeScreen';
import OnboardingScreen, { ONBOARDED_KEY } from './src/screens/OnboardingScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SubjectDetailScreen from './src/screens/SubjectDetailScreen';
import SubjectsScreen from './src/screens/SubjectsScreen';
import TodayScreen from './src/screens/TodayScreen';
import { getCachedSettings, getSettingAsync, loadSettingsAsync } from './src/settings';
import { ThemeProvider, useTheme, type ThemeColors } from './src/theme';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function Tabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // Settings are loaded before navigation mounts; initialRouteName only
  // matters at mount, so a one-time read is correct here.
  const [initialRoute] = useState<keyof TabParamList>(() =>
    getCachedSettings().launchScreen === 'today' ? 'Today' : 'Home',
  );
  return (
    <Tab.Navigator
      initialRouteName={initialRoute}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => (
          <TabBarIcon name={route.name} focused={focused} color={color} />
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        // A custom height must include the bottom inset itself (the default
        // inset padding still applies underneath the content).
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 62 + insets.bottom,
        },
        tabBarIconStyle: { width: 54, height: 30 },
        tabBarItemStyle: { paddingTop: 5 },
        tabBarLabel: ({ focused, color }) => (
          <Text style={{ fontSize: 11, fontWeight: focused ? '700' : '600', color }}>
            {route.name}
          </Text>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen name="Subjects" component={SubjectsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    // Root SafeAreaProvider so useSafeAreaInsets / useBottomInset resolve
    // everywhere — including Onboarding and the transparent Modals, which render
    // OUTSIDE NavigationContainer's own SafeAreaProviderCompat (which would
    // otherwise be the only provider, leaving those trees to throw).
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppShell() {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onboarded, setOnboarded] = useState(true);

  const navTheme = useMemo(() => {
    const base = dark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.bg,
        card: colors.card,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [colors, dark]);

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
    return (
      <>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <OnboardingScreen onDone={() => setOnboarded(true)} />
      </>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
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

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
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
