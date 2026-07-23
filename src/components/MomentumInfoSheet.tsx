// "How it works" for Momentum & shields: a small bottom sheet in plain,
// friendly language. Copy rulebook applies in full — nothing is ever lost,
// no shame: quiet days are free, shields cover busy ones, cooling is gentle
// and bests are kept forever.

import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import ShieldIcon from './ShieldIcon';
import { GRACE_CAP } from '../gamification/engine';
import { useBottomInset } from '../hooks';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Shields currently ready, for the live row up top. */
  grace: number;
  /** Adds the sidekick line when a companion is chosen. */
  hasCompanion: boolean;
}

export default function MomentumInfoSheet({ visible, onClose, grace, hasCompanion }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const sheetBottom = useBottomInset(spacing.xl);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: sheetBottom }]}>
          <View style={styles.handle} />
          <Text style={styles.heading}>Momentum & shields</Text>

          <View
            style={styles.liveRow}
            accessibilityLabel={`${grace} of ${GRACE_CAP} shields ready`}
          >
            {Array.from({ length: GRACE_CAP }, (_, i) => (
              <ShieldIcon key={i} ready={i < grace} size={20} />
            ))}
            <Text style={styles.liveText}>
              {grace === GRACE_CAP
                ? 'both shields ready'
                : grace > 0
                  ? 'one shield ready'
                  : 'shields resting — fresh ones Monday'}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowTitle}>Momentum grows daily</Text>
            <Text style={styles.rowBody}>
              The first time you add or finish something each day, momentum ticks up by 1.
              Coming back after a break? That first day counts double.
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowTitle}>Quiet days are free</Text>
            <Text style={styles.rowBody}>
              A day with nothing on your list costs nothing. Breaks and holidays never touch
              your momentum.
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowTitle}>Shields cover busy days</Text>
            <Text style={styles.rowBody}>
              You carry {GRACE_CAP}. If a day goes by while work is still waiting, a shield
              quietly covers it and your momentum stays put. Fresh shields arrive every
              Monday, all by themselves.
              {hasCompanion ? ' Your sidekick keeps the ready ones at its side.' : ''}
            </Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.rowTitle}>Cooling is gentle</Text>
            <Text style={styles.rowBody}>
              With no shields on hand, momentum just cools a little — it never resets to
              zero, and your best is remembered forever.
            </Text>
          </View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Got it ✦</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    backdropTouch: { flex: 1 },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      // paddingBottom applied via useBottomInset (safe-area aware) inline.
      paddingTop: spacing.sm,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: spacing.sm,
    },
    heading: { color: colors.text, fontSize: 17, fontWeight: '700' },
    liveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.md,
    },
    liveText: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginLeft: spacing.xs },
    row: { marginTop: spacing.lg },
    rowTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
    rowBody: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: spacing.xs },
    button: {
      marginTop: spacing.xl,
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonText: { color: colors.primaryText, fontSize: 16, fontWeight: '700' },
  });
