// import { useState, useRef } from 'react';
// import {
//   View, Text, StyleSheet, TouchableOpacity,
//   SafeAreaView, StatusBar, ScrollView,
//   Animated,
// } from 'react-native';
// import { router } from 'expo-router';

// const BRAND_GREEN = '#3AE081';
// const BG_DARK = '#0a0a0a';
// const BG_CARD = '#111111';
// const TEXT_WHITE = '#ffffff';
// const TEXT_MUTED = '#888888';

// const SAFETY_CARDS = [
//   {
//     icon: '🔬',
//     title: 'AI Has Limitations',
//     body: 'Our plant identification technology is powerful but not perfect. Always verify identification before consuming any plant.',
//   },
//   {
//     icon: '⚠️',
//     title: 'Never Consume Unverified Plants',
//     body: 'Use Bush Tucka Tracka as a starting point for learning. Seek confirmation from a qualified expert before eating any wild plant.',
//   },
//   {
//     icon: '🏥',
//     title: 'Allergic Reactions',
//     body: 'Even safe bush foods can cause individual reactions. Start with small quantities. Consult your doctor if you have allergies or health conditions.',
//   },
//   {
//     icon: '🌿',
//     title: 'Lookalikes Exist',
//     body: 'Some toxic plants resemble safe bush tucker. If in doubt, don\'t eat it. Your safety matters more than any meal.',
//   },
//   {
//     icon: '💚',
//     title: 'Respect Country',
//     body: 'Always harvest sustainably. Obtain permission on private or protected land. Respect Indigenous cultural protocols.',
//   },
// ];

//     export default function SafetyScreen() {
//     const [agreed, setAgreed] = useState(false);
//     const shakeAnim = useRef(new Animated.Value(0)).current;

//     function handleContinue() {
//         if (!agreed) {
//         // Shake animation if not agreed
//         Animated.sequence([
//             Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
//             Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
//             Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
//             Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
//         ]).start();
//         return;
//         }
//     router.push('/onboarding/goals');
//     }

//     return (
//         <SafeAreaView style={s.safe}>
//         <StatusBar barStyle="light-content" backgroundColor={BG_DARK} />

//         {/* Back button */}
//         <TouchableOpacity
//             style={s.backBtn}
//             onPress={() => router.back()}
//             hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
//         >
//             <Text style={s.backArrow}>←</Text>
//         </TouchableOpacity>

//         <ScrollView
//             contentContainerStyle={s.scroll}
//             showsVerticalScrollIndicator={false}
//         >
//             {/* ── Header ── */}
//             <View style={s.header}>
//             <Text style={s.beforeLabel}>Before We Begin 🌿</Text>
//             <Text style={s.title}>
//                 <Text style={s.titleGreen}>Walk </Text>
//                 Lightly{'\n'}On Country ⚠️
//             </Text>
//             <Text style={s.subtitle}>
//                 Bush tucker knowledge is powerful.{'\n'}
//                 Please read this before your first scan. 💚
//             </Text>
//             </View>

//             {/* ── Safety Cards ── */}
//             <View style={s.cards}>
//             {SAFETY_CARDS.map((card, i) => (
//                 <View key={i} style={s.card}>
//                 <Text style={s.cardIcon}>{card.icon}</Text>
//                 <View style={s.cardContent}>
//                     <Text style={s.cardTitle}>{card.title}</Text>
//                     <Text style={s.cardBody}>{card.body}</Text>
//                 </View>
//                 </View>
//             ))}
//             </View>

//             {/* ── Acknowledgement ── */}
//             <View style={s.ackSection}>
//             <TouchableOpacity
//                 style={s.checkRow}
//                 onPress={() => setAgreed(!agreed)}
//                 activeOpacity={0.7}
//             >
//                 <View style={[s.checkbox, agreed && s.checkboxActive]}>
//                 {agreed && <Text style={s.checkmark}>✓</Text>}
//                 </View>
//                 <Text style={s.ackText}>
//                 I understand that Bush Tucka Tracka is an educational tool. I accept full responsibility for verifying plant identification before consumption. I have read and agree to the{' '}
//                 <Text style={s.ackLink}>Terms & Conditions</Text>
//                 {' '}and{' '}
//                 <Text style={s.ackLink}>Privacy Policy</Text>.
//                 </Text>
//             </TouchableOpacity>
//             </View>

