import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { TabScreenProps } from '../navigation';
import {
  ensureNotificationPermissionAsync,
  getNotificationPermissionAsync,
} from '../notifications';
import { colors, radius, spacing } from '../theme';

type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unknown';

const PERMISSION_LABEL: Record<PermissionState, string> = {
  granted: 'On',
  denied: 'Off — enable in system settings',
  undetermined: 'Not set up yet',
  unknown: '…',
};

export default function SettingsScreen(_props: TabScreenProps<'Settings'>) {
  const [permission, setPermission] = useState<PermissionState>('unknown');

  const refresh = useCallback(async () => {
    setPermission(await getNotificationPermissionAsync());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const enable = useCallback(async () => {
    if (permission === 'denied') {
      // The OS won't re-prompt; send the user to system settings.
      await Linking.openSettings();
      return;
    }
    await ensureNotificationPermissionAsync();
    await refresh();
  }, [permission, refresh]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Reminders</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Notifications</Text>
          <Text style={styles.rowValue}>{PERMISSION_LABEL[permission]}</Text>
        </View>
        {permission !== 'granted' && (
          <Pressable
            onPress={enable}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>
              {permission === 'denied' ? 'Open system settings' : 'Enable notifications'}
            </Text>
          </Pressable>
        )}
        <Text style={styles.hint}>
          Each assignment gets two local reminders: the evening before at 6:00 PM and the morning
          it is due at 7:30 AM. Reminders are scheduled on this device only.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Your data</Text>
      <View style={styles.card}>
        <Text style={styles.bodyText}>
          Everything is stored locally on this {Platform.OS === 'ios' ? 'iPhone' : 'device'} — no
          account, no cloud, works fully offline. Deleting the app deletes your data.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>About</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>App</Text>
          <Text style={styles.rowValue}>ClassTrack</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Version</Text>
          <Text style={styles.rowValue}>1.0.0</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowValue: { color: colors.textMuted, fontSize: 15, flexShrink: 1, textAlign: 'right' },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  pressed: { opacity: 0.8 },
  buttonText: { color: colors.primaryText, fontSize: 15, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: spacing.md },
  bodyText: { color: colors.text, fontSize: 14, lineHeight: 20 },
});
