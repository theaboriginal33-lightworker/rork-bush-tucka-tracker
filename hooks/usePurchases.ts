import { useState, useEffect, useCallback } from 'react';
import Purchases, {
  PurchasesPackage,
  CustomerInfo,
} from 'react-native-purchases';
import { Platform } from 'react-native';

const ENTITLEMENT_ID = 'premium';

export type PurchaseResult = {
  success: boolean;
  customerInfo: CustomerInfo;
};

export function usePurchases() {
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);
  const [annualPackage, setAnnualPackage] = useState<PurchasesPackage | null>(null);
  const [lifetimePackage, setLifetimePackage] = useState<PurchasesPackage | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  const isPremium =
    customerInfo?.entitlements.active[ENTITLEMENT_ID] !== undefined;

  useEffect(() => {
    if (Platform.OS === 'web') {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const [offerings, info] = await Promise.all([
          Purchases.getOfferings(),
          Purchases.getCustomerInfo(),
        ]);

        const current = offerings.current;

        const monthly =
          current?.availablePackages.find(
            (p) => p.product.identifier === 'bushtucka_monthly_v2'
          ) ?? current?.monthly ?? null;

        const annual =
          current?.availablePackages.find(
            (p) => p.product.identifier === 'bushtucka_annual'
          ) ?? current?.annual ?? null;

        const lifetime =
          current?.availablePackages.find(
            (p) => p.product.identifier === 'bushtucka_lifetime'
          ) ?? current?.lifetime ?? null;

        setMonthlyPackage(monthly);
        setAnnualPackage(annual);
        setLifetimePackage(lifetime);
        setCustomerInfo(info);
      } catch (e) {
        console.error('[usePurchases] load error:', e);
      } finally {
        setLoading(false);
      }
    };

    load();

    const listener: any = Purchases.addCustomerInfoUpdateListener(setCustomerInfo);
    return () => {
      const remover = listener?.remove;
      if (typeof remover === 'function') {
        remover.call(listener);
      }
    };
  }, []);

  const purchasePackage = useCallback(async (pkg: PurchasesPackage): Promise<PurchaseResult> => {
    try {
      setPurchasing(true);
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(customerInfo);
      const success = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
      return { success, customerInfo };
    } catch (e: any) {
      if (e.userCancelled) {
        return { success: false, customerInfo: customerInfo ?? ({} as CustomerInfo) };
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
    purchaseMonthly,
    purchaseAnnual,
    purchaseLifetime,
    restorePurchases,
  };
}
