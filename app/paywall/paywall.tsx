import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { usePurchases } from "@/hooks/usePurchases";

// ─── Check Icon ──────────────────────────────────────────────────────────────
const CheckIcon = () => (
  <View style={styles.checkCircle}>
    <Text style={styles.checkMark}>✓</Text>
  </View>
);

// ─── Forest Hero ─────────────────────────────────────────────────────────────
const ForestHero = () => (
  <View style={styles.heroWrapper}>
    <LinearGradient
      colors={["#3d6b52", "#2a4a38", "#1a3a1a", "#0d2010", "#111"]}
      style={StyleSheet.absoluteFill}
    />
    <Svg
      viewBox="0 0 360 220"
      width="100%"
      height="100%"
      style={StyleSheet.absoluteFill}
    >
      <Path
        d="M0 160 L60 90 L120 130 L180 70 L240 110 L300 60 L360 100 L360 220 L0 220Z"
        fill="#1a3020"
        opacity={0.7}
      />
      <Path
        d="M-20 220 L10 120 L30 145 L55 100 L75 130 L100 85 L120 115 L145 75 L165 105 L190 65 L210 100 L235 70 L255 105 L280 80 L300 110 L325 75 L345 105 L380 80 L380 220Z"
        fill="#0d1f0d"
      />
      <Path
        d="M-10 220 L20 140 L35 165 L55 120 L70 150 L90 105 L110 140 L130 100 L155 135 L175 90 L200 130 L225 95 L250 135 L275 100 L300 140 L325 110 L345 145 L370 115 L380 220Z"
        fill="#090f09"
      />
    </Svg>
    <LinearGradient
      colors={["transparent", "#111"]}
      style={[StyleSheet.absoluteFill, { top: "55%" }]}
    />
  </View>
);

// ─── Main Screen ─────────────────────────────────────────────────────────────
export default function PaywallScreen() {
  const router = useRouter();
  const { purchasing, purchaseMonthly, restorePurchases } = usePurchases();

  const handlePurchase = async () => {
    try {
      const success = await purchaseMonthly();
      if (success) {
        Alert.alert("Welcome!", "You now have full access.", [
          { text: "Let's go!", onPress: () => router.back() },
        ]);
      }
    } catch {
      Alert.alert("Purchase Failed", "Something went wrong. Please try again.");
    }
  };

  const handleRestore = async () => {
    try {
      const success = await restorePurchases();
      Alert.alert(
        success ? "Restored!" : "No Purchases Found",
        success
          ? "Your subscription has been restored."
          : "No active subscriptions found."
      );
      if (success) router.back();
    } catch {
      Alert.alert("Error", "Could not restore purchases.");
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View>
          <ForestHero />
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* ── Content ── */}
        <View style={styles.content}>

          {/* Headline */}
          <Text style={styles.headline}>
            Unlock the Full Bush{"\n"}Tucka Experience
          </Text>
          <Text style={styles.subtext}>
            Join our community to get unlimited plant identifications, full
            access to the deep-dive Tucka Guide, and premium mapping features.
          </Text>

          {/* Monthly plan card */}
          <View style={styles.planCard}>
            <View style={styles.planHeader}>
              <View>
                <Text style={styles.planTitle}>Monthly Plan</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>$4.99</Text>
                  <Text style={styles.pricePer}> / month</Text>
                </View>
                <Text style={styles.cancelLabel}>Cancel anytime</Text>
              </View>
              <View style={styles.greenDot} />
            </View>

            <View style={styles.divider} />

            <View style={styles.features}>
              {[
                "Unlimited plant identifications",
                "Full Tucka Guide access",
                "Premium offline mapping",
                "Community access",
              ].map((f) => (
                <View key={f} style={styles.featureRow}>
                  <CheckIcon />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={handlePurchase}
            activeOpacity={0.88}
            disabled={purchasing}
          >
            <LinearGradient
              colors={["#4ade80", "#22c55e"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaGradient}
            >
              {purchasing ? (
                <ActivityIndicator color="#051a05" />
              ) : (
                <>
                  <Text style={styles.ctaText}>Get Full Access</Text>
                  <Text style={styles.ctaSubText}>$4.99 / month</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={handleRestore}>
              <Text style={styles.footerLink}>RESTORE PURCHASES</Text>
            </TouchableOpacity>
            <Text style={styles.footerSep}>    </Text>
            <TouchableOpacity>
              <Text style={styles.footerLink}>TERMS & PRIVACY</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const GREEN = "#4ade80";
const BG = "#111";

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flexGrow: 1,
  },

  // Hero
  heroWrapper: {
    height: 220,
    width: "100%",
    overflow: "hidden",
  },
  closeBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : 16,
    right: 16,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    color: "#fff",
    fontSize: 13,
    lineHeight: 16,
  },

  // Content
  content: {
    paddingHorizontal: 20,
    paddingBottom: 36,
    backgroundColor: BG,
  },
  headline: {
    fontSize: 26,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginTop: 10,
    marginBottom: 10,
    lineHeight: 33,
  },
  subtext: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 22,
    fontWeight: "300",
  },

  // Plan card
  planCard: {
    backgroundColor: "rgba(74,222,128,0.06)",
    borderWidth: 1.5,
    borderColor: GREEN,
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  greenDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: GREEN,
    marginTop: 6,
  },
  planTitle: {
    color: GREEN,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  price: {
    color: "#fff",
    fontSize: 40,
    fontWeight: "700",
  },
  pricePer: {
    color: "#888",
    fontSize: 14,
  },
  cancelLabel: {
    color: "#666",
    fontSize: 12,
    marginTop: 4,
  },

  divider: {
    height: 1,
    backgroundColor: "#2a2a2a",
    marginVertical: 16,
  },

  // Features
  features: {
    gap: 10,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureText: {
    color: "#ccc",
    fontSize: 14,
    fontWeight: "300",
  },

  // Check icon
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(74,222,128,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    color: GREEN,
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
  },

  // CTA
  ctaBtn: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 14,
  },
  ctaGradient: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  ctaText: {
    color: "#051a05",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  ctaSubText: {
    color: "#051a05",
    fontSize: 12,
    fontWeight: "500",
    opacity: 0.7,
  },

  // Footer
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerLink: {
    color: "#555",
    fontSize: 11,
    letterSpacing: 0.5,
    fontWeight: "500",
  },
  footerSep: {
    color: "#333",
  },
});
