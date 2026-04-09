import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { usePurchases } from "@/hooks/usePurchases";
import { useAuth } from "@/app/providers/AuthProvider";
import { syncSubscriptionToSupabase } from "@/hooks/useSubscriptionSync";

type PlanKey = "monthly" | "annual" | "lifetime";

const GREEN = "#4ade80";
const GOLD = "#f59e0b";
const BG = "#0d1a0d";
const ACTIVE_LABEL = "#9ae6b4";

function RadioButton({ selected, color = GREEN }: { selected: boolean; color?: string }) {
  return (
    <View style={[styles.radio, { borderColor: selected ? color : "#555" }]}>
      {selected && <View style={[styles.radioDot, { backgroundColor: color }]} />}
    </View>
  );
}

function CheckItem({ text, color = GREEN }: { text: string; color?: string }) {
  return (
    <View style={styles.checkRow}>
      <Text style={[styles.checkIcon, { color }]}>✓</Text>
      <Text style={styles.checkText}>{text}</Text>
    </View>
  );
}

export default function PaywallScreen() {
  const router = useRouter();
  const { user, refreshOnboarding } = useAuth();
  const suppressAlreadyPremiumEffectRef = useRef(false);
  const {
    purchasing,
    isPremium,
    customerInfo,
    monthlyPackage,
    annualPackage,
    lifetimePackage,
    purchaseMonthly,
    purchaseAnnual,
    purchaseLifetime,
    restorePurchases,
  } = usePurchases();
  // No default selection: user must choose a plan explicitly.
  const [selectedPlan, setSelectedPlan] = useState<PlanKey | null>(null);
  
  const activeProductId = (customerInfo?.entitlements.active as any)?.premium?.productIdentifier as
    | string
    | undefined;
  const activePlan: PlanKey | null =
    !activeProductId ? null
    : activeProductId.includes('annual') ? 'annual'
    : activeProductId.includes('lifetime') ? 'lifetime'
    : activeProductId.includes('monthly') ? 'monthly'
    : null;

  useEffect(() => {
    if (!user) return;
    if (!isPremium) return;
    if (purchasing) return;
    if (suppressAlreadyPremiumEffectRef.current) return;
    void syncSubscriptionToSupabase({ userId: user.id, customerInfo }).finally(() => {
      void refreshOnboarding();
    });
  }, [user, isPremium, purchasing, customerInfo, refreshOnboarding]);

  const annualPrice = annualPackage?.product.priceString ?? "$79";
  const monthlyPrice = monthlyPackage?.product.priceString ?? "$9.99";
  const lifetimePrice = lifetimePackage?.product.priceString ?? "$199";

  const selectedPackage =
    selectedPlan === "monthly" ? monthlyPackage
    : selectedPlan === "annual" ? annualPackage
    : selectedPlan === "lifetime" ? lifetimePackage
    : null;

  const handlePurchase = async () => {
    if (!selectedPlan) {
      Alert.alert("Choose a plan", "Please select Monthly, Annual, or Lifetime first.");
      return;
    }
    if (!selectedPackage) {
      Alert.alert(
        "Product Not Loaded",
        "This product couldn't be loaded. Make sure you're signed into a Sandbox account."
      );
      return;
    }
    try {
      let result: Awaited<ReturnType<typeof purchaseMonthly>> | null = null;
      if (selectedPlan === "monthly") result = await purchaseMonthly();
      else if (selectedPlan === "annual") result = await purchaseAnnual();
      else result = await purchaseLifetime();

      if (result?.success) {
        if (user) {
          await syncSubscriptionToSupabase({
            userId: user.id,
            customerInfo: result.customerInfo,
          });
        }
        await refreshOnboarding();
        suppressAlreadyPremiumEffectRef.current = true;
        Alert.alert("Success", "You now have full access to the app.", [
          { text: "OK", onPress: () => router.replace("/") },
        ]);
      }
    } catch (e: any) {
      Alert.alert("Purchase Failed", e?.message ?? "Something went wrong. Please try again.");
    }
  };

  const handleRestore = async () => {
    try {
      const result = await restorePurchases();
      const success = result.success;
      Alert.alert(
        success ? "Restored!" : "No Purchases Found",
        success ? "Your subscription has been restored." : "No active subscriptions found."
      );
      if (success) {
        if (user) {
          await syncSubscriptionToSupabase({
            userId: user.id,
            customerInfo: result.customerInfo,
          });
        }
        await refreshOnboarding();
        suppressAlreadyPremiumEffectRef.current = true;
        Alert.alert("Success", "Your purchase has been restored. You now have full access.", [
          { text: "OK", onPress: () => router.replace("/") },
        ]);
      }
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
        {/* ── Hero Image ── */}
        <View style={styles.heroContainer}>
          <Image
            source={require("@/assets/images/paywallbackground.png")}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={["transparent", BG]}
            style={[StyleSheet.absoluteFill, { top: "45%" }]}
          />
          {/* Only allow closing paywall if user already has an active plan */}
          {isPremium ? (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              testID="paywall-close"
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ── Content ── */}
        <View style={styles.content}>
          <Text style={styles.headline}>Unlock the Full Bush Tucka Experience</Text>
          <Text style={styles.subtext}>
            Unlimited plant identifications, full access to the Tucka Guide, and 60,000 years of Culturally Verified knowledge.
          </Text>

          {/* ── Annual — BEST VALUE ── */}
          <View style={styles.bestValueWrapper}>
            <View style={styles.bestValueBadge}>
              <Text style={styles.bestValueText}>BEST VALUE</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.planCard,
                styles.planCardAnnual,
                selectedPlan === "annual" && styles.planCardAnnualSelected,
              ]}
              onPress={() => setSelectedPlan("annual")}
              activeOpacity={0.85}
            >
              {/* Radio top-right */}
              <View style={styles.radioAbsolute}>
                <RadioButton selected={selectedPlan === "annual"} />
              </View>
              {/* Two-column body */}
              <View style={styles.cardBody}>
                <View style={styles.cardLeft}>
                  <Text style={styles.planName}>Annual</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.planPrice}>{annualPrice}</Text>
                    <Text style={styles.planPer}> / year</Text>
                  </View>
                  <Text style={styles.savingLabel}>Save 34% vs monthly</Text>
                  {isPremium && activePlan === 'annual' ? (
                    <Text style={styles.activePlanLabel}>Current plan (Active)</Text>
                  ) : null}
                </View>
                <View style={styles.cardRight}>
                  <CheckItem text="Unlimited plant identifications" />
                  <CheckItem text="Full Tucka Guide access" />
                  <CheckItem text="Priority access to new plant additions" />
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* ── Monthly ── */}
          <TouchableOpacity
            style={[
              styles.planCard,
              selectedPlan === "monthly" && styles.planCardMonthlySelected,
            ]}
            onPress={() => setSelectedPlan("monthly")}
            activeOpacity={0.85}
          >
            <View style={styles.radioAbsolute}>
              <RadioButton selected={selectedPlan === "monthly"} />
            </View>
            <View style={styles.cardBodySimple}>
              <View>
                <Text style={styles.planName}>Monthly</Text>
                {isPremium && activePlan === 'monthly' ? (
                  <Text style={styles.activePlanLabel}>Current plan (Active)</Text>
                ) : null}
              </View>
              <View style={styles.priceRow}>
                <Text style={styles.planPrice}>{monthlyPrice}</Text>
                <Text style={styles.planPer}> / month</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* ── Elder Tier — Lifetime ── */}
          <TouchableOpacity
            style={[
              styles.planCard,
              styles.planCardLifetime,
              selectedPlan === "lifetime" && styles.planCardLifetimeSelected,
            ]}
            onPress={() => setSelectedPlan("lifetime")}
            activeOpacity={0.85}
          >
            <View style={styles.radioAbsolute}>
              <RadioButton selected={selectedPlan === "lifetime"} color={GOLD} />
            </View>
            <View style={styles.cardBody}>
              <View style={styles.cardLeft}>
                <Text style={[styles.planName, { color: GOLD }]}>Elder Tier — Lifetime</Text>
                <View style={styles.priceRow}>
                  <Text style={[styles.planPrice, { color: GOLD }]}>{lifetimePrice}</Text>
                  <Text style={[styles.planPer, { color: "#c8860a" }]}> once</Text>
                </View>
                <Text style={styles.lifetimeDesc}>
                  Every future update. Forever.{"\n"}Never pay again.
                </Text>
                {isPremium && activePlan === 'lifetime' ? (
                  <Text style={styles.activePlanLabel}>Current plan (Active)</Text>
                ) : null}
              </View>
              <View style={styles.cardRight}>
                <CheckItem text="Lifetime access" color={GOLD} />
                <CheckItem text="Every update included" color={GOLD} />
                <CheckItem text="Zero subscriptions ever" color={GOLD} />
              </View>
            </View>
          </TouchableOpacity>

          {/* Comparison */}
          <Text style={styles.comparison}>
            Monthly over 3 years: $359.64 | Annual over 3 years: $237 | Elder Tier: $199 forever
          </Text>

          {/* CTA — Sandbox test: triggers Apple purchase sheet */}
          <TouchableOpacity
            style={[styles.ctaBtn, (!selectedPackage || purchasing) && { opacity: 0.6 }]}
            onPress={handlePurchase}
            activeOpacity={0.88}
            disabled={!selectedPackage || purchasing}
          >
            {purchasing ? (
              <ActivityIndicator color="#051a05" />
            ) : (
              <Text style={styles.ctaText}>Continue</Text>
            )}
          </TouchableOpacity>
          {/* Sandbox test note — remove before production */}
          <Text style={styles.sandboxNote}>Sandbox test mode active</Text>

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

          <View style={styles.brandRow}>
            <Text style={styles.brandText}>⊕  Bush Tucka Tracka BTT</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1 },

  // Hero
  heroContainer: { height: 280, width: "100%" },
  heroImage: { width: "100%", height: "100%" },
  closeBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  // Content
  content: { paddingHorizontal: 16, paddingBottom: 36, backgroundColor: BG },
  headline: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 10,
    lineHeight: 31,
  },
  subtext: {
    fontSize: 13,
    color: "#aaa",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },

  // Best value
  bestValueWrapper: { marginBottom: 10 },
  bestValueBadge: {
    alignSelf: "center",
    backgroundColor: GREEN,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: -12,
    zIndex: 1,
  },
  bestValueText: {
    color: "#051a05",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },

  // Plan cards
  planCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#2a2a2a",
    backgroundColor: "#151f15",
    padding: 16,
    marginBottom: 10,
    position: "relative",
  },
  planCardAnnual: { borderColor: "#2a4a2a", backgroundColor: "#121f12" },
  planCardAnnualSelected: { borderColor: GREEN, backgroundColor: "rgba(74,222,128,0.07)" },
  planCardMonthlySelected: { borderColor: GREEN },
  planCardLifetime: { borderColor: "#5c3a00", backgroundColor: "#1a1200" },
  planCardLifetimeSelected: { borderColor: GOLD, backgroundColor: "rgba(245,158,11,0.07)" },

  // Radio — absolute top right
  radioAbsolute: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 1,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },

  // Card body — two columns
  cardBody: {
    flexDirection: "row",
    paddingRight: 30, // space for radio button
  },
  cardBodySimple: {
    paddingRight: 30, // space for radio button
  },
  cardLeft: {
    flex: 1,
    marginRight: 12,
  },
  cardRight: {
    width: 155,
    gap: 2,
    justifyContent: "center",
  },

  // Text
  planName: { color: "#fff", fontSize: 15, fontWeight: "700", marginBottom: 4 },
  priceRow: { flexDirection: "row", alignItems: "baseline", marginBottom: 4 },
  planPrice: { color: "#fff", fontSize: 26, fontWeight: "600" },
  planPer: { color: "#888", fontSize: 14, fontWeight: "500" },
  savingLabel: {
    color: GREEN,
    fontSize: 12,
    fontWeight: "600",
    fontStyle: "italic",
  },
  activePlanLabel: {
    marginTop: 6,
    fontSize: 12,
    color: ACTIVE_LABEL,
    fontWeight: "800",
  },
  lifetimeDesc: {
    color: "#c8860a",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 4,
    lineHeight: 18,
  },

  // Check items
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  checkIcon: { fontSize: 12, fontWeight: "700", lineHeight: 18, flexShrink: 0 },
  checkText: { color: "#ccc", fontSize: 12, lineHeight: 18, flex: 1 },

  // Comparison
  comparison: {
    color: "#555",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 17,
    marginBottom: 16,
    marginTop: 4,
  },

  // CTA
  ctaBtn: {
    borderRadius: 50,
    backgroundColor: GREEN,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaText: { color: "#051a05", fontSize: 17, fontWeight: "800", letterSpacing: 0.2 },

  sandboxNote: { color: "#555", fontSize: 11, textAlign: "center", marginBottom: 14 },

  // Footer
  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 10 },
  footerLink: { color: "#555", fontSize: 11, letterSpacing: 0.5, fontWeight: "500" },
  footerSep: { color: "#333" },

  // Brand
  brandRow: { alignItems: "center", marginTop: 4 },
  brandText: { color: "#3a4a3a", fontSize: 12, fontWeight: "500", letterSpacing: 0.5 },
});
