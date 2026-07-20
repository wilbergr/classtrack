// The companion's stage: the app opens here. Your buddy greets you with the
// day's shape (speech bubbles from on-device templates — never a network
// call), the day card is a glance (never a list), and capture/Progress are
// one tap. With companion "None" this renders the calm orb home instead.

import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import Companion, { EnergyMeter, EnergyOrb } from '../components/Companion';
import EvolutionMoment from '../components/EvolutionMoment';
import QuickAddSheet from '../components/QuickAddSheet';
import SparkPill from '../components/SparkPill';
import SpeechBubble from '../components/SpeechBubble';
import { listOpenAssignmentsWithSubject, listSubjects } from '../db/database';
import { startOfDay } from '../dates';
import { deriveMood, stageForLevel, type CompanionStage } from '../gamification/companion';
import {
  getProgressSummaryAsync,
  getWeekSummaryAsync,
  settleMomentumAsync,
  type ProgressSummary,
} from '../gamification/engine';
import { onSpark } from '../gamification/events';
import {
  composeCelebration,
  composeGuidance,
  composeReaction,
  dayCounts,
  getRecentBubblesAsync,
  recordBubbleShownAsync,
  type DayCounts,
  type Utterance,
} from '../gamification/guidance';
import { levelProgress } from '../gamification/levels';
import { useCalmMotion, useSettings } from '../hooks';
import type { TabScreenProps } from '../navigation';
import { getSettingAsync, setSettingAsync } from '../settings';
import { mix } from '../components/companion/color';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { AssignmentWithSubject, VoicePackId } from '../types';

/** Settings key: startOfDay of the last Home greeting (one greeting per day). */
const LAST_GREET_KEY = 'lastHomeGreetDay';
/**
 * Settings key: the highest stage already celebrated with an evolution
 * moment. 0 = never set; it is then initialized silently to the current
 * stage so an update never replays history.
 */
const LAST_STAGE_KEY = 'lastSeenStage';
/** Queue lines rotate slowly; reaction lines clear back to the queue sooner. */
const ROTATE_MS = 12000;
const REACTION_MS = 6000;
const CELEBRATE_MS = 2600;