//             {/* ── Button ── */}
//             <Animated.View style={[s.btnWrap, { transform: [{ translateX: shakeAnim }] }]}>
//             <TouchableOpacity
//                 style={[s.btn, !agreed && s.btnDisabled]}
//                 onPress={handleContinue}
//                 activeOpacity={0.85}
//             >
//                 <Text style={[s.btnText, !agreed && s.btnTextDisabled]}>
//                 {agreed ? '🌱 I Understand — Let\'s Go' : '🔒 I Understand — Let\'s Go'}
//                 </Text>
//             </TouchableOpacity>
//             </Animated.View>

//             {/* Skip warning message */}
//             {!agreed && (
//             <Text style={s.skipWarning}>
//                 This acknowledgement keeps you safe on country fellow traveller.{'\n'}
//                 Please read and accept before continuing. 💚
//             </Text>
//             )}

//         </ScrollView>
//         </SafeAreaView>
//     );
//     }

// const s = StyleSheet.create({
//   safe: {
//     flex: 1,
//     backgroundColor: BG_DARK,
//   },
//   backBtn: {
//     position: 'absolute',
//     top: 52, left: 16,
//     zIndex: 10, padding: 8,
//   },
//   backArrow: {
//     fontSize: 22,
//     color: TEXT_WHITE,
//   },

//   scroll: {
//     paddingBottom: 48,
//   },

//   // ── Header ──
//   header: {
//     paddingHorizontal: 24,
//     paddingTop: 60,
//     paddingBottom: 24,
//   },
//   beforeLabel: {
//     fontSize: 12,
//     color: BRAND_GREEN,
//     fontWeight: '500',
//     letterSpacing: 1,
//     marginBottom: 10,
//     textTransform: 'uppercase',
//   },
//   title: {
//     fontSize: 36,
//     fontWeight: '800',
//     color: TEXT_WHITE,
//     lineHeight: 44,
//     marginBottom: 12,
//   },
//   titleGreen: {
//     color: BRAND_GREEN,
//   },
//   subtitle: {
//     fontSize: 14,
//     color: TEXT_MUTED,
//     lineHeight: 22,
//   },

//   // ── Cards ──
//   cards: {
//     paddingHorizontal: 16,
//     gap: 10,
//     marginBottom: 24,
//   },
//   card: {
//     flexDirection: 'row',
//     gap: 14,
//     backgroundColor: BG_CARD,
//     borderRadius: 14,
//     borderWidth: 0.5,
//     borderColor: '#2a2a2a',
//     padding: 16,
//     alignItems: 'flex-start',
//   },
//   cardIcon: {
//     fontSize: 22,
//     marginTop: 2,
//   },
//   cardContent: {
//     flex: 1,
//   },
//   cardTitle: {
//     fontSize: 14,
//     fontWeight: '600',
//     color: BRAND_GREEN,
//     marginBottom: 4,
//   },
//   cardBody: {
//     fontSize: 13,
//     color: '#aaaaaa',
//     lineHeight: 20,
//   },

//   // ── Acknowledgement ──
//   ackSection: {
//     paddingHorizontal: 16,
//     marginBottom: 20,
//   },
//   checkRow: {
//     flexDirection: 'row',
//     gap: 12,
//     alignItems: 'flex-start',
//     backgroundColor: '#111',
//     borderRadius: 12,
//     borderWidth: 0.5,
//     borderColor: '#2a2a2a',
//     padding: 14,
//   },
//   checkbox: {
//     width: 22, height: 22,
//     borderRadius: 6,
//     borderWidth: 1.5,
//     borderColor: '#444',
//     alignItems: 'center',
//     justifyContent: 'center',
//     flexShrink: 0,
//     marginTop: 1,
//   },
//   checkboxActive: {
//     backgroundColor: BRAND_GREEN,
//     borderColor: BRAND_GREEN,
//   },
//   checkmark: {
//     color: '#050f05',
//     fontSize: 13,
//     fontWeight: '700',
//   },
//   ackText: {
//     flex: 1,
//     fontSize: 12,
//     color: '#888',
//     lineHeight: 18,
//   },
//   ackLink: {
//     color: BRAND_GREEN,
//     fontWeight: '500',
//   },

