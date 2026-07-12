// Compact companion presence for the Today header: perks up on Spark awards,
// tracks the day's state on every reload. Renders nothing for "None" — the
// Spark pill's ring already carries the energy there.

import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import Companion from './Companion';
import { getProgressAsync } from '../gamification/engine';
import { onProgressChanged, onSpark } from '../gamification/events';
import { deriveMood, stageForLevel } from '../gamification/companion';
import { levelForLifetime } from '../gamification/levels';
import { useSettings } from '../hooks';
import type { Progress } from '../types';

interface Props {
  hasOverdue: boolean;
  hasDueToday: boolean;
}

const CELEBRATE_MS = 2600;

export default function CompanionHeader({ hasOverdue, hasDueToday }: Props) {
  const settings = useSettings();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      getProgressAsync().then((p) => {
        if (mounted) setProgress(p);
      });
    };
    refresh();
    const offProgress = onProgressChanged(refresh);
    const offSpark = onSpark(() => {
      setCelebrating(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCelebrating(false), CELEBRATE_MS);
    });
    return () => {
      mounted = false;
      offProgress();
      offSpark();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (settings.companion === 'none' || !progress) return null;

  const mood = deriveMood({
    progress,
    hasOverdue,
    hasDueToday,
    justAwarded: celebrating,
  });

  return (
    <View>
      <Companion
        species={settings.companion}
        mood={mood}
        stage={stageForLevel(levelForLifetime(progress.lifetime))}
        size={34}
      />
    </View>
  );
}
