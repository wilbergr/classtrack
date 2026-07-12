// The Spark shop section on Progress: spend the balance on themes, companion
// accessories, and celebration styles. Buying equips immediately; owned items
// toggle/equip for free.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { hapticSelect, playSound } from '../feedback';
import { listUnlocksAsync, spendAsync } from '../gamification/engine';
import { accessoryId, SHOP_ITEMS, type ShopItem } from '../gamification/shop';
import { useSettings } from '../hooks';
import { updateSettingsAsync } from '../settings';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';

interface Props {
  balance: number;
}

export default function SparkShop({ balance }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const settings = useSettings();
  const [owned, setOwned] = useState<Set<string>>(new Set());

  useEffect(() => {
    listUnlocksAsync().then((keys) => setOwned(new Set(keys)));
  }, []);

  const equip = useCallback(
    async (item: ShopItem) => {
      hapticSelect();
      if (item.kind === 'theme' && item.themeId) {
        await updateSettingsAsync({ themeId: item.themeId });
      } else if (item.kind === 'celebration' && item.celebration) {
        await updateSettingsAsync({ celebrationStyle: item.celebration });
      } else if (item.kind === 'accessory') {
        const id = accessoryId(item.key);
        const current = settings.accessories;
        await updateSettingsAsync({
          accessories: current.includes(id)
            ? current.filter((a) => a !== id)
            : [...current, id],
        });
      }
    },
    [settings.accessories],
  );

  const buy = useCallback(
    async (item: ShopItem) => {
      const result = await spendAsync(item.key, item.cost);
      if (result === 'ok') {
        playSound('tick');
        setOwned((prev) => new Set(prev).add(item.key));
        await equip(item);
      }
    },
    [equip],
  );

  const isEquipped = (item: ShopItem): boolean => {
    if (item.kind === 'theme') return settings.themeId === item.themeId;
    if (item.kind === 'celebration') return settings.celebrationStyle === item.celebration;
    return settings.accessories.includes(accessoryId(item.key));
  };

  const items =
    settings.companion === 'none'
      ? SHOP_ITEMS.filter((i) => i.kind !== 'accessory')
      : SHOP_ITEMS;

  return (
    <>
      <Text style={styles.sectionTitle}>Spark shop</Text>
      <View style={styles.card}>
        {items.map((item, idx) => {
          const has = owned.has(item.key);
          const equipped = isEquipped(item);
          const affordable = balance >= item.cost;
          return (
            <View key={item.key} style={[styles.itemRow, idx > 0 && styles.itemDivider]}>
              <View style={styles.itemBody}>
                <Text style={styles.itemLabel}>{item.label}</Text>
                <Text style={styles.itemDescription}>{item.description}</Text>
              </View>
              {has ? (
                <Pressable
                  onPress={() => equip(item)}
                  style={[styles.equipButton, equipped && styles.equippedButton]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: equipped }}
                >
                  <Text style={[styles.equipText, equipped && styles.equippedText]}>
                    {equipped ? (item.kind === 'accessory' ? 'On ✓' : 'In use ✓') : 'Use'}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => buy(item)}
                  disabled={!affordable}
                  style={[styles.buyButton, !affordable && styles.buyDisabled]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !affordable }}
                  accessibilityLabel={`Buy ${item.label} for ${item.cost} sparks`}
                >
                  <Text style={styles.buyText}>✦ {item.cost}</Text>
                </Pressable>
              )}
            </View>
          );
        })}
        <Text style={styles.hint}>
          Everything here is cosmetic and yours forever once unlocked. Nothing expires.
        </Text>
      </View>
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm + 2,
    },
    itemDivider: { borderTopWidth: 1, borderTopColor: colors.border },
    itemBody: { flex: 1, paddingRight: spacing.md },
    itemLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
    itemDescription: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
    buyButton: {
      backgroundColor: colors.primary,
      borderRadius: radius.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      minWidth: 68,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buyDisabled: { opacity: 0.4 },
    buyText: { color: colors.primaryText, fontSize: 14, fontWeight: '700' },
    equipButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      minWidth: 68,
      minHeight: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    equippedButton: { borderColor: colors.done, backgroundColor: colors.highlight },
    equipText: { color: colors.text, fontSize: 14, fontWeight: '600' },
    equippedText: { color: colors.done },
    hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: spacing.md },
  });
