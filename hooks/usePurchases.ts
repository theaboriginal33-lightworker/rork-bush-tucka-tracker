import { useState, useEffect, useCallback } from 'react';
import Purchases, {
  PurchasesPackage,
  CustomerInfo,
  PURCHASES_ERROR_CODE,
} from 'react-native-purchases';
import { Platform } from 'react-native';

const ENTITLEMENT_ID = 'premium';

/** App Store uses underscores; Google Play product IDs allow only lowercase letters, digits, and hyphens. */
const MONTHLY_PRODUCT_IDS = ['bushtucka_monthly_v2', 'bushtucka-monthly-v2'];
const ANNUAL_PRODUCT_IDS = ['bushtucka_annual', 'bushtucka-annual'];
const LIFETIME_PRODUCT_IDS = ['bushtucka_lifetime', 'bushtucka-lifetime'];

/** Play Billing 5+ often returns `productId:basePlanId`; RevenueCat passes that as `product.identifier`. */
function productIdentifierMatches(identifier: string, candidates: string[]): boolean {
  if (candidates.includes(identifier)) return true;
  const beforeColon = identifier.split(':')[0];
  return candidates.includes(beforeColon);
}

function isPurchaseUserCancelled(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const err = e as Record<string, unknown>;
  if (err.userCancelled === true) return true;
  if (err.readableErrorCode === 'PURCHASE_CANCELLED') return true;
  const code = err.code;
  if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return true;
  if (typeof code === 'string' && code.includes('CANCELLED')) return true;
  return false;
}

function purchaseErrorMessage(e: unknown): string {
  if (!e || typeof e !== 'object') return 'Unknown error';
  const err = e as { message?: string; underlyingErrorMessage?: string };
  const m = typeof err.message === 'string' ? err.message.trim() : '';
  const u =
    typeof err.underlyingErrorMessage === 'string' ? err.underlyingErrorMessage.trim() : '';
  return [m, u].filter(Boolean).join('\n') || 'Unknown error';
}

export type PurchaseResult = {
  success: boolean;
  customerInfo: CustomerInfo;
  userCancelled?: boolean;
};

export function usePurchases() {
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);
  const [annualPackage, setAnnualPackage] = useState<PurchasesPackage | null>(null);
  const [lifetimePackage, setLifetimePackage] = useState<PurchasesPackage | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [offeringsError, setOfferingsError] = useState<string | null>(null);
  const [availablePackageIds, setAvailablePackageIds] = useState<string[]>([]);

  const isPremium =
    customerInfo?.entitlements.active[ENTITLEMENT_ID] !== undefined;

  const refreshOfferings = useCallback(async () => {
    if (Platform.OS === 'web') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setOfferingsError(null);
    try {
      const [offerings, info] = await Promise.all([
        Purchases.getOfferings(),
        Purchases.getCustomerInfo(),
      ]);

      const current = offerings.current;
      const ids = (current?.availablePackages ?? []).map((p) => p.product.identifier);
      setAvailablePackageIds(ids);

      const monthly =
        current?.availablePackages.find((p) =>
          productIdentifierMatches(p.product.identifier, MONTHLY_PRODUCT_IDS),
        ) ?? current?.monthly ?? null;

      const annual =
        current?.availablePackages.find((p) =>
          productIdentifierMatches(p.product.identifier, ANNUAL_PRODUCT_IDS),
        ) ?? current?.annual ?? null;

      const lifetime =
        current?.availablePackages.find((p) =>
          productIdentifierMatches(p.product.identifier, LIFETIME_PRODUCT_IDS),
        ) ?? current?.lifetime ?? null;

      setMonthlyPackage(monthly);
      setAnnualPackage(annual);
      setLifetimePackage(lifetime);
      setCustomerInfo(info);

      if (!current) {
        setOfferingsError('No current offering in RevenueCat. Set a current offering in the dashboard.');
      } else if (!monthly && !annual && !lifetime) {
        setOfferingsError(
          `No matching products in offering "${current.identifier}". Loaded product IDs: ${ids.length ? ids.join(', ') : '(none)'}. Check RevenueCat ↔ Play Console product IDs.`,
        );
      } else {
        setOfferingsError(null);
      }
    } catch (e) {
      console.error('[usePurchases] load error:', e);
      setOfferingsError(purchaseErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      setLoading(false);
      return;
    }

    const load = async () => {
      await refreshOfferings();
    };

    load();

    const listener: any = Purchases.addCustomerInfoUpdateListener(setCustomerInfo);
    return () => {
      const remover = listener?.remove;
      if (typeof remover === 'function') {
        remover.call(listener);
      }
    };
  }, [refreshOfferings]);

  const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<PurchaseResult> => {
    try {
      setPurchasing(true);
      const { customerInfo: nextInfo } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(nextInfo);
      const success = nextInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
      return { success, customerInfo: nextInfo };
    } catch (e: unknown) {
      if (isPurchaseUserCancelled(e)) {
        return {
          success: false,
          userCancelled: true,
          customerInfo: customerInfo ?? ({} as CustomerInfo),
        };
      }
      throw e;
    } finally {
      setPurchasing(false);
    }
  }, [customerInfo]);

  const purchaseMonthly = useCallback(async (): Promise<PurchaseResult> => {
    if (!monthlyPackage) {
      console.warn('[usePurchases] monthlyPackage is null — not loaded from RevenueCat');
      throw new Error('Monthly product not available. Check RevenueCat offerings.');
    }
    return purchasePackage(monthlyPackage);
  }, [monthlyPackage, purchasePackage]);

  const purchaseAnnual = useCallback(async (): Promise<PurchaseResult> => {
    if (!annualPackage) {
      console.warn('[usePurchases] annualPackage is null — not loaded from RevenueCat');
      throw new Error('Annual product not available. Check RevenueCat offerings.');
    }
    return purchasePackage(annualPackage);
  }, [annualPackage, purchasePackage]);

  const purchaseLifetime = useCallback(async (): Promise<PurchaseResult> => {
    if (!lifetimePackage) {
      console.warn('[usePurchases] lifetimePackage is null — not loaded from RevenueCat');
      throw new Error('Lifetime product not available. Check RevenueCat offerings.');
    }
    return purchasePackage(lifetimePackage);
  }, [lifetimePackage, purchasePackage]);

  const restorePurchases = useCallback(async (): Promise<PurchaseResult> => {
    try {
      setPurchasing(true);
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      const success = info.entitlements.active[ENTITLEMENT_ID] !== undefined;
      return { success, customerInfo: info };
    } finally {
      setPurchasing(false);
    }
  }, []);

  return {
    monthlyPackage,
    annualPackage,
    lifetimePackage,
    customerInfo,
    loading,
    purchasing,
    isPremium,
    offeringsError,
    availablePackageIds,
    refreshOfferings,
    purchaseMonthly,
    purchaseAnnual,
    purchaseLifetime,
    restorePurchases,
  };
}
