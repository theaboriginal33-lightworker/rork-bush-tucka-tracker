import type { CustomerInfo } from 'react-native-purchases';
import { supabase } from '@/constants/supabase';

const ENTITLEMENT_ID = 'premium';

type SyncArgs = {
  userId: string;
  customerInfo: CustomerInfo | null | undefined;
};

/**
 * Sync RevenueCat subscription state into `public.profiles`.
 * NOTE: This expects these columns to exist in your `profiles` table:
 * - subscription_active boolean
 * - subscription_plan text
 * - subscription_updated_at timestamptz
 * - revenuecat_entitlement_id text
 * - revenuecat_expiration_date timestamptz
 *
 * If columns are missing, we swallow the error so the app purchase flow still works.
 */
export async function syncSubscriptionToSupabase({ userId, customerInfo }: SyncArgs) {
  if (!customerInfo) return;

  const activeEntitlement = customerInfo.entitlements.active?.[ENTITLEMENT_ID];
  const subscription_active = activeEntitlement !== undefined;
  const subscription_plan =
    // productIdentifier is usually present for entitlements
    (activeEntitlement as any)?.productIdentifier ?? null;
  const expirationDateRaw = (activeEntitlement as any)?.expirationDate;
  const revenuecat_expiration_date = expirationDateRaw
    ? new Date(expirationDateRaw).toISOString()
    : null;

  const subscription_updated_at = new Date().toISOString();

  try {
    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: userId,
          subscription_active,
          subscription_plan,
          subscription_updated_at,
          revenuecat_entitlement_id: ENTITLEMENT_ID,
          revenuecat_expiration_date,
        },
        { onConflict: 'id' }
      );

    if (error) {
      console.log('[syncSubscriptionToSupabase] upsert error:', error);
    }
  } catch (e) {
    console.log('[syncSubscriptionToSupabase] unexpected error:', e);
  }
}

