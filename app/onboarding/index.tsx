// import {
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   Dimensions,

//   StatusBar,
//   Image,
// } from 'react-native';
// import { router } from 'expo-router';

// const { width, height } = Dimensions.get('window');

// const BRAND_GREEN = '#3AE081';
// const BG_DARK = '#000000';

// export default function IntroScreen() {
//   return (
//     <View style={styles.safe}>
//       <StatusBar barStyle="light-content" backgroundColor={BG_DARK} />                                                    

//       {/* ── Title at top ── */}
//       <View style={styles.titleSection}>
//         <Text style={styles.heroTitle}>
//           <Text style={styles.heroTitleGreen}>Reclaim </Text>
//           Your{'\n'}Country
//         </Text>
//       </View>

//       {/* ── Hero Image ── */}
//       <View style={styles.imageContainer}>
//         <Image
//           source={require('../../assets/images/intro.png')}
//           style={styles.heroImage}
//           resizeMode="cover"
//         />
//       </View>

//       {/* ── Quote ── */}
//       <View style={styles.quoteSection}>
//         <Text style={styles.quoteText}>
//           "My mother grew up disconnected from the native foods that sustained our ancestors for thousands of years. Much of that ancestral wisdom was almost lost to us."
//         </Text>
//       </View>

//       {/* ── Spacer ── */}
//       <View style={{ flex: 1 }} />

//       {/* ── Button ── */}
//       <View style={styles.btnSection}>
//         <TouchableOpacity
//           style={styles.ctaBtn}
//           activeOpacity={0.85}
//         //   onPress={() => router.push('/onboarding/scan')}
//         onPress={() => router.push('/onboarding/collect')}
//         >
//           <Text style={styles.ctaBtnText}>Begin Your Journey</Text>
//         </TouchableOpacity>
//       </View>

//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   safe: {
//     flex: 1,
//     backgroundColor: BG_DARK,
//   },

//   // ── Title ──
//   titleSection: {
//     paddingTop: 64,
//     paddingHorizontal: 20,
//     alignItems: 'center',
//   },
//   heroTitle: {
//     fontSize: 32,
//     fontWeight: '800',
//     color: '#ffffff',
//     textAlign: 'center',
//     lineHeight: 46,
//   },
//   heroTitleGreen: {
//     color: BRAND_GREEN,
//   },

//   // ── Image ──
//   imageContainer: {
//     width: width,
//     height: height * 0.28,
//     marginTop: 50,
//     overflow: 'hidden',
//   },
//   heroImage: {
//     width: '100%',
//     height: '100%',
//   },

//   // ── Quote ──
//   quoteSection: {
//     paddingHorizontal: 20,
//     paddingTop: 54,
//   },
//   quoteText: {
//     fontSize: 14,
//     fontWeight: '400',
//     color: '#cccccc',
//     lineHeight: 22,
//     textAlign: 'center',
//   },

//   // ── Button ──
//   btnSection: {
//     paddingHorizontal: 24,
//     paddingBottom: 60,
//   },
//   ctaBtn: {
//     backgroundColor: BRAND_GREEN,
//     borderRadius: 14,
//     paddingVertical: 16,
//     alignItems: 'center',
//   },
//   ctaBtnText: {
//     fontSize: 16,
//     fontWeight: '600',
//     color: '#000000',
//     letterSpacing: 0.3,
//   },
// });
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
      <View style={styles.btnSection}>
        <View style={styles.ctaWrapper}>
          <View style={styles.glow} />
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push('/onboarding/collect')}
          >
            <LinearGradient
              colors={['#5BFFB2', '#28D67A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
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
    backgroundColor: '#3AE081',
    borderRadius: 50,
    opacity: 0.35,
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