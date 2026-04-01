
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  ImageBackground,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');
const BRAND_GREEN = '#3AE081';

export default function IntroScreen() {
  return (
    <ImageBackground
      source={require('../../assets/images/Dark.jpg')}
      style={styles.container}
      resizeMode="cover"
    >
      {/* ── Title ── */}
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

      {/* ── Quote Text ── */}
      <View style={styles.quoteSection}>
        <Text style={styles.quoteText}>
          We pay our respects to the spirit of {'\n'}country. And Aunty Lou's story.{'\n'}
          For when we are disconnected from {'\n'}country, we are disconnected from
          the {'\n'}food that connects us to her.{'\n'}
          Travel lightly and with respect{'\n'}
          in the foot steps of the{'\n'}
          Ancestors ⭐🦶
        </Text>
      </View>

      <View style={{ flex: 1 }} />

      {/* ── Button ── */}
    {/* ── Button ── */}
<View style={styles.btnSection}>
  <View style={styles.ctaWrapper}>
    
    {/* ::after glow - CSS se convert */}
    <View style={styles.glowAfter} />
    
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => router.push('/onboarding/collect')}
    >
      <LinearGradient
        colors={['#3AE081', '#3AE081']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.ctaBtn}
      >
        <Text style={styles.ctaBtnText}>BEGIN YOUR JOURNEY</Text>
      </LinearGradient>
    </TouchableOpacity>
  </View>
</View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  titleSection: {
    paddingTop: 70,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 46,
  },
  heroTitleGreen: {
    color: BRAND_GREEN,
  },
  imageContainer: {
    width: width,
    height: height * 0.28,
    marginTop: 20,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  quoteSection: {
    paddingHorizontal: 36,
    paddingTop: 32,
    alignItems: 'center',
  },
  quoteText: {
    fontSize: 14,
    color: '#d0d0d0',
    lineHeight: 24,
    textAlign: 'center',
  },
  btnSection: {
    paddingHorizontal: 24,
    paddingBottom: 90,
    alignItems: 'center',
  },
  ctaWrapper: {
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    bottom: -25,
    left: 40,
    right: 10,
    height: 60,
    backgroundColor: '#49ca83',
    borderRadius: 50,
    opacity: 0.5,
    transform: [{ scaleX: 1.2 }],
  },
  
  ctaBtn: {
    borderRadius: 50,
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 1,
  },
});