import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Pressable,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useEventListener } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Play, Pause } from 'lucide-react-native';

const { width } = Dimensions.get('window');

// ── Palette (same as goals / collect onboarding) ───────────────
const BG_DEEP = '#041a14';
const CARD_BG = '#0d1f18';
const GREEN_HIGHLIGHT = '#3AE081';
const GREEN_BTN = '#3db87f';
const TEXT_WHITE = '#ffffff';
const TEXT_MUTED = '#5a8a72';
const TEXT_HINT = '#3a6650';
const BORDER = '#163326';

export default function PlayVideoScreen() {
  const [isPlaying, setIsPlaying] = useState(true);

  const videoSource = useMemo(
    () => require('../../assets/vidos/bushtuckaintro.mov'),
    []
  );

  const player = useVideoPlayer(videoSource, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    player.play();
  }, [player]);

  useEventListener(player, 'playingChange', ({ isPlaying: next }) => {
    setIsPlaying(next);
  });

  useEventListener(player, 'playToEnd', () => {
    setIsPlaying(false);
    router.replace('/onboarding/collect');
  });

  function togglePlayPause() {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
  }

  function onContinueOrSkip() {
    player.pause();
    router.replace('/onboarding/collect');
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG_DEEP} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Top bar — back (same idea as collect) */}
          <View style={s.topBar}>
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={s.backBtn}
            >
              <Text style={s.backArrow}>←</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.heading}>
            <Text style={{ color: GREEN_HIGHLIGHT }}>Bush Tucka Tracka </Text>
            introduction video
          </Text>
          <Text style={s.subheading}>
            This is the introduction video for Bush Tucka Tracka — play or pause anytime, then continue when you’re ready.
          </Text>

          <View style={s.videoCard}>
            <VideoView
              player={player}
              style={s.video}
              contentFit="contain"
              nativeControls={false}
            />
            <View style={s.playPauseWrap} pointerEvents="box-none">
              <Pressable
                style={({ pressed }) => [s.playPauseCircle, pressed && s.playPausePressed]}
                onPress={togglePlayPause}
                accessibilityRole="button"
                accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <Pause size={26} color="#050f05" fill="#050f05" />
                ) : (
                  <Play size={26} color="#050f05" fill="#050f05" style={{ marginLeft: 4 }} />
                )}
              </Pressable>
            </View>
          </View>

          {/* Spacer + goanna — same pattern as goals / other onboarding */}
          <View style={{ flex: 1 }} />
          <Image
            source={require('../../assets/images/goanna2.png')}
            style={s.heroImage3}
            resizeMode="contain"
          />
 <TouchableOpacity style={s.skipBtn} onPress={onContinueOrSkip}>
            <Text style={s.skipText}>Skip for now</Text>
          </TouchableOpacity>
          {/* Bottom actions — same order as goals: primary CTA, then skip, then back */}
          {/* <TouchableOpacity style={s.btn} activeOpacity={0.85} onPress={onContinueOrSkip}>
            <Text style={s.btnText}>Continue</Text>
          </TouchableOpacity> */}

         

        
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG_DEEP,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 48,
    minHeight: 600,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    minHeight: 44,
  },
  backBtn: {
    paddingVertical: 8,
    paddingRight: 12,
  },
  backArrow: {
    fontSize: 28,
    color: TEXT_WHITE,
    fontWeight: '300',
  },
  heading: {
    fontSize: 34,
    fontWeight: '800',
    color: TEXT_WHITE,
    marginBottom: 10,
    lineHeight: 42,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 14,
    color: TEXT_MUTED,
    lineHeight: 21,
    marginBottom: 24,
    textAlign: 'center',
  },
  videoCard: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    aspectRatio: 9 / 16,
    maxHeight: width * 1.05,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  playPauseWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 14,
    alignItems: 'center',
  },
  playPausePressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
  playPauseCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: GREEN_HIGHLIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Same as goals.tsx — bottom illustration above CTAs
  heroImage3: {
    left:"50%",
    width: 230,
    height: 120,
    marginBottom: 16,
  },
  btn: {
    backgroundColor: GREEN_BTN,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_WHITE,
    letterSpacing: 0.2,
  },
  skipBtn: {
    alignSelf: 'center',
    padding: 8,
    marginBottom: 4,
  },
  skipText: {
    fontSize: 13,
    color: TEXT_HINT,
    textDecorationLine: 'underline',
  },
  backBottomBtn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  backBottomText: {
    fontSize: 14,
    color: TEXT_MUTED,
    fontWeight: '600',
  },
});
