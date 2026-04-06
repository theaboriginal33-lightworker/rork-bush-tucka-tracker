import { useState, useEffect, useCallback } from 'react';
import Purchases, {
  PurchasesPackage,
  CustomerInfo,
} from 'react-native-purchases';
import { Platform } from 'react-native';

const ENTITLEMENT_ID = 'premium';

export function usePurchases() {
  const [monthlyPackage, setMonthlyPackage] = useState<PurchasesPackage | null>(null);
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

        console.log('[usePurchases] offerings:', JSON.stringify(offerings.current?.availablePackages.map(p => p.product.identifier)));
        console.log('[usePurchases] current offering:', offerings.current?.identifier);

        const pkg = offerings.current?.availablePackages.find(
          (p) => p.product.identifier === 'bushtucka_monthly'
        ) ?? offerings.current?.monthly ?? null;

        console.log('[usePurchases] selected package:', pkg?.product.identifier ?? 'NULL');
        setMonthlyPackage(pkg);
        setCustomerInfo(info);
      } catch (e) {
        console.error('[usePurchases] load error:', e);
      } finally {
        setLoading(false);
      }
    };

    load();

    const listener = Purchases.addCustomerInfoUpdateListener(setCustomerInfo);
    return () => listener.remove();
  }, []);

  const purchaseMonthly = useCallback(async (): Promise<boolean> => {
    if (!monthlyPackage) throw new Error('Product not loaded');
    try {
      setPurchasing(true);
      const { customerInfo } = await Purchases.purchasePackage(monthlyPackage);
      setCustomerInfo(customerInfo);
      return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
    } catch (e: any) {
      if (e.userCancelled) return false;
      throw e;
    } finally {
      setPurchasing(false);
    }
  }, [monthlyPackage]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      setPurchasing(true);
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);
      return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
    } finally {
      setPurchasing(false);
    }
  }, []);

  return {
    monthlyPackage,
    customerInfo,
    loading,
    purchasing,
    isPremium,
    purchaseMonthly,
    restorePurchases,
  };
}