//   // ── Button ──
//   btnWrap: {
//     paddingHorizontal: 16,
//     marginBottom: 14,
//   },
//   btn: {
//     backgroundColor: BRAND_GREEN,
//     borderRadius: 14,
//     paddingVertical: 16,
//     alignItems: 'center',
//   },
//   btnDisabled: {
//     backgroundColor: '#1a2a1a',
//   },
//   btnText: {
//     fontSize: 16,
//     fontWeight: '600',
//     color: '#050f05',
//   },
//   btnTextDisabled: {
//     color: '#2a4a2a',
//   },
//   skipWarning: {
//     fontSize: 12,
//     color: '#3a6a3a',
//     textAlign: 'center',
//     lineHeight: 18,
//     paddingHorizontal: 24,
//   },
// });
// // import {
// //   View, Text, StyleSheet, TouchableOpacity,
// //   SafeAreaView, StatusBar, ScrollView,
// // } from 'react-native';
// // import { router } from 'expo-router';

// // const BRAND_GREEN = '#3AE081';
// // const BG_DARK = '#0a0a0a';
// // const BG_CARD = '#111111';
// // const TEXT_WHITE = '#ffffff';
// // const TEXT_MUTED = '#888888';

// // const SAFETY_CARDS = [
// //   {
// //     icon: '🔬',
// //     title: 'AI Has Limitations',
// //     body: 'Our plant identification technology is powerful but not perfect. Always verify identification before consuming any plant.',
// //   },
// //   {
// //     icon: '⚠️',
// //     title: 'Never Consume Unverified Plants',
// //     body: 'Use Bush Tucka Tracka as a starting point for learning. Seek confirmation from a qualified expert before eating any wild plant.',
// //   },
// //   {
// //     icon: '🏥',
// //     title: 'Allergic Reactions',
// //     body: 'Even safe bush foods can cause individual reactions. Start with small quantities. Consult your doctor if you have allergies or health conditions.',
// //   },
// //   {
// //     icon: '🌿',
// //     title: 'Lookalikes Exist',
// //     body: "Some toxic plants resemble safe bush tucker. If in doubt, don't eat it. Your safety matters more than any meal.",
// //   },
// //   {
// //     icon: '💚',
// //     title: 'Respect Country',
// //     body: 'Always harvest sustainably. Obtain permission on private or protected land. Respect Indigenous cultural protocols.',
// //   },
// // ];

// // export default function SafetyScreen() {
// //   return (
// //     <SafeAreaView style={s.safe}>
// //       <StatusBar barStyle="light-content" backgroundColor={BG_DARK} />

// //       <TouchableOpacity
// //         style={s.backBtn}
// //         onPress={() => router.back()}
// //         hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
// //       >
// //         <Text style={s.backArrow}>←</Text>
// //       </TouchableOpacity>

// //       <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

// //         {/* Header */}
// //         <View style={s.header}>
// //           <Text style={s.beforeLabel}>Before We Begin 🌿</Text>
// //           <Text style={s.title}>
// //             <Text style={s.titleGreen}>Walk </Text>
// //             Lightly{'\n'}On Country ⚠️
// //           </Text>
// //           <Text style={s.subtitle}>
// //             Bush tucker knowledge is powerful.{'\n'}
// //             Please read this before your first scan. 💚
// //           </Text>
// //         </View>

// //         {/* Safety Cards */}
// //         <View style={s.cards}>
// //           {SAFETY_CARDS.map((card, i) => (
// //             <View key={i} style={s.card}>
// //               <Text style={s.cardIcon}>{card.icon}</Text>
// //               <View style={s.cardContent}>
// //                 <Text style={s.cardTitle}>{card.title}</Text>
// //                 <Text style={s.cardBody}>{card.body}</Text>
// //               </View>
// //             </View>
// //           ))}
// //         </View>