export default function HomeScreen({ navigation }: TabScreenProps<'Home'>) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const settings = useSettings();
  const { width } = useWindowDimensions();

  const [assignments, setAssignments] = useState<AssignmentWithSubject[]>([]);
  const [progress, setProgress] = useState<ProgressSummary | null>(null);
  const [hasSubjects, setHasSubjects] = useState(false);
  const [utterances, setUtterances] = useState<Utterance[]>([]);
  const [bubbleIdx, setBubbleIdx] = useState(0);
  /** A reaction/celebration line temporarily replacing the queue. */
  const [liveLine, setLiveLine] = useState<Utterance | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  /** Poking a dozing companion wakes it for this session (no economy touch). */
  const [woken, setWoken] = useState(false);
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [pendingEvolution, setPendingEvolution] = useState<{
    from: CompanionStage;
    to: CompanionStage;
  } | null>(null);
  const [evolutionVisible, setEvolutionVisible] = useState(false);
  /** Feeding presentation: Spark motes arc into the companion on awards. */
  const [feedSeq, setFeedSeq] = useState(0);
  const [feeding, setFeeding] = useState(false);
  const [pokeCount, setPokeCount] = useState(0);
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFocused = useIsFocused();
  const calm = useCalmMotion();

  const species = settings.companion === 'none' ? null : settings.companion;
  const isNone = species === null;
  const packId: VoicePackId = isNone ? 'plain' : settings.voicePack;
  const name = settings.companionName;

  const counts: DayCounts = useMemo(
    () => dayCounts(assignments, Date.now()),
    [assignments],
  );

  const mood = progress
    ? deriveMood({
        progress,
        hasOverdue: counts.overdue > 0,
        hasDueToday: counts.dueToday > 0,
        justAwarded: celebrating,
      })
    : 'bright';
  const effectiveMood = woken && mood === 'dozing' ? 'bright' : mood;

  const load = useCallback(async () => {
    await settleMomentumAsync();
    const now = Date.now();
    const [open, p, w, subjects, lastGreet, recent] = await Promise.all([
      listOpenAssignmentsWithSubject(),
      getProgressSummaryAsync(),
      getWeekSummaryAsync(now),
      listSubjects(),
      getSettingAsync<number>(LAST_GREET_KEY, 0),
      getRecentBubblesAsync(),
    ]);
    setAssignments(open);
    setProgress(p);
    setHasSubjects(subjects.length > 0);

    // Evolution detection: lifetime Sparks crossed a stage threshold since
    // the last celebrated stage (robust to awards earned on other screens).
    const stage = stageForLevel(p.level);
    const lastSeen = await getSettingAsync<number>(LAST_STAGE_KEY, 0);
    if (lastSeen === 0 || species === null) {
      // First run (or no mascot): initialize silently, never replay history.
      if (stage !== lastSeen) await setSettingAsync(LAST_STAGE_KEY, stage);
    } else if (stage > lastSeen) {
      setPendingEvolution({ from: lastSeen as CompanionStage, to: stage });
    }

    const today = startOfDay(now);
    const firstOpenToday = lastGreet < today;
    if (firstOpenToday) await setSettingAsync(LAST_GREET_KEY, today);

    const c = dayCounts(open, now);
    const dozing =
      !woken &&
      deriveMood({
        progress: p,
        hasOverdue: c.overdue > 0,
        hasDueToday: c.dueToday > 0,
        justAwarded: false,
      }) === 'dozing';

    setUtterances(
      composeGuidance(
        {
          now,
          companionName: name,
          hasCompanion: species !== null,
          packId,
          assignments: open,
          progress: p,
          week: w,
          firstOpenToday,
          dozing,
        },
        recent,
      ),
    );
    setBubbleIdx(0);
  }, [name, packId, woken, species]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Celebrate awards live: mood + a celebrate/level-up line, then reload.
  useEffect(() => {
    const off = onSpark(async (e) => {
      if (e.total > 0 || e.leveledUp) {
        setCelebrating(true);
        setWoken(true); // earning always wakes a dozing buddy
        if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
        celebrateTimer.current = setTimeout(() => setCelebrating(false), CELEBRATE_MS);
        // The feeding moment: motes arc into the companion (presentation
        // only — SparkBurst still owns sound/haptic/toast).
        setFeedSeq((n) => n + 1);
        setFeeding(true);
        if (feedTimer.current) clearTimeout(feedTimer.current);
        feedTimer.current = setTimeout(() => setFeeding(false), 1100);
        const recent = await getRecentBubblesAsync();
        const u = composeCelebration({ packId, companionName: name, now: Date.now() }, e, recent);
        if (u) setLiveLine(u);
      }
      load();
    });
    return () => {
      off();
      if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
      if (feedTimer.current) clearTimeout(feedTimer.current);
    };
  }, [load, packId, name]);

  // Slow rotation through the queue; reaction lines clear back sooner.
  useEffect(() => {
    if (liveLine) {
      const t = setTimeout(() => setLiveLine(null), REACTION_MS);
      return () => clearTimeout(t);
    }
    if (bubbleIdx < utterances.length - 1) {
      const t = setTimeout(() => setBubbleIdx((i) => i + 1), ROTATE_MS);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [liveLine, bubbleIdx, utterances]);

  // Play a pending evolution once Home is actually on stage (not mid-capture).
  useEffect(() => {
    if (pendingEvolution && isFocused && !quickAddVisible && species !== null) {
      setEvolutionVisible(true);
    }
  }, [pendingEvolution, isFocused, quickAddVisible, species]);

  const closeEvolution = useCallback(async () => {
    setEvolutionVisible(false);
    const evolved = pendingEvolution;
    setPendingEvolution(null);
    if (evolved) {
      await setSettingAsync(LAST_STAGE_KEY, evolved.to);
      const recent = await getRecentBubblesAsync();
      const u = composeReaction(
        'evolve',
        { packId, companionName: name, now: Date.now() },
        progress?.level ?? 1,
        recent,
      );
      if (u) setLiveLine(u);
    }
  }, [pendingEvolution, packId, name, progress]);

  const current = liveLine ?? utterances[bubbleIdx] ?? null;

  // The recent-ring records what was actually shown.
  useEffect(() => {
    if (current) recordBubbleShownAsync(current.key).catch(() => undefined);
  }, [current]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <SparkPill onPress={() => navigation.navigate('Progress')} />,
    });
  }, [navigation]);

  /** Bubble tap: next line in the queue (wraps for a re-read). */
  const advance = useCallback(() => {
    if (liveLine) {
      setLiveLine(null);
      return;
    }
    if (utterances.length > 1) setBubbleIdx((i) => (i + 1) % utterances.length);
  }, [liveLine, utterances.length]);

  /** Companion tap (poke): affection, not a mechanic. Wakes a dozing buddy. */
  const poke = useCallback(async () => {
    setPokeCount((n) => n + 1);
    const recent = await getRecentBubblesAsync();
    const level = progress?.level ?? 1;
    if (mood === 'dozing' && !woken) {
      setWoken(true);
      const u = composeReaction(
        'comeback',
        { packId, companionName: name, now: Date.now() },
        level,
        recent,
      );
      if (u) setLiveLine(u);
      return;
    }
    const u = composeReaction(
      'idlePoke',
      { packId, companionName: name, now: Date.now() },
      level,
      recent,
    );
    if (u) setLiveLine(u);
  }, [mood, woken, packId, name, progress]);

  const guardSubjects = useCallback(() => {
    if (hasSubjects) return true;
    Alert.alert('No subjects yet', 'Create a subject first, then add assignments to it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Go to Subjects', onPress: () => navigation.navigate('Subjects') },
    ]);
    return false;
  }, [hasSubjects, navigation]);

  const lp = progress ? levelProgress(progress.lifetime) : null;
  // The companion is the star of the screen — it grew when the name/stage
  // label moved into its own speech bubble (the 'identity' line). Renaming
  // lives in Settings → Sidekick.
  const companionSize = Math.min(320, Math.max(240, Math.round(width * 0.72)));
  const tint = species === null ? colors.primary : colors.companion[species];
  // Day-phase tinting: the ambient glow leans warm in the morning and cool
  // in the evening (decorative only — recomputed on each visit).
  const hour = new Date().getHours();
  const glowTint =
    hour >= 5 && hour < 11
      ? mix(tint, colors.dayPhase.morning, 0.4)
      : hour >= 17 || hour < 5
        ? mix(tint, colors.dayPhase.evening, 0.4)
        : tint;

  const dayLabel =
    counts.dueToday === 0 && counts.dueTomorrow === 0
      ? 'Nothing due today'
      : [
          counts.dueToday > 0 ? `${counts.dueToday} due today` : null,
          counts.dueTomorrow > 0 ? `${counts.dueTomorrow} tomorrow` : null,
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    <View style={styles.container}>
      <AmbientBackground tint={glowTint} />
      <View style={styles.stage}>
        <View style={styles.bubbleSlot}>
          {current && <SpeechBubble text={current.text} onPress={advance} plain={isNone} />}
        </View>

        {species !== null ? (
          <Pressable
            onPress={poke}
            accessibilityRole="button"
            accessibilityLabel={`Say hi to ${name}`}
            style={styles.companionPress}
          >
            <Companion
              species={species}
              mood={effectiveMood}
              stage={stageForLevel(lp?.level ?? 1)}
              size={companionSize}
              accessories={settings.accessories}
              pokeSignal={pokeCount}
              shields={progress?.grace ?? 0}
            />
            {feeding && !calm && <FeedMotes key={feedSeq} size={companionSize} tint={tint} />}
          </Pressable>
        ) : (
          <View
            style={styles.companionPress}
            accessibilityRole="progressbar"
            accessibilityLabel={`Level ${lp?.level ?? 1}`}
            accessibilityValue={
              lp ? { min: 0, max: lp.span, now: lp.into } : undefined
            }
          >
            <EnergyOrb fraction={lp?.fraction ?? 0} size={companionSize * 0.8} />
          </View>
        )}

        {isNone && lp && (
          <Text style={styles.nameText}>Level {lp.level}</Text>
        )}

        <Pressable
          onPress={() => navigation.navigate('Today')}
          style={({ pressed }) => [styles.dayCard, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${dayLabel}. Opens Today.`}
        >
          <View style={styles.dayCardRow}>
            <View style={styles.dayDots}>
              {counts.dueToday > 0 && (
                <View style={[styles.dot, { backgroundColor: colors.ramp.today }]} />
              )}
              {counts.dueTomorrow > 0 && (
                <View style={[styles.dot, { backgroundColor: colors.ramp.tomorrow }]} />
              )}
              {counts.dueToday === 0 && counts.dueTomorrow === 0 && (
                <View style={[styles.dot, { backgroundColor: colors.done }]} />
              )}
            </View>
            <Text style={styles.dayText}>{dayLabel}</Text>
            <Text style={styles.dayChevron}>›</Text>
          </View>
          {/* Soft glance at the next form — never a countdown. */}
          {lp && <EnergyMeter fraction={lp.fraction} width={180} height={4} />}
        </Pressable>

        <View style={styles.actionRow}>
          <Pressable
            onPress={() => {
              if (guardSubjects()) setQuickAddVisible(true);
            }}
            style={({ pressed }) => [styles.actionButton, styles.actionPrimary, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Add assignment"
          >
            <Text style={styles.actionPrimaryText}>＋ Add</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Progress')}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Open Progress"
          >
            <Text style={styles.actionText}>✦ Progress</Text>
          </Pressable>
        </View>
      </View>

      <QuickAddSheet
        visible={quickAddVisible}
        onClose={() => setQuickAddVisible(false)}
        onAdded={load}
        onAllDetails={(draft) => {
          setQuickAddVisible(false);
          navigation.navigate('AssignmentEdit', { draft });
        }}
      />
      {species !== null && pendingEvolution && (
        <EvolutionMoment
          visible={evolutionVisible}
          species={species}
          accessories={settings.accessories}
          name={name}
          fromStage={pendingEvolution.from}
          toStage={pendingEvolution.to}
          onClose={closeEvolution}
        />
      )}
    </View>
  );
}

/**
 * Full-bleed radial glow in the companion's tint plus a few soft shapes on a
 * slow parallax drift (wrapper transforms only; static under calm motion).
 */
function AmbientBackground({ tint }: { tint: string }) {
  const calm = useCalmMotion();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="homeGlow" cx="50%" cy="28%" r="75%">
            <Stop offset="0" stopColor={tint} stopOpacity={0.22} />
            <Stop offset="1" stopColor={tint} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#homeGlow)" />
      </Svg>
      {!calm && DRIFT_SPECS.map((d, i) => <DriftShape key={i} spec={d} tint={tint} />)}
    </View>
  );
}

// ---------- the feeding moment ----------

const FEED_ANGLES = [205, 245, 285, 325, 25].map((d) => (d * Math.PI) / 180);

/** Spark motes arc from the edges into the companion when Sparks land. */
function FeedMotes({ size, tint }: { size: number; tint: string }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {FEED_ANGLES.map((a, i) => (
        <FeedMote key={i} angle={a} delayMs={i * 70} size={size} tint={tint} />
      ))}
    </View>
  );
}

function FeedMote({
  angle,
  delayMs,
  size,
  tint,
}: {
  angle: number;
  delayMs: number;
  size: number;
  tint: string;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delayMs, withTiming(1, { duration: 650, easing: Easing.in(Easing.quad) }));
    return () => cancelAnimation(t);
  }, [t, delayMs]);
  const style = useAnimatedStyle(() => {
    const r = (1 - t.value) * size * 0.72;
    const fadeIn = Math.min(1, t.value / 0.15);
    const fadeOut = t.value > 0.85 ? (1 - t.value) / 0.15 : 1;
    return {
      opacity: fadeIn * fadeOut,
      transform: [
        { translateX: Math.cos(angle) * r },
        { translateY: Math.sin(angle) * r },
        { scale: 1 - 0.45 * t.value },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: size / 2 - 5,
          top: size / 2 - 5,
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: tint,
        },
        style,
      ]}
    />
  );
}

interface DriftSpec {
  left: `${number}%`;
  top: `${number}%`;
  size: number;
  durationMs: number;
  dx: number;
  dy: number;
  opacity: number;
}

const DRIFT_SPECS: DriftSpec[] = [
  { left: '8%', top: '12%', size: 90, durationMs: 11000, dx: 16, dy: 12, opacity: 0.08 },
  { left: '70%', top: '8%', size: 60, durationMs: 9000, dx: -14, dy: 16, opacity: 0.1 },
  { left: '78%', top: '46%', size: 110, durationMs: 13000, dx: -18, dy: -10, opacity: 0.06 },
  { left: '4%', top: '58%', size: 70, durationMs: 10000, dx: 14, dy: -14, opacity: 0.08 },
];

function DriftShape({ spec, tint }: { spec: DriftSpec; tint: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: spec.durationMs, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(t);
  }, [t, spec.durationMs]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: spec.dx * t.value }, { translateY: spec.dy * t.value }],
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: spec.left,
          top: spec.top,
          width: spec.size,
          height: spec.size,
          borderRadius: spec.size / 2,
          backgroundColor: tint,
          opacity: spec.opacity,
        },
        style,
      ]}
    />
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    stage: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
    },
    bubbleSlot: { minHeight: 84, justifyContent: 'flex-end', marginBottom: spacing.sm },
    companionPress: { alignItems: 'center', justifyContent: 'center', minWidth: 48, minHeight: 48 },
    nameText: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: spacing.xs },
    dayCard: {
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.xl,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      minHeight: 48,
    },
    dayCardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    dayDots: { flexDirection: 'row', gap: 4 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    dayText: { color: colors.text, fontSize: 15, fontWeight: '600' },
    dayChevron: { color: colors.textMuted, fontSize: 18, fontWeight: '600', marginLeft: spacing.xs },
    actionRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
    actionButton: {
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 48,
      justifyContent: 'center',
    },
    actionPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
    actionPrimaryText: { color: colors.primaryText, fontSize: 16, fontWeight: '700' },
    actionText: { color: colors.text, fontSize: 16, fontWeight: '700' },
    pressed: { opacity: 0.85 },
  });
