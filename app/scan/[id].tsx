import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Linking from 'expo-linking';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { ChevronLeft, CookingPot, MapPin, Navigation, Share2, ShieldAlert, Sparkles, Trash2 } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { useCookbook } from '@/app/providers/CookbookProvider';
import { useScanJournal, type ScanJournalChatMessage } from '@/app/providers/ScanJournalProvider';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section} testID={`scan-details-section-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Pill({ text, tone }: { text: string; tone: 'good' | 'warn' | 'bad' | 'neutral' }) {
  const bg =
    tone === 'good'
      ? 'rgba(56,217,137,0.14)'
      : tone === 'warn'
        ? 'rgba(246,196,69,0.14)'
        : tone === 'bad'
          ? 'rgba(255,92,92,0.14)'
          : 'rgba(138,253,87,0.10)';

  const border =
    tone === 'good'
      ? 'rgba(56,217,137,0.35)'
      : tone === 'warn'
        ? 'rgba(246,196,69,0.35)'
        : tone === 'bad'
          ? 'rgba(255,92,92,0.35)'
          : 'rgba(155,179,164,0.25)';

  const color =
    tone === 'good' ? COLORS.primary : tone === 'warn' ? COLORS.warning : tone === 'bad' ? COLORS.error : COLORS.textSecondary;

  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.pillText, { color }]}>{text}</Text>
    </View>
  );
}

export default function ScanDetailsScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const entryId = typeof id === 'string' ? id : '';

  const { getEntryById, updateEntry, removeEntry } = useScanJournal();
  const { addFromScanEntry, getEntryByScanId } = useCookbook();
  const entry = getEntryById(entryId);
  const cookAlreadySaved = entry ? Boolean(getEntryByScanId(entry.id)) : false;

  const [titleDraft, setTitleDraft] = useState<string>(entry?.title ?? '');
  const [notesDraft, setNotesDraft] = useState<string>(entry?.notes ?? '');
  const [locationNameDraft, setLocationNameDraft] = useState<string>(entry?.locationName ?? '');
  const [latDraft, setLatDraft] = useState<string>(entry?.location ? String(entry.location.latitude) : '');
  const [lngDraft, setLngDraft] = useState<string>(entry?.location ? String(entry.location.longitude) : '');

  useEffect(() => {
    if (!entry) return;
    setTitleDraft(entry.title ?? '');
    setNotesDraft(entry.notes ?? '');
    setLocationNameDraft(entry.locationName ?? '');
    setLatDraft(entry.location ? String(entry.location.latitude) : '');
    setLngDraft(entry.location ? String(entry.location.longitude) : '');
  }, [entry]);

  const safetyTone = useMemo((): 'good' | 'warn' | 'bad' => {
    const status = entry?.scan?.safety?.status;
    if (status === 'safe') return 'good';
    if (status === 'unsafe') return 'bad';
    return 'warn';
  }, [entry?.scan?.safety?.status]);

  const createdLabel = useMemo(() => {
    if (!entry?.createdAt) return '';
    try {
      return new Date(entry.createdAt).toLocaleString('en-AU', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }, [entry?.createdAt]);

  const onSaveTitle = useCallback(async () => {
    if (!entry) return;

    const nextTitle = titleDraft.trim();
    if (nextTitle.length === 0) {
      Alert.alert('Title required', 'Please enter a title.');
      return;
    }

    try {
      await updateEntry(entry.id, { title: nextTitle });
      Alert.alert('Saved', 'Title updated.');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[ScanDetails] saveTitle failed', { message });
      Alert.alert('Could not save', 'Please try again.');
    }
  }, [entry, titleDraft, updateEntry]);

  const buildShareText = useCallback(() => {
    if (!entry) return '';

    const lines: string[] = [];
    lines.push(entry.title);
    lines.push(entry.scan.scientificName ? `${entry.scan.commonName} (${entry.scan.scientificName})` : entry.scan.commonName);
    lines.push(`Safety: ${entry.scan.safety.status.toUpperCase()}`);
    lines.push(`Confidence: ${Math.round(entry.scan.confidence * 100)}%`);
    if (entry.locationName) lines.push(`Location: ${entry.locationName}`);
    if (entry.notes) lines.push(`Notes: ${entry.notes}`);

    return lines.filter((l) => l.trim().length > 0).join('\n');
  }, [entry]);

  const shareSummary = useCallback(async () => {
    if (!entry) return;

    const message = buildShareText();

    try {
      console.log('[ScanDetails] shareSummary', { entryId: entry.id });
      await Share.share({ message, title: entry.title });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.log('[ScanDetails] shareSummary failed', { errMsg });
      Alert.alert('Share not available', message);
    }
  }, [buildShareText, entry]);

  const sharePhoto = useCallback(async () => {
    if (!entry) return;

    const imageUri = entry.imageUri;
    if (!imageUri) {
      Alert.alert('No photo saved', 'This scan does not have an attached photo to share.');
      return;
    }

    if (Platform.OS === 'web') {
      const message = buildShareText();
      try {
        console.log('[ScanDetails] sharePhoto(web): opening image', { imageUri });
        Linking.openURL(imageUri);
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.log('[ScanDetails] sharePhoto(web) failed', { errMsg });
      }
      try {
        await Share.share({ message, title: entry.title });
      } catch {
        Alert.alert('Photo link', imageUri);
      }
      return;
    }

    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Sharing not available', 'Your device does not support sharing files.');
        return;
      }

      const fileName = `scan-${entry.id}.jpg`;
      const cacheDirUri = FileSystem.Paths.cache?.uri ?? '';
      if (cacheDirUri.length === 0) {
        throw new Error('No cache directory available');
      }
      const dest = `${cacheDirUri}${fileName}`;

      if (imageUri.startsWith('file://')) {
        console.log('[ScanDetails] sharePhoto: shareAsync(local file)', { uri: imageUri, platform: Platform.OS });
        await Sharing.shareAsync(imageUri, {
          dialogTitle: `Share ${entry.title}`,
          mimeType: 'image/jpeg',
          UTI: 'public.jpeg',
        });
        return;
      }

      if (imageUri.startsWith('content://')) {
        console.log('[ScanDetails] sharePhoto: copyAsync(content uri)', { from: imageUri, to: dest, platform: Platform.OS });
        await FileSystem.copyAsync({ from: imageUri, to: dest });

        console.log('[ScanDetails] sharePhoto: shareAsync(copied content uri)', { uri: dest });
        await Sharing.shareAsync(dest, {
          dialogTitle: `Share ${entry.title}`,
          mimeType: 'image/jpeg',
          UTI: 'public.jpeg',
        });
        return;
      }

      console.log('[ScanDetails] sharePhoto: downloadAsync(remote)', { from: imageUri, to: dest, platform: Platform.OS });
      const download = await FileSystem.downloadAsync(imageUri, dest);

      console.log('[ScanDetails] sharePhoto: shareAsync(downloaded)', { uri: download.uri });
      await Sharing.shareAsync(download.uri, {
        dialogTitle: `Share ${entry.title}`,
        mimeType: 'image/jpeg',
        UTI: 'public.jpeg',
      });
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.log('[ScanDetails] sharePhoto failed', { errMsg });
      Alert.alert('Could not share photo', errMsg || 'Please try again.');
    }
  }, [buildShareText, entry]);

  const onShare = useCallback(() => {
    if (!entry) return;

    Alert.alert('Share', 'What would you like to share?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Scan summary', onPress: () => shareSummary() },
      { text: 'Photo', onPress: () => sharePhoto() },
    ]);
  }, [entry, sharePhoto, shareSummary]);

  const onAddToCook = useCallback(async () => {
    if (!entry) return;
    if (cookAlreadySaved) {
      Alert.alert('Already in Cook', 'This scan is already in your Cook list.');
      return;
    }

    try {
      const saved = await addFromScanEntry(entry);
      console.log('[ScanDetails] addToCook success', { cookId: saved.id, scanEntryId: entry.id });
      Alert.alert('Added to Cook', 'You can now find recipes for this in the Cook tab.', [
        { text: 'OK' },
        {
          text: 'Open Cook',
          onPress: () => {
            router.push('/cook');
          },
        },
      ]);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[ScanDetails] addToCook failed', { message, scanEntryId: entry.id, title: entry.title, commonName: entry.scan?.commonName });
      Alert.alert('Could not add to Cook', message || 'Please try again.');
    }
  }, [addFromScanEntry, cookAlreadySaved, entry]);

  const onSave = useCallback(async () => {
    if (!entry) return;

    const lat = latDraft.trim().length > 0 ? Number(latDraft) : null;
    const lng = lngDraft.trim().length > 0 ? Number(lngDraft) : null;

    const location =
      lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng) ? { latitude: lat, longitude: lng } : undefined;

    try {
      await updateEntry(entry.id, {
        notes: notesDraft,
        locationName: locationNameDraft.trim().length > 0 ? locationNameDraft.trim() : undefined,
        location,
      });
      Alert.alert('Saved', 'Your notes were saved to this scan.');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[ScanDetails] save failed', { message });
      Alert.alert('Could not save', 'Please try again.');
    }
  }, [entry, latDraft, lngDraft, locationNameDraft, notesDraft, updateEntry]);

  const onUseCurrentLocation = useCallback(async () => {
    if (!entry) return;

    if (Platform.OS === 'web') {
      Alert.alert('Not supported on web', 'Please enter coordinates manually when using the web preview.');
      return;
    }

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Location permission is required to fetch your current location.');
        return;
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLatDraft(String(pos.coords.latitude));
      setLngDraft(String(pos.coords.longitude));

      updateEntry(entry.id, {
        location: {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        },
      }).catch((e) => {
        const message = e instanceof Error ? e.message : String(e);
        console.log('[ScanDetails] updateEntry(location) failed', { message });
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[ScanDetails] getCurrentPosition failed', { message });
      Alert.alert('Could not fetch location', 'Please try again or enter it manually.');
    }
  }, [entry, updateEntry]);

  const onDelete = useCallback(() => {
    if (!entry) return;
    Alert.alert('Remove scan?', 'This will remove it from your collection.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          removeEntry(entry.id)
            .then(() => {
              router.back();
            })
            .catch((e) => {
              const message = e instanceof Error ? e.message : String(e);
              console.log('[ScanDetails] removeEntry failed', { message });
              Alert.alert('Could not remove', 'Please try again.');
            });
        },
      },
    ]);
  }, [entry, removeEntry]);

  const chatHistory = useMemo((): ScanJournalChatMessage[] => {
    const ch = entry?.chatHistory;
    return Array.isArray(ch) ? ch : [];
  }, [entry?.chatHistory]);

  if (!entry) {
    return (
      <View style={styles.container} testID="scan-details-missing">
        <Stack.Screen options={{ title: 'Scan Details', headerShown: false }} />
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              testID="scan-details-back"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ChevronLeft size={22} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.topTitle}>Scan Details</Text>
            <View style={{ width: 44 }} />
          </View>
          <View style={styles.missingCard}>
            <Text style={styles.missingTitle}>Scan not found</Text>
            <Text style={styles.missingText}>This scan might have been deleted or is still loading.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()} testID="scan-details-go-back">
              <Text style={styles.primaryButtonText}>Go back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="scan-details">
      <Stack.Screen options={{ title: 'Scan Details', headerShown: false }} />
      <View style={styles.heroBg} />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            testID="scan-details-back"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronLeft size={22} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.topTitle} numberOfLines={1}>
            {entry.title}
          </Text>
          <View style={styles.topActions}>
            <TouchableOpacity
              style={[styles.iconButton, cookAlreadySaved && styles.iconButtonDisabled]}
              onPress={onAddToCook}
              testID="scan-details-add-to-cook"
              disabled={cookAlreadySaved}
            >
              <CookingPot size={18} color={cookAlreadySaved ? COLORS.textSecondary : COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={onShare} testID="scan-details-share">
              <Share2 size={18} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.trashButton} onPress={onDelete} testID="scan-details-delete">
              <Trash2 size={18} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} testID="scan-details-scroll">
          <View style={styles.heroCard}>
            <Image
              source={{
                uri:
                  entry.imageUri ??
                  'https://images.unsplash.com/photo-1627916533550-c8f93e3d4899?q=80&w=1200&auto=format&fit=crop',
              }}
              style={styles.heroImage}
              contentFit="cover"
              testID="scan-details-image"
            />
            <View style={styles.heroOverlay}>
              <View style={styles.badgeRow}>
                <Pill
                  text={`Safety: ${entry.scan.safety.status.toUpperCase()}`}
                  tone={safetyTone}
                />
                <Pill text={`${Math.round(entry.scan.confidence * 100)}% confidence`} tone="neutral" />
              </View>
              <View style={styles.heroTitleRow}>
                <View style={styles.heroTitleStack}>
                  <Text style={styles.heroTitle}>{entry.scan.commonName}</Text>
                  {entry.scan.scientificName ? <Text style={styles.heroSubtitle}>{entry.scan.scientificName}</Text> : null}
                </View>
                <View style={styles.heroIcon}>
                  {entry.scan.safety.status === 'unsafe' ? (
                    <ShieldAlert size={22} color={COLORS.error} />
                  ) : (
                    <Sparkles size={22} color={COLORS.primary} />
                  )}
                </View>
              </View>
              {createdLabel ? <Text style={styles.heroMeta}>{createdLabel}</Text> : null}
            </View>
          </View>

          <Section title="Edit title">
            <TextInput
              value={titleDraft}
              onChangeText={setTitleDraft}
              placeholder="e.g. Backyard find"
              placeholderTextColor={COLORS.textSecondary}
              style={styles.fieldInputSolo}
              testID="scan-details-edit-title"
            />
            <TouchableOpacity style={styles.primaryButton} onPress={onSaveTitle} testID="scan-details-save-title">
              <Text style={styles.primaryButtonText}>Save title</Text>
            </TouchableOpacity>
          </Section>

          <Section title="Safety">
            <Text style={styles.bodyText}>{entry.scan.safety.summary || 'No safety summary available.'}</Text>
            {entry.scan.safety.keyRisks.length > 0 ? (
              <View style={styles.bullets}>
                {entry.scan.safety.keyRisks.map((risk, idx) => (
                  <View key={`${risk}-${idx}`} style={styles.bulletRow}>
                    <ShieldAlert size={16} color={COLORS.warning} />
                    <Text style={styles.bulletText}>{risk}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Section>

          <Section title="Prep steps">
            {entry.scan.preparation.steps.length > 0 ? (
              <View style={styles.bullets}>
                {entry.scan.preparation.steps.map((step, idx) => (
                  <View key={`${step}-${idx}`} style={styles.bulletRow}>
                    <Text style={styles.stepIndex}>{idx + 1}</Text>
                    <Text style={styles.bulletText}>{step}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.bodyText}>No preparation steps provided.</Text>
            )}
          </Section>

          <Section title="Seasonality">
            {entry.scan.seasonality.bestMonths.length > 0 ? (
              <View style={styles.pillRow}>
                {entry.scan.seasonality.bestMonths.map((m) => (
                  <Pill key={m} text={m} tone="neutral" />
                ))}
              </View>
            ) : null}
            {entry.scan.seasonality.notes ? <Text style={[styles.bodyText, { marginTop: 8 }]}>{entry.scan.seasonality.notes}</Text> : null}
            {!entry.scan.seasonality.notes && entry.scan.seasonality.bestMonths.length === 0 ? (
              <Text style={styles.bodyText}>No seasonality info provided.</Text>
            ) : null}
          </Section>

          {entry.scan.warnings.length > 0 ? (
            <Section title="Warnings / lookalikes">
              <View style={styles.bullets}>
                {entry.scan.warnings.map((w, idx) => (
                  <View key={`${w}-${idx}`} style={styles.bulletRow}>
                    <AlertIcon />
                    <Text style={styles.bulletText}>{w}</Text>
                  </View>
                ))}
              </View>
            </Section>
          ) : null}

          {entry.scan.suggestedUses.length > 0 ? (
            <Section title="Suggested uses">
              <View style={styles.bullets}>
                {entry.scan.suggestedUses.map((u, idx) => (
                  <View key={`${u}-${idx}`} style={styles.bulletRow}>
                    <Sparkles size={16} color={COLORS.secondary} />
                    <Text style={styles.bulletText}>{u}</Text>
                  </View>
                ))}
              </View>
            </Section>
          ) : null}

          <Section title="Cultural knowledge">
            <Text style={styles.bodyText}>{entry.scan.culturalKnowledge.notes || 'No cultural notes provided.'}</Text>
            {entry.scan.culturalKnowledge.respect.length > 0 ? (
              <View style={[styles.bullets, { marginTop: 10 }]}>
                {entry.scan.culturalKnowledge.respect.map((r, idx) => (
                  <View key={`${r}-${idx}`} style={styles.bulletRow}>
                    <Sparkles size={16} color={COLORS.primary} />
                    <Text style={styles.bulletText}>{r}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Section>

          <Section title="Chat history">
            {chatHistory.length === 0 ? (
              <Text style={styles.bodyText}>No chat history saved for this scan yet.</Text>
            ) : (
              <View style={styles.chatList}>
                {chatHistory.map((m) => (
                  <View
                    key={m.id}
                    style={[styles.chatBubble, m.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAssistant]}
                    testID={`scan-details-chat-${m.role}-${m.id}`}
                  >
                    <Text style={styles.chatRole}>{m.role === 'user' ? 'You' : 'Companion'}</Text>
                    <Text style={styles.chatText}>{m.text}</Text>
                  </View>
                ))}
              </View>
            )}
          </Section>

          <Section title="Your notes">
            <TextInput
              value={notesDraft}
              onChangeText={setNotesDraft}
              placeholder="Add notes (taste, smell, ID tips, who confirmed it, etc.)"
              placeholderTextColor={COLORS.textSecondary}
              style={styles.textArea}
              multiline
              testID="scan-details-notes"
            />
            <TouchableOpacity style={styles.primaryButton} onPress={onSave} testID="scan-details-save">
              <Text style={styles.primaryButtonText}>Save notes</Text>
            </TouchableOpacity>
          </Section>

          <Section title="Location">
            <View style={styles.fieldRow}>
              <MapPin size={16} color={COLORS.primary} />
              <TextInput
                value={locationNameDraft}
                onChangeText={setLocationNameDraft}
                placeholder="Location name (optional)"
                placeholderTextColor={COLORS.textSecondary}
                style={styles.fieldInput}
                testID="scan-details-location-name"
              />
            </View>

            <View style={styles.coordRow}>
              <View style={styles.coordField}>
                <Text style={styles.coordLabel}>Lat</Text>
                <TextInput
                  value={latDraft}
                  onChangeText={setLatDraft}
                  placeholder="-27.47"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                  style={styles.coordInput}
                  testID="scan-details-lat"
                />
              </View>
              <View style={styles.coordField}>
                <Text style={styles.coordLabel}>Lng</Text>
                <TextInput
                  value={lngDraft}
                  onChangeText={setLngDraft}
                  placeholder="153.02"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                  style={styles.coordInput}
                  testID="scan-details-lng"
                />
              </View>
            </View>

            <View style={styles.locationButtons}>
              <TouchableOpacity style={styles.secondaryButton} onPress={onUseCurrentLocation} testID="scan-details-use-location">
                <Navigation size={16} color={COLORS.text} />
                <Text style={styles.secondaryButtonText}>Use current</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButtonCompact} onPress={onSave} testID="scan-details-save-location">
                <Text style={styles.primaryButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Section>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function AlertIcon() {
  return (
    <View style={styles.alertIconWrap}>
      <ShieldAlert size={16} color={COLORS.warning} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  flex: {
    flex: 1,
  },
  safeArea: {
    zIndex: 4,
  },
  heroBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(11,25,17,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(11,25,17,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDisabled: {
    opacity: 0.55,
    borderColor: 'rgba(155,179,164,0.18)',
  },
  trashButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(11,25,17,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,92,92,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    marginHorizontal: 12,
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.2,
  },
  content: {
    paddingHorizontal: 18,
    paddingBottom: 30,
  },
  heroCard: {
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.18)',
    backgroundColor: COLORS.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
    marginBottom: 18,
  },
  heroImage: {
    width: '100%',
    height: 240,
  },
  heroOverlay: {
    padding: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTitleStack: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: -0.6,
  },
  heroSubtitle: {
    marginTop: 3,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 18,
    backgroundColor: 'rgba(7,17,11,0.9)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroMeta: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  section: {
    marginTop: 14,
    padding: 16,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.secondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sectionBody: {},
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  bullets: {
    marginTop: 10,
    gap: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  stepIndex: {
    width: 22,
    height: 22,
    borderRadius: 10,
    backgroundColor: 'rgba(56,217,137,0.16)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.30)',
    textAlign: 'center',
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingTop: 2,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  chatList: {
    gap: 10,
  },
  chatBubble: {
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chatBubbleUser: {
    backgroundColor: 'rgba(56,217,137,0.10)',
    borderColor: 'rgba(56,217,137,0.25)',
  },
  chatBubbleAssistant: {
    backgroundColor: 'rgba(155,179,164,0.08)',
    borderColor: 'rgba(155,179,164,0.22)',
  },
  chatRole: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.secondary,
    marginBottom: 6,
  },
  chatText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  textArea: {
    minHeight: 120,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.18)',
    backgroundColor: COLORS.surface,
    padding: 14,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  primaryButton: {
    marginTop: 12,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonCompact: {
    height: 44,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#06120B',
    letterSpacing: 0.2,
  },
  secondaryButton: {
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(11,25,17,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  locationButtons: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.18)',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fieldInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  fieldInputSolo: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.18)',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  coordRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  coordField: {
    flex: 1,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.18)',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  coordLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  coordInput: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  alertIconWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  missingCard: {
    marginTop: 24,
    marginHorizontal: 18,
    padding: 18,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  missingTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
    marginBottom: 8,
  },
  missingText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
});