// //         {/* Simple Button */}
// //         <View style={s.btnWrap}>
// //           <TouchableOpacity
// //             style={s.btn}
// //             activeOpacity={0.85}
// //             onPress={() => router.push('/onboarding/safety-intro')}
// //           >
// //             <Text style={s.btnText}>🌱 I Understand — Let's Go</Text>
// //           </TouchableOpacity>
// //         </View>

// //       </ScrollView>
// //     </SafeAreaView>
// //   );
// // }

// // const s = StyleSheet.create({
// //   safe: { flex: 1, backgroundColor: BG_DARK },
// //   backBtn: { position: 'absolute', top: 52, left: 16, zIndex: 10, padding: 8 },
// //   backArrow: { fontSize: 22, color: TEXT_WHITE },
// //   scroll: { paddingBottom: 48 },
// //   header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 24 },
// //   beforeLabel: {
// //     fontSize: 12, color: BRAND_GREEN, fontWeight: '500',
// //     letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase',
// //   },
// //   title: { fontSize: 36, fontWeight: '800', color: TEXT_WHITE, lineHeight: 44, marginBottom: 12 },
// //   titleGreen: { color: BRAND_GREEN },
// //   subtitle: { fontSize: 14, color: TEXT_MUTED, lineHeight: 22 },
// //   cards: { paddingHorizontal: 16, gap: 10, marginBottom: 24 },
// //   card: {
// //     flexDirection: 'row', gap: 14, backgroundColor: BG_CARD,
// //     borderRadius: 14, borderWidth: 0.5, borderColor: '#2a2a2a',
// //     padding: 16, alignItems: 'flex-start',
// //   },
// //   cardIcon: { fontSize: 22, marginTop: 2 },
// //   cardContent: { flex: 1 },
// //   cardTitle: { fontSize: 14, fontWeight: '600', color: BRAND_GREEN, marginBottom: 4 },
// //   cardBody: { fontSize: 13, color: '#aaaaaa', lineHeight: 20 },
// //   btnWrap: { paddingHorizontal: 16, marginBottom: 14 },
// //   btn: {
// //     backgroundColor: BRAND_GREEN, borderRadius: 14,
// //     paddingVertical: 16, alignItems: 'center',
// //   },
// //   btnText: { fontSize: 16, fontWeight: '600', color: '#050f05' },
// // });
import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, ScrollView, Dimensions, FlatList,
  Animated, Platform,
} from 'react-native';
import { router } from 'expo-router';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

const { width: W } = Dimensions.get('window');

// ── Palette ───────────────────────────────────────────────────
const BG_DEEP        = '#041a14';
const CARD_BG        = '#0d1f18';
const INPUT_BG       = '#0a1a13';
const GREEN          = '#3aad7e';
const GREEN_BTN      = '#3db87f';
const GREEN_HIGHLIGHT = '#3AE081';
const TEXT_WHITE     = '#ffffff';
const TEXT_MUTED     = '#5a8a72';
const TEXT_HINT      = '#3a6650';
const BORDER         = '#163326';


// ── Safety Cards Data ─────────────────────────────────────────
const SAFETY_CARDS = [
  {
    id: '0',
    isIntro: true,
    label: 'Before We Begin 🌿',
    title: 'Walk Lightly\nOn Country',
    body: 'Bush tucker knowledge is powerful.\nPlease read this before your first scan. 💚',
    icon: '🚶',
    color: '#0a2a1e',
  },
  {
    id: '1',
    isIntro: false,
    label: 'Safety Card 1 · 🧠',
    title: 'AI Has\nLimitations',
    body: 'Our plant identification technology is powerful but not perfect. Always verify identification before consuming any plant.',
    icon: '🧠',
    color: '#0a1a2a',
  },
  {
    id: '2',
    isIntro: false,
    label: 'Safety Card 2 · ⚠️',
    title: 'Never Consume\nUnverified Plants',
    body: 'Use Bush Tucka Tracka as a starting point for learning. Seek confirmation from a qualified expert before eating any wild plant.',
    icon: '⚠️',
    color: '#2a1a0a',
  },
  {
    id: '3',
    isIntro: false,
    label: 'Safety Card 3 · 🏥',
    title: 'Allergic\nReactions',
    body: 'Even safe bush foods can cause individual reactions. Start with small quantities. Consult your doctor if you have allergies or health conditions.',
    icon: '🏥',
    color: '#1a0a2a',
  },
  {
    id: '4',
    isIntro: false,
    label: 'Safety Card 4 · 🌿',
    title: 'Lookalikes\nExist',
    body: 'Some toxic plants resemble safe bush tucker. If in doubt, don\'t eat it. Your safety matters more than any meal.',
    icon: '🌿',
    color: '#0a2a1a',
  },
  {
    id: '5',
    isIntro: false,
    label: 'Safety Card 5 · 💚',
    title: 'Respect\nCountry',
    body: 'Always harvest sustainably. Obtain permission on private or protected land. Respect Indigenous cultural protocols.',
    icon: '💚',
    color: '#0d1f18',
  },
];

