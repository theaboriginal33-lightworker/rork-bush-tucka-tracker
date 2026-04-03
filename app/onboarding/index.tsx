import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
  ImageBackground,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/app/providers/AuthProvider';

const { width, height } = Dimensions.get('window');
const BRAND_GREEN = COLORS.primary;

const CTA_WIDTH = Math.min(width * 0.88, 380);
const CTA_GRADIENT = ['#38B48D', '#3ABF88', '#3CD673'] as const;
const CTA_GRADIENT_LOCATIONS = [0, 0.48, 1] as const;

export default function IntroScreen() {
  const { session, signOut } = useAuth();

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

      {/* ── Primary CTA: normal rounded button + linear gradient ── */}
      <View style={styles.btnSection}>
        <View style={styles.ctaOuter}>
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => router.push('/onboarding/playvideo' as never)}
            style={styles.ctaTouchable}
          >
            <LinearGradient
              colors={[...CTA_GRADIENT]}
              locations={[...CTA_GRADIENT_LOCATIONS]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Text style={styles.ctaBtnText}>Begin your journey</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        {/* {session ? (
          <TouchableOpacity
            style={styles.signOutRow}
            onPress={() => {
              Alert.alert('Sign out?', 'You can log in again or use another account.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Sign out',
                  style: 'destructive',
                  onPress: () => {
                    void signOut().catch((e: unknown) => {
                      const message = e instanceof Error ? e.message : String(e);
                      Alert.alert('Could not sign out', message);
                    });
                  },
                },
              ]);
            }}
            hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
          >
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        ) : null} */}
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
    color: COLORS.white,
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
    color: 'rgba(234,246,238,0.70)',
    lineHeight: 24,
    textAlign: 'center',
  },
  btnSection: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 48 : 32,
    alignItems: 'center',
    width: '100%',
    marginBottom:"20%"
  },
  ctaOuter: {
    width: CTA_WIDTH,
    maxWidth: '100%',
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  ctaTouchable: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  ctaGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#06210F',
    letterSpacing: 0.2,
  },
  signOutRow: {
    marginTop: 8,
    paddingBottom: 8,
    alignItems: 'center',
  },
  signOutText: {
    fontSize: 14,
    color: 'rgba(234,246,238,0.55)',
    textDecorationLine: 'underline',
  },
});