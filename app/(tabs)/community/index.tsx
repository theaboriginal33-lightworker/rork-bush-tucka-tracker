import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  Animated,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};
import * as Haptics from 'expo-haptics';
import { COLORS } from '@/constants/colors';
import {
  MapPin,
  Plus,
  X,
  Navigation,
  Map,
  Trash2,
  Clock,
} from 'lucide-react-native';
import {
  useCommunity,
  PIN_CATEGORY_META,
  type PinCategory,
  type CommunityPin,
} from '@/app/providers/CommunityProvider';

const CATEGORY_FILTERS: { key: PinCategory | 'all'; label: string; emoji: string }[] = [
  { key: 'all', label: 'All', emoji: '🗺️' },
  { key: 'finding', label: 'Findings', emoji: '🌿' },
  { key: 'spot', label: 'Spots', emoji: '📍' },
  { key: 'recipe', label: 'Recipes', emoji: '🍳' },
];

const DEFAULT_REGION: Region = {
  latitude: -25.2744,
  longitude: 133.7751,
  latitudeDelta: 30,
  longitudeDelta: 30,
};

export default function CommunityScreen() {
  const { pins, addPin, removePin } = useCommunity();
  const mapRef = useRef<any>(null);

  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<PinCategory | 'all'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPin, setSelectedPin] = useState<CommunityPin | null>(null);
  const [longPressCoord, setLongPressCoord] = useState<{ latitude: number; longitude: number } | null>(null);

  const fabScale = useRef(new Animated.Value(1)).current;
  const cardSlide = useRef(new Animated.Value(300)).current;

  const filteredPins = useMemo(() => {
    if (activeFilter === 'all') return pins;
    return pins.filter((p) => p.category === activeFilter);
  }, [pins, activeFilter]);

  useEffect(() => {
    void (async () => {
      console.log('[Community] Requesting location permission');
      try {
        if (Platform.OS === 'web') {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                console.log('[Community] Web location:', loc);
                setUserLocation(loc);
                setLocationLoading(false);
              },
              (err) => {
                console.log('[Community] Web location error:', err.message);
                setLocationLoading(false);
              }
            );
          } else {
            setLocationLoading(false);
          }
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('[Community] Location permission denied');
          setLocationLoading(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        console.log('[Community] Got location:', coords);
        setUserLocation(coords);
        setLocationLoading(false);
      } catch (e) {
        console.log('[Community] Location error:', e);
        setLocationLoading(false);
      }
    })();
  }, []);

  const initialRegion = useMemo<Region>(() => {
    if (userLocation) {
      return {
        ...userLocation,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    return DEFAULT_REGION;
  }, [userLocation]);

  const goToMyLocation = useCallback(() => {
    if (!userLocation || !mapRef.current) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    mapRef.current.animateToRegion(
      { ...userLocation, latitudeDelta: 0.01, longitudeDelta: 0.01 },
      600
    );
  }, [userLocation]);

  const handleFabPress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(fabScale, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.timing(fabScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
    if (userLocation) {
      setLongPressCoord(userLocation);
    }
    setShowCreateModal(true);
  }, [fabScale, userLocation]);

  const handleMapLongPress = useCallback((e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLongPressCoord(e.nativeEvent.coordinate);
    setShowCreateModal(true);
  }, []);

  const handleMarkerPress = useCallback((pin: CommunityPin) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedPin(pin);
    cardSlide.setValue(300);
    Animated.spring(cardSlide, {
      toValue: 0,
      tension: 65,
      friction: 11,
      useNativeDriver: true,
    }).start();
  }, [cardSlide]);

  const dismissPinCard = useCallback(() => {
    Animated.timing(cardSlide, { toValue: 300, duration: 200, useNativeDriver: true }).start(() => {
      setSelectedPin(null);
    });
  }, [cardSlide]);

  const handleDeletePin = useCallback((id: string) => {
    Alert.alert('Remove Pin', 'Are you sure you want to remove this pin?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          removePin(id);
          dismissPinCard();
        },
      },
    ]);
  }, [removePin, dismissPinCard]);

  const getMarkerColor = useCallback((category: PinCategory) => {
    return PIN_CATEGORY_META[category].color;
  }, []);

  if (locationLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Finding your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        onLongPress={handleMapLongPress}
        onPress={() => selectedPin && dismissPinCard()}
        mapType="standard"
        testID="community-map"
      >
        {filteredPins.map((pin) => (
          <Marker
            key={pin.id}
            coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
            onPress={() => handleMarkerPress(pin)}
            pinColor={getMarkerColor(pin.category)}
            title={pin.title}
          />
        ))}
      </MapView>

      <SafeAreaView style={styles.overlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.topBar} pointerEvents="box-none">
          <View style={styles.headerRow}>
            <View style={styles.titlePill}>
              <Map color={COLORS.primary} size={18} />
              <Text style={styles.headerTitle}>Community</Text>
            </View>
            <View style={styles.pinCount}>
              <Text style={styles.pinCountText}>{filteredPins.length}</Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {CATEGORY_FILTERS.map((f) => {
              const isActive = activeFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterChip, isActive && styles.filterChipActive]}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setActiveFilter(f.key);
                  }}
                  activeOpacity={0.7}
                  testID={`filter-${f.key}`}
                >
                  <Text style={styles.filterEmoji}>{f.emoji}</Text>
                  <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </SafeAreaView>

      <SafeAreaView style={styles.bottomControls} edges={['bottom']} pointerEvents="box-none">
        {userLocation && (
          <TouchableOpacity
            style={styles.locationBtn}
            onPress={goToMyLocation}
            activeOpacity={0.8}
            testID="my-location-btn"
          >
            <Navigation color={COLORS.text} size={20} />
          </TouchableOpacity>
        )}

        <Animated.View style={{ transform: [{ scale: fabScale }] }}>
          <TouchableOpacity
            style={styles.fab}
            onPress={handleFabPress}
            activeOpacity={0.85}
            testID="add-pin-fab"
          >
            <Plus color="#07110B" size={26} strokeWidth={2.5} />
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>

      {selectedPin && (
        <Animated.View
          style={[styles.pinCard, { transform: [{ translateY: cardSlide }] }]}
        >
          <SafeAreaView edges={['bottom']}>
            <View style={styles.pinCardInner}>
              <View style={styles.pinCardHeader}>
                <View
                  style={[
                    styles.pinCategoryDot,
                    { backgroundColor: getMarkerColor(selectedPin.category) },
                  ]}
                />
                <View style={styles.pinCardTitleWrap}>
                  <Text style={styles.pinCardTitle} numberOfLines={1}>
                    {selectedPin.title}
                  </Text>
                  <Text style={styles.pinCardCategory}>
                    {PIN_CATEGORY_META[selectedPin.category].emoji}{' '}
                    {PIN_CATEGORY_META[selectedPin.category].label}
                  </Text>
                </View>
                <TouchableOpacity onPress={dismissPinCard} style={styles.pinCardClose}>
                  <X color={COLORS.textSecondary} size={18} />
                </TouchableOpacity>
              </View>

              {selectedPin.description.length > 0 && (
                <Text style={styles.pinCardDesc} numberOfLines={3}>
                  {selectedPin.description}
                </Text>
              )}

              {selectedPin.tags.length > 0 && (
                <View style={styles.pinCardTags}>
                  {selectedPin.tags.map((tag, i) => (
                    <View key={i} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.pinCardFooter}>
                <View style={styles.pinCardMeta}>
                  <Clock color={COLORS.textSecondary} size={12} />
                  <Text style={styles.pinCardDate}>
                    {new Date(selectedPin.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDeletePin(selectedPin.id)}
                >
                  <Trash2 color={COLORS.error} size={16} />
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </Animated.View>
      )}

      <CreatePinModal
        visible={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setLongPressCoord(null);
        }}
        onSubmit={(data) => {
          const coord = longPressCoord ?? userLocation ?? { latitude: -25.2744, longitude: 133.7751 };
          addPin({
            ...data,
            latitude: coord.latitude,
            longitude: coord.longitude,
            author: 'Me',
          });
          setShowCreateModal(false);
          setLongPressCoord(null);
        }}
        coordinate={longPressCoord}
      />
    </View>
  );
}

type CreatePinModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; description: string; category: PinCategory; tags: string[] }) => void;
  coordinate: { latitude: number; longitude: number } | null;
};

function CreatePinModal({ visible, onClose, onSubmit, coordinate }: CreatePinModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<PinCategory>('finding');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const resetForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setCategory('finding');
    setTagInput('');
    setTags([]);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handleSubmit = useCallback(() => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please give your pin a title.');
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit({ title: title.trim(), description: description.trim(), category, tags });
    resetForm();
  }, [title, description, category, tags, onSubmit, resetForm]);

  const addTag = useCallback(() => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t) && tags.length < 5) {
      setTags([...tags, t]);
      setTagInput('');
    }
  }, [tagInput, tags]);

  const removeTag = useCallback((tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  }, [tags]);

  const categories: PinCategory[] = ['finding', 'spot', 'recipe'];

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalSheet}>
          <SafeAreaView edges={['bottom']}>
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Drop a Pin</Text>
              <TouchableOpacity onPress={handleClose} style={styles.modalCloseBtn}>
                <X color={COLORS.textSecondary} size={20} />
              </TouchableOpacity>
            </View>

            {coordinate && (
              <View style={styles.coordRow}>
                <MapPin color={COLORS.primary} size={14} />
                <Text style={styles.coordText}>
                  {coordinate.latitude.toFixed(4)}, {coordinate.longitude.toFixed(4)}
                </Text>
              </View>
            )}

            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.categoryRow}>
              {categories.map((c) => {
                const meta = PIN_CATEGORY_META[c];
                const isActive = category === c;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.categoryOption,
                      isActive && { borderColor: meta.color, backgroundColor: meta.color + '18' },
                    ]}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      setCategory(c);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.categoryEmoji}>{meta.emoji}</Text>
                    <Text
                      style={[
                        styles.categoryLabel,
                        isActive && { color: meta.color, fontWeight: '700' as const },
                      ]}
                    >
                      {meta.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.input}
              placeholder="What did you find?"
              placeholderTextColor={COLORS.textSecondary}
              value={title}
              onChangeText={setTitle}
              maxLength={80}
              testID="pin-title-input"
            />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Share some details..."
              placeholderTextColor={COLORS.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              maxLength={500}
              testID="pin-desc-input"
            />

            <Text style={styles.fieldLabel}>Tags</Text>
            <View style={styles.tagInputRow}>
              <TextInput
                style={[styles.input, styles.tagField]}
                placeholder="Add a tag"
                placeholderTextColor={COLORS.textSecondary}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={addTag}
                maxLength={20}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.tagAddBtn} onPress={addTag}>
                <Plus color={COLORS.text} size={16} />
              </TouchableOpacity>
            </View>
            {tags.length > 0 && (
              <View style={styles.tagsWrap}>
                {tags.map((t) => (
                  <TouchableOpacity key={t} style={styles.tag} onPress={() => removeTag(t)}>
                    <Text style={styles.tagText}>{t}</Text>
                    <X color={COLORS.textSecondary} size={10} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, !title.trim() && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.8}
              disabled={!title.trim()}
              testID="submit-pin-btn"
            >
              <MapPin color="#07110B" size={18} />
              <Text style={styles.submitBtnText}>Drop Pin</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 15,
  },
  fallbackContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20,
  },
  fallbackContent: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 24,
    gap: 12,
  },
  fallbackTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: COLORS.text,
    marginTop: 8,
  },
  fallbackDesc: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  fallbackHint: {
    fontSize: 13,
    color: COLORS.primary,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    backgroundColor: COLORS.highlight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  fallbackPinsSection: {
    flex: 1,
    marginTop: 8,
  },
  fallbackPinsTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLORS.text,
    marginBottom: 12,
  },
  fallbackPinsList: {
    flex: 1,
  },
  fallbackPinItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  fallbackPinEmoji: {
    fontSize: 22,
  },
  fallbackPinInfo: {
    flex: 1,
  },
  fallbackPinName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: COLORS.text,
  },
  fallbackPinCoord: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  fallbackEmpty: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 20,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  titlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(7,17,11,0.85)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: COLORS.text,
  },
  pinCount: {
    backgroundColor: COLORS.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinCountText: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: '#07110B',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(7,17,11,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    gap: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(56,217,137,0.15)',
  },
  filterEmoji: {
    fontSize: 13,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
  },
  filterLabelActive: {
    color: COLORS.primary,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    left: 0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
    zIndex: 10,
  },
  locationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(7,17,11,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  pinCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: COLORS.border,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  pinCardInner: {
    padding: 20,
    paddingBottom: 8,
  },
  pinCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  pinCategoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pinCardTitleWrap: {
    flex: 1,
  },
  pinCardTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: COLORS.text,
  },
  pinCardCategory: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  pinCardClose: {
    padding: 4,
  },
  pinCardDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 10,
  },
  pinCardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  pinCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  pinCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pinCardDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  deleteBtn: {
    padding: 6,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.highlight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tagText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500' as const,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 12,
    maxHeight: '90%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: COLORS.text,
  },
  modalCloseBtn: {
    padding: 4,
  },
  coordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.highlight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  coordText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: COLORS.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  categoryOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: 4,
  },
  categoryEmoji: {
    fontSize: 20,
  },
  categoryLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500' as const,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  tagInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  tagField: {
    flex: 1,
    marginBottom: 0,
  },
  tagAddBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#07110B',
  },
});
