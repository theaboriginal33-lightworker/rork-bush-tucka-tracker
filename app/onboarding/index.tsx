import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '@/constants/colors';
import { ChevronRight } from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';

interface OnboardingSlide {
  id: string;
  titleGreen: string;
  titleWhite: string;
  subtitle?: string;
  quote?: string;
  imageUrl?: string;
  imageStyle?: 'full' | 'phone' | 'rounded';
  termsText?: string;
  type: 'hero' | 'feature' | 'survey';
  surveyOptions?: string[];
}

const SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    titleGreen: 'Reclaim',
    titleWhite: 'Your\nCountry',
    type: 'hero',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    imageStyle: 'full',
    quote: '"My mother grew up disconnected from the native foods that sustained our ancestors for thousands of years. Much of that ancestral wisdom was almost lost to us."',
  },
  {
    id: '2',
    titleGreen: 'Capture',
    titleWhite: 'Bush Tucka',
    subtitle: 'Identify plants in seconds now!',
    type: 'feature',
    imageUrl: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&q=80',
    imageStyle: 'phone',
  },
  {
    id: '3',
    titleGreen: 'Walk',
    titleWhite: 'Lightly\nOn Country',
    type: 'hero',
    imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80',
    imageStyle: 'rounded',
    termsText: 'I have read and agree to the Terms & Conditions and Privacy Policy.',
  },
  {
    id: '4',
    titleGreen: 'What',
    titleWhite: 'Bring You\nTo Bush Tucka\nTracka Today?',
    type: 'survey',
    surveyOptions: [
      'Trying To Reconnect Back To My Indigenous Heritage',
      'Gather Some Tucka ingredients',
      'Enhance My Bush Walking on Country',
      'Generally Curious About local knowledge',
    ],
  },
  {
    id: '5',
    titleGreen: 'Identify',
    titleWhite: 'With\nConfidence',
    type: 'feature',
    imageUrl: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=600&q=80',
    imageStyle: 'phone',
  },
  {
    id: '6',
    titleGreen: 'Connect',
    titleWhite: 'With\nCountry',
    type: 'feature',
    imageUrl: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=600&q=80',
    imageStyle: 'phone',
  },
  {
    id: '7',
    titleGreen: 'Cook Safe',
    titleWhite: 'Edible\nBushTucka',
    type: 'feature',
    imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600&q=80',
    imageStyle: 'phone',
  },
  {
    id: '8',
    titleGreen: 'Community',
    titleWhite: 'Share With\nMob',
    type: 'feature',
    imageUrl: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=600&q=80',
    imageStyle: 'phone',
  },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedSurvey, setSelectedSurvey] = useState<string[]>([]);
  const scrollX = useRef(new Animated.Value(0)).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const finishOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
      console.log('[Onboarding] complete, navigating to auth');
    } catch (e) {
      console.log('[Onboarding] error saving completion', e);
    }
    router.replace('/auth');
  }, []);

  const handleNext = useCallback(async () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      await finishOnboarding();
    }
  }, [currentIndex, finishOnboarding]);

  const handleSkip = useCallback(async () => {
    await finishOnboarding();
  }, [finishOnboarding]);

  const toggleSurveyOption = useCallback((option: string) => {
    setSelectedSurvey((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
  }, []);

  const renderPhoneMockup = useCallback((imageUrl: string) => {
    return (
      <View style={styles.phoneMockup}>
        <View style={styles.phoneFrame}>
          <View style={styles.phoneNotch} />
          <Image
            source={{ uri: imageUrl }}
            style={styles.phoneScreenImage}
            resizeMode="cover"
          />
        </View>
        <View style={styles.phoneGlow} />
      </View>
    );
  }, []);

  const renderSlide = useCallback(
    ({ item }: { item: OnboardingSlide }) => {
      return (
        <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
          <View style={[styles.slideContent, { paddingTop: insets.top + 20 }]}>
            <Text style={styles.title}>
              <Text style={styles.titleGreen}>{item.titleGreen}</Text>
              {' '}
              <Text style={styles.titleWhite}>{item.titleWhite}</Text>
            </Text>

            {item.subtitle ? (
              <Text style={styles.subtitle}>{item.subtitle}</Text>
            ) : null}

            {item.type === 'hero' && item.imageUrl && item.imageStyle === 'full' ? (
              <View style={styles.heroImageContainer}>
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.heroImage}
                  resizeMode="cover"
                />
              </View>
            ) : null}

            {item.type === 'hero' && item.imageUrl && item.imageStyle === 'rounded' ? (
              <View style={styles.roundedImageContainer}>
                <Image
                  source={{ uri: item.imageUrl }}
                  style={styles.roundedImage}
                  resizeMode="cover"
                />
              </View>
            ) : null}

            {item.type === 'feature' && item.imageUrl ? (
              renderPhoneMockup(item.imageUrl)
            ) : null}

            {item.type === 'survey' && item.surveyOptions ? (
              <View style={styles.surveyContainer}>
                {item.surveyOptions.map((option) => {
                  const isSelected = selectedSurvey.includes(option);
                  return (
                    <Pressable
                      key={option}
                      onPress={() => toggleSurveyOption(option)}
                      style={[
                        styles.surveyOption,
                        isSelected ? styles.surveyOptionSelected : null,
                      ]}
                    >
                      <Text
                        style={[
                          styles.surveyOptionText,
                          isSelected ? styles.surveyOptionTextSelected : null,
                        ]}
                      >
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {item.quote ? (
              <View style={styles.quoteContainer}>
                <Text style={styles.quoteText}>{item.quote}</Text>
              </View>
            ) : null}

            {item.termsText ? (
              <View style={styles.termsContainer}>
                <Text style={styles.termsText}>{item.termsText}</Text>
              </View>
            ) : null}
          </View>
        </View>
      );
    },
    [insets.top, selectedSurvey, toggleSurveyOption, renderPhoneMockup]
  );

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <View style={styles.root} testID="onboarding-root">
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.pagination}>
          {SLIDES.map((_, i) => {
            const inputRange = [
              (i - 1) * SCREEN_WIDTH,
              i * SCREEN_WIDTH,
              (i + 1) * SCREEN_WIDTH,
            ];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [6, 24, 6],
              extrapolate: 'clamp',
            });
            const dotOpacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  {
                    width: dotWidth,
                    opacity: dotOpacity,
                  },
                ]}
              />
            );
          })}
        </View>

        <View style={styles.buttonsRow}>
          <Pressable onPress={handleSkip} style={styles.skipButton} testID="onboarding-skip">
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>

          <Pressable
            onPress={handleNext}
            style={({ pressed }) => [
              styles.nextButton,
              pressed ? styles.nextButtonPressed : null,
            ]}
            testID="onboarding-next"
          >
            <Text style={styles.nextText}>
              {isLastSlide ? 'Get Started' : 'Next'}
            </Text>
            {!isLastSlide ? (
              <ChevronRight color="#06210F" size={20} strokeWidth={3} />
            ) : null}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  slide: {
    flex: 1,
  },
  slideContent: {
    flex: 1,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 44,
    fontWeight: '900' as const,
    lineHeight: 52,
    letterSpacing: -1,
    textAlign: 'center',
    marginBottom: 8,
  },
  titleGreen: {
    color: COLORS.primary,
  },
  titleWhite: {
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: 'rgba(234,246,238,0.75)',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  heroImageContainer: {
    marginTop: 24,
    height: SCREEN_HEIGHT * 0.3,
    overflow: 'hidden',
    alignSelf: 'center',
    width: SCREEN_WIDTH,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  roundedImageContainer: {
    marginTop: 32,
    alignSelf: 'center',
    width: SCREEN_WIDTH * 0.75,
    height: SCREEN_HEIGHT * 0.4,
    borderRadius: 16,
    overflow: 'hidden',
  },
  roundedImage: {
    width: '100%',
    height: '100%',
  },
  phoneMockup: {
    marginTop: 24,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    maxHeight: SCREEN_HEIGHT * 0.52,
  },
  phoneFrame: {
    width: SCREEN_WIDTH * 0.72,
    height: SCREEN_HEIGHT * 0.48,
    backgroundColor: '#0A0A0A',
    borderRadius: 36,
    borderWidth: 3,
    borderColor: '#2A2A2A',
    overflow: 'hidden',
    position: 'relative' as const,
  },
  phoneNotch: {
    position: 'absolute' as const,
    top: 0,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -40,
    width: 80,
    height: 24,
    backgroundColor: '#0A0A0A',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    zIndex: 10,
  },
  phoneScreenImage: {
    width: '100%',
    height: '100%',
    borderRadius: 33,
  },
  phoneGlow: {
    position: 'absolute' as const,
    width: SCREEN_WIDTH * 0.78,
    height: SCREEN_HEIGHT * 0.5,
    borderRadius: 40,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(56,217,137,0.25)',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 30,
      },
      android: {
        elevation: 8,
      },
      web: {},
    }),
  },
  surveyContainer: {
    marginTop: 32,
    gap: 20,
    flex: 1,
    justifyContent: 'center',
  },
  surveyOption: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(155,179,164,0.15)',
    backgroundColor: 'rgba(15,36,24,0.4)',
  },
  surveyOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(56,217,137,0.1)',
  },
  surveyOptionText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: 'rgba(234,246,238,0.8)',
    textAlign: 'center',
  },
  surveyOptionTextSelected: {
    color: COLORS.primary,
  },
  quoteContainer: {
    marginTop: 'auto' as const,
    paddingHorizontal: 8,
    paddingBottom: 80,
  },
  quoteText: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 24,
    color: 'rgba(234,246,238,0.85)',
    textAlign: 'center',
    fontStyle: 'italic' as const,
  },
  termsContainer: {
    marginTop: 'auto' as const,
    paddingBottom: 80,
    paddingHorizontal: 16,
  },
  termsText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: 'rgba(234,246,238,0.55)',
    textAlign: 'center',
    lineHeight: 18,
  },
  bottomBar: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: 'rgba(7,17,11,0.85)',
  },
  pagination: {
    flexDirection: 'row' as const,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  buttonsRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: 'rgba(234,246,238,0.5)',
  },
  nextButton: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 30,
    gap: 4,
  },
  nextButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  nextText: {
    fontSize: 16,
    fontWeight: '900' as const,
    color: '#06210F',
  },
});
