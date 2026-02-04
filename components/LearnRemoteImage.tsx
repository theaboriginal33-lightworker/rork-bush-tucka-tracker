import React, { useEffect, useMemo, useState } from 'react';
import { Image as RNImage, ImageStyle, Platform, StyleProp, View, ViewStyle } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

function shouldProxyForAttachments(uri: string): boolean {
  const lower = uri.toLowerCase();
  if (lower.includes('r2.dev/attachments/') || lower.includes('r2-pub.rork.com/attachments/')) return true;
  if (lower.includes('pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/')) return true;
  return false;
}

function proxyToJpeg(uri: string): string {
  const trimmed = uri.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return `https://images.weserv.nl/?url=${encodeURIComponent(withScheme)}&output=jpg&n=-1`;
}

type LearnRemoteImageProps = {
  uri: string;
  style?: StyleProp<ViewStyle | ImageStyle>;
  contentFit?: 'cover' | 'contain' | 'fill' | 'scale-down' | 'none';
  cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk';
  transition?: number;
  testID?: string;
  onLoad?: () => void;
  onError?: (error: string | null | undefined) => void;
};

export function LearnRemoteImage({
  uri,
  style,
  contentFit = 'cover',
  cachePolicy = 'disk',
  transition = 140,
  testID,
  onLoad,
  onError,
}: LearnRemoteImageProps) {
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    setHasError(false);
  }, [uri]);

  const normalizedUri = useMemo(() => String(uri ?? '').trim(), [uri]);

  const resolvedUri = useMemo(() => {
    if (!normalizedUri) return '';

    const shouldProxy = Platform.OS === 'web' && shouldProxyForAttachments(normalizedUri);

    if (shouldProxy) {
      const proxied = proxyToJpeg(normalizedUri);
      console.log('[LearnRemoteImage] proxying attachment image (web only)', {
        from: normalizedUri,
        to: proxied,
        platform: Platform.OS,
      });
      return proxied;
    }

    return normalizedUri;
  }, [normalizedUri]);

  if (!resolvedUri) {
    return <View style={style} testID={testID} />;
  }

  const fallback = (
    <RNImage
      source={{ uri: resolvedUri }}
      style={style as never}
      resizeMode={contentFit === 'contain' ? 'contain' : 'cover'}
      onLoad={() => {
        console.log('[LearnRemoteImage] RNImage loaded', { uri: resolvedUri, platform: Platform.OS });
        onLoad?.();
      }}
      onError={(e) => {
        console.log('[LearnRemoteImage] RNImage error', {
          uri: resolvedUri,
          platform: Platform.OS,
          error: (e as unknown as { nativeEvent?: { error?: string } })?.nativeEvent?.error,
        });
        onError?.((e as unknown as { nativeEvent?: { error?: string } })?.nativeEvent?.error);
      }}
      testID={testID ? `${testID}-rn` : undefined}
    />
  );

  if (hasError) return fallback;

  return (
    <ExpoImage
      key={resolvedUri}
      source={{ uri: resolvedUri }}
      style={style as never}
      contentFit={contentFit}
      transition={transition}
      cachePolicy={cachePolicy}
      onLoad={() => {
        console.log('[LearnRemoteImage] ExpoImage loaded', { uri: resolvedUri, platform: Platform.OS });
        onLoad?.();
      }}
      onError={(e) => {
        const err = (e as unknown as { error?: string } | null | undefined)?.error;
        console.log('[LearnRemoteImage] ExpoImage error -> fallback RNImage', {
          uri: resolvedUri,
          platform: Platform.OS,
          error: err,
        });
        setHasError(true);
        onError?.(err);
      }}
      testID={testID ? `${testID}-expo` : undefined}
    />
  );
}