// ── Icons ─────────────────────────────────────────────────────
function ShieldIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2L4 6v6c0 4.418 3.358 8.55 8 9.93C16.642 20.55 20 16.418 20 12V6L12 2z" fill={GREEN} opacity={0.2} />
      <Path d="M12 2L4 6v6c0 4.418 3.358 8.55 8 9.93C16.642 20.55 20 16.418 20 12V6L12 2z" stroke={GREEN} strokeWidth={1.5} fill="none" />
      <Path d="M9 12l2 2 4-4" stroke={GREEN} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function CheckIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path d="M5 13l4 4L19 7" stroke="#000" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ArrowRight() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h14M13 6l6 6-6 6" stroke={TEXT_WHITE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function SafetyScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [agreed, setAgreed] = useState(false);
  const [attemptedSkip, setAttemptedSkip] = useState(false);
  const flatRef = useRef<FlatList>(null);
  const isLast = currentIndex === SAFETY_CARDS.length - 1;

  function goNext() {
    if (!isLast) {
      const next = currentIndex + 1;
      flatRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentIndex(next);
    }
  }

  function onViewableChanged({ viewableItems }: any) {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index ?? 0);
    }
  }

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 });
  const onViewableItemsChanged = useRef(onViewableChanged);

  function handleContinue() {
    if (!agreed) {
      setAttemptedSkip(true);
      return;
    }
    router.push('/(tabs)');
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG_DEEP} />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
       

        {/* ── Label above cards ── */}
        <Text style={s.sectionLabel}>SAFETY ONBOARDING</Text>

        {/* ── Carousel ── */}
        <FlatList
          ref={flatRef}
          data={SAFETY_CARDS}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged.current}
          viewabilityConfig={viewabilityConfig.current}
          scrollEnabled={true}
          renderItem={({ item }) => (
            <View style={[s.card, { backgroundColor: item.color }]}>
              {/* Card label */}
              <Text style={s.cardLabel}>{item.label}</Text>

              {/* Big emoji */}
              <Text style={s.cardEmoji}>{item.icon}</Text>

              {/* Title */}
              <Text style={s.cardTitle}>
                {item.isIntro
                  ? <><Text style={{ color: GREEN_HIGHLIGHT }}>Walk Lightly{'\n'}</Text><Text style={{ color: TEXT_WHITE }}>On Country</Text></>
                  : item.title
                }
              </Text>

              {/* Body */}
              <Text style={s.cardBody}>{item.body}</Text>

              {/* Next arrow (not on last card) */}
              {!isLast && currentIndex === parseInt(item.id) && (
                <TouchableOpacity style={s.nextArrowBtn} onPress={goNext} activeOpacity={0.8}>
                  <ArrowRight />
                </TouchableOpacity>
              )}
            </View>
          )}
          style={s.flatList}
        />

        {/* ── Dot indicators ── */}
        <View style={s.dotsRow}>
          {SAFETY_CARDS.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => {
                flatRef.current?.scrollToIndex({ index: i, animated: true });
                setCurrentIndex(i);
              }}
            >
              <View style={[s.dot, i === currentIndex && s.dotActive, i < currentIndex && s.dotDone]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Progress label ── */}
        <Text style={s.progressText}>
          {currentIndex + 1} of {SAFETY_CARDS.length}
        </Text>

        {/* ── Acknowledgement checkbox (shown after all cards read or always) ── */}
        <View style={s.ackCard}>
          <TouchableOpacity
            style={s.checkRow}
            onPress={() => { setAgreed(!agreed); setAttemptedSkip(false); }}
            activeOpacity={0.8}
          >
            <View style={[s.checkbox, agreed && s.checkboxActive]}>
              {agreed && <CheckIcon />}
            </View>
            <Text style={s.ackText}>
              I understand that Bush Tucka Tracka is an educational tool. I accept full responsibility for verifying plant identification before consumption. I have read and agree to the{' '}
              <Text style={s.ackLink}>Terms & Conditions</Text> and <Text style={s.ackLink}>Privacy Policy</Text>.
            </Text>
          </TouchableOpacity>

          {/* Attempted skip warning */}
          {attemptedSkip && !agreed && (
            <View style={s.warningRow}>
              <Text style={s.warningText}>
                💚 This acknowledgement keeps you safe on country, fellow traveller. Please read and accept before continuing.
              </Text>
            </View>
          )}
        </View>

        {/* ── CTA Button ── */}
        <TouchableOpacity
          style={[s.btn, !agreed && s.btnDisabled]}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          <Text style={[s.btnText, !agreed && s.btnTextDisabled]}>
            {agreed ? "I Understand — Let's Go 🌿" : '🔒 Accept to Continue'}
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────
const CARD_W = W - 48;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG_DEEP, paddingTop:70},
  scroll: { flexGrow: 1, paddingBottom: 48 },

  topRow: {
    paddingHorizontal: 24,
    paddingTop: 64,
    marginBottom: 20,
  },
  logoCircle: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(58,173,126,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(58,173,126,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  sectionLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_WHITE,
    letterSpacing: 2,
    paddingHorizontal: 24,
    textAlign:"center",
    marginBottom: 16,
  },

  // ── Carousel ──
  flatList: {
    paddingLeft: 24,
  },
  card: {
    width: CARD_W,
    minHeight: 300,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 28,
    marginRight: 16,
    justifyContent: 'flex-start',
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: GREEN,
    letterSpacing: 1.2,
    marginBottom: 20,
  },
  cardEmoji: {
    fontSize: 44,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: TEXT_WHITE,
    lineHeight: 38,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  cardBody: {
    fontSize: 15,
    color: TEXT_MUTED,
    lineHeight: 23,
  },
  nextArrowBtn: {
    marginTop: 24,
    alignSelf: 'flex-end',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(58,173,126,0.15)',
    borderWidth: 1,
    borderColor: GREEN,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Dots ──
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    marginBottom: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#163326',
  },
  dotActive: { width: 20, backgroundColor: GREEN },
  dotDone: { backgroundColor: GREEN, opacity: 0.45 },
  progressText: {
    textAlign: 'center',
    fontSize: 12,
    color: TEXT_HINT,
    marginBottom: 28,
  },

  // ── Acknowledgement ──
  ackCard: {
    marginHorizontal: 24,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 16,
  },
  checkRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: INPUT_BG,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  checkboxActive: {
    backgroundColor: GREEN_HIGHLIGHT,
    borderColor: GREEN_HIGHLIGHT,
  },
  ackText: {
    flex: 1,
    fontSize: 13,
    color: TEXT_MUTED,
    lineHeight: 20,
  },
  ackLink: {
    color: GREEN_HIGHLIGHT,
    fontWeight: '600',
  },
  warningRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  warningText: {
    fontSize: 12,
    color: GREEN,
    lineHeight: 18,
  },

  // ── Button ──
  btn: {
    backgroundColor: GREEN_BTN,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginHorizontal: 24,
    marginBottom: 8,
  },
  btnDisabled: {
    backgroundColor: 'rgba(58,173,126,0.1)',
    borderWidth: 1,
    borderColor: BORDER,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_WHITE,
    letterSpacing: 0.2,
  },
  btnTextDisabled: {
    color: TEXT_HINT,
  },
});