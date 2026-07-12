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
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
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
import {
  deriveMood,
  stageForLevel,
  STAGE_NAMES,
  type CompanionStage,
} from '../gamification/companion';
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
import { getSettingAsync, setSettingAsync, updateSettingsAsync } from '../settings';
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
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [pendingEvolution, setPendingEvolution] = useState<{
    from: CompanionStage;
    to: CompanionStage;
  } | null>(null);
  const [evolutionVisible, setEvolutionVisible] = useState(false);
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFocused = useIsFocused();

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
        const recent = await getRecentBubblesAsync();
        const u = composeCelebration({ packId, companionName: name, now: Date.now() }, e, recent);
        if (u) setLiveLine(u);
      }
      load();
    });
    return () => {
      off();
      if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
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

  const commitName = useCallback(async () => {
    setEditingName(false);
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== name) await updateSettingsAsync({ companionName: trimmed });
  }, [nameDraft, name]);

  const lp = progress ? levelProgress(progress.lifetime) : null;
  const companionSize = Math.min(260, Math.max(220, Math.round(width * 0.6)));
  const tint = species === null ? colors.primary : colors.companion[species];

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
      <AmbientBackground tint={tint} />
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
            />
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

        {!isNone &&
          (editingName ? (
            <TextInput
              value={nameDraft}
              onChangeText={setNameDraft}
              onEndEditing={commitName}
              onSubmitEditing={commitName}
              autoFocus
              maxLength={24}
              style={styles.nameInput}
              returnKeyType="done"
            />
          ) : (
            <Pressable
              onPress={() => {
                setNameDraft(name);
                setEditingName(true);
              }}
              accessibilityRole="button"
              accessibilityHint="Rename"
              style={styles.nameChip}
            >
              <Text style={styles.nameText}>
                {name} · {STAGE_NAMES[stageForLevel(lp?.level ?? 1)]}
              </Text>
            </Pressable>
          ))}
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
    nameChip: {
      marginTop: spacing.sm,
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.md,
      borderRadius: 999,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 32,
    },
    nameText: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: spacing.xs },
    nameInput: {
      marginTop: spacing.sm,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.card,
      minWidth: 160,
      textAlign: 'center',
    },
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
