import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,

  StatusBar,
  Image,
} from 'react-native';
import { router } from 'expo-router';

const { width, height } = Dimensions.get('window');

const BRAND_GREEN = '#3AE081';
const BG_DARK = '#000000';

export default function IntroScreen() {
  return (
    <View style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={BG_DARK} />                                                          1111111111                1qqqq≥qqqqqqqqqqqqqqqqqq

      {/* ── Title at top ── */}
      <View style={styles.titleSection}>
        <Text style={styles.heroTitle}>
          <Text style={styles.heroTitleGreen}>Reclaim </Text>
          Your{'\n'}Country
        </Text>
      </View>

      {/* ── Hero Image ── */}
      <View style={styles.imageContainer}>
        <Image
          source={require('../../assets/images/intro.png')}
          style={styles.heroImage}
          resizeMode="cover"
        />
      </View>

      {/* ── Quote ── */}
      <View style={styles.quoteSection}>
        <Text style={styles.quoteText}>
          "My mother grew up disconnected from the native foods that sustained our ancestors for thousands of years. Much of that ancestral wisdom was almost lost to us."
        </Text>
      </View>

      {/* ── Spacer ── */}
      <View style={{ flex: 1 }} />

      {/* ── Button ── */}
      <View style={styles.btnSection}>
        <TouchableOpacity
          style={styles.ctaBtn}
          activeOpacity={0.85}
        //   onPress={() => router.push('/onboarding/scan')}
        onPress={() => router.push('/onboarding/collect')}
        >
          <Text style={styles.ctaBtnText}>Begin Your Journey</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG_DARK,
  },

  // ── Title ──
  titleSection: {
    paddingTop: 64,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 46,
  },
  heroTitleGreen: {
    color: BRAND_GREEN,
  },

  // ── Image ──
  imageContainer: {
    width: width,
    height: height * 0.28,
    marginTop: 50,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },

  // ── Quote ──
  quoteSection: {
    paddingHorizontal: 20,
    paddingTop: 54,
  },
  quoteText: {
    fontSize: 14,
    fontWeight: '400',
    color: '#cccccc',
    lineHeight: 22,
    textAlign: 'center',
  },

  // ── Button ──
  btnSection: {
    paddingHorizontal: 24,
    paddingBottom: 60,
  },
  ctaBtn: {
    backgroundColor: BRAND_GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    letterSpacing: 0.3,
  },
});
