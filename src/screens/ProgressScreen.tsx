// The reward you peek at: level ring, Spark balance, momentum meter with
// grace shields, and this-week totals from the ledger. Pushed from the
// Spark pill — deliberately not a fourth tab.

// The companion itself now lives large on Home — this screen stays the
// numbers-and-shop peek behind the Spark pill.

import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import EvolutionMoment from '../components/EvolutionMoment';
import SparkShop from '../components/SparkShop';
import { stageForLevel, STAGE_NAMES, type CompanionStage } from '../gamification/companion';
import {
  getProgressSummaryAsync,
  getWeekSummaryAsync,
  settleMomentumAsync,
  GRACE_CAP,
  type ProgressSummary,
  type WeekSummary,
} from '../gamification/engine';
import { onProgressChanged } from '../gamification/events';
import { levelProgress } from '../gamification/levels';
import { useSettings } from '../hooks';
import type { RootStackScreenProps } from '../navigation';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';

const RING_SIZE = 132;
const RING_STROKE = 10;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;

export default function ProgressScreen(_props: RootStackScreenProps<'Progress'>) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [week, setWeek] = useState<WeekSummary | null>(null);
  const [showEvolution, setShowEvolution] = useState(false);
  const settings = useSettings();

  const load = useCallback(async () => {
    await settleMomentumAsync();
    const [p, w] = await Promise.all([getProgressSummaryAsync(), getWeekSummaryAsync()]);
    setProgress(p);
    setWeek(w);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      return onProgressChanged(load);
    }, [load]),
  );

  if (!progress) return <View style={styles.container} />;

  const lp = levelProgress(progress.lifetime);
  const toNext = lp.span - lp.into;
  const stage = stageForLevel(lp.level);
  const species = settings.companion === 'none' ? null : settings.companion;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View
          style={styles.ringWrap}
          accessibilityRole="progressbar"
          accessibilityLabel={`Level ${lp.level}`}
          accessibilityValue={{ min: 0, max: lp.span, now: lp.into }}
        >
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_R}
              stroke={colors.border}
              strokeWidth={RING_STROKE}
              fill="none"
            />
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_R}
              stroke={colors.spark}
              strokeWidth={RING_STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${RING_C}`}
              strokeDashoffset={RING_C * (1 - lp.fraction)}
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          </Svg>
          <View style={styles.ringCenter}>
            <Text style={styles.ringLevelLabel}>LEVEL</Text>
            <Text style={styles.ringLevel}>{lp.level}</Text>
          </View>
        </View>
        <Text style={styles.balance}>✦ {progress.balance}</Text>
        <Text style={styles.balanceHint}>
          {toNext} more to level {lp.level + 1} · {progress.lifetime} earned all-time
        </Text>
      </View>

      {species !== null && stage >= 2 && (
        <Pressable
          onPress={() => setShowEvolution(true)}
          style={({ pressed }) => [styles.evolutionRow, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel={`See evolution. Current form: ${STAGE_NAMES[stage]}.`}
        >
          <Text style={styles.evolutionText}>✦ See evolution</Text>
          <Text style={styles.evolutionStage}>{STAGE_NAMES[stage]}</Text>
        </Pressable>
      )}
      {species !== null && stage >= 2 && (
        <EvolutionMoment
          visible={showEvolution}
          species={species}
          accessories={settings.accessories}
          name={settings.companionName}
          fromStage={(stage - 1) as CompanionStage}
          toStage={stage}
          onClose={() => setShowEvolution(false)}
        />
      )}

      <Text style={styles.sectionTitle}>Momentum</Text>
      <View style={styles.card}>
        <View style={styles.momentumRow}>
          <Text
            style={styles.momentumValue}
            accessibilityLabel={`Momentum ${progress.momentum}, best ${progress.bestMomentum}`}
          >
            {progress.momentum}
          </Text>
          <View style={styles.momentumMeta}>
            <Text style={styles.momentumBest}>Best: {progress.bestMomentum}</Text>
            <View
              style={styles.shieldRow}
              accessibilityLabel={`${progress.grace} of ${GRACE_CAP} shields ready`}
            >
              {Array.from({ length: GRACE_CAP }, (_, i) => (
                <Text
                  key={i}
                  style={[styles.shield, i >= progress.grace && styles.shieldResting]}
                >
                  🛡
                </Text>
              ))}
              <Text style={styles.shieldLabel}>
                {progress.grace === GRACE_CAP
                  ? 'shields ready'
                  : progress.grace > 0
                    ? 'shield ready'
                    : 'shields resting'}
              </Text>
            </View>
          </View>
        </View>
        <Text style={styles.hint}>
          Momentum grows every day you add or finish something. Quiet days are covered by your
          shields — they come back every Monday.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>This week</Text>
      <View style={styles.card}>
        <View style={styles.weekRow}>
          <View style={styles.weekStat}>
            <Text style={[styles.weekValue, { color: colors.spark }]}>✦ {week?.earned ?? 0}</Text>
            <Text style={styles.weekLabel}>sparks</Text>
          </View>
          <View style={styles.weekStat}>
            <Text style={styles.weekValue}>{week?.completed ?? 0}</Text>
            <Text style={styles.weekLabel}>finished</Text>
          </View>
          <View style={styles.weekStat}>
            <Text style={styles.weekValue}>{week?.captured ?? 0}</Text>
            <Text style={styles.weekLabel}>added</Text>
          </View>
        </View>
      </View>

      <SparkShop balance={progress.balance} />
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    padding: spacing.xl,
  },
  evolutionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
    minHeight: 48,
  },
  evolutionText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  evolutionStage: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  ringWrap: { width: RING_SIZE, height: RING_SIZE },
  ringCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLevelLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  ringLevel: { color: colors.text, fontSize: 40, fontWeight: '800', lineHeight: 44 },
  balance: { color: colors.text, fontSize: 26, fontWeight: '800', marginTop: spacing.md },
  balanceHint: { color: colors.textMuted, fontSize: 13, marginTop: spacing.xs },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  momentumRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  momentumValue: { color: colors.spark, fontSize: 44, fontWeight: '800' },
  momentumMeta: { flex: 1 },
  momentumBest: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  shieldRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  shield: { fontSize: 16, marginRight: 2 },
  shieldResting: { opacity: 0.25 },
  shieldLabel: { color: colors.textMuted, fontSize: 12, marginLeft: spacing.xs },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: spacing.md },
  weekRow: { flexDirection: 'row', justifyContent: 'space-around' },
  weekStat: { alignItems: 'center' },
  weekValue: { color: colors.text, fontSize: 22, fontWeight: '800' },
  weekLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
