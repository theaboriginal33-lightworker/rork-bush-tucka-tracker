import React, { useEffect, useMemo, useState } from 'react';
import { Image as RNImage, Platform, StyleProp, View, ViewStyle } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

type LearnRemoteImageProps = {
  uri: string;
  style?: StyleProp<ViewStyle>;
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

  if (!normalizedUri) {
    return <View style={style} testID={testID} />;
  }

  const fallback = (
    <RNImage
      source={{ uri: normalizedUri }}
      style={style as never}
      resizeMode={contentFit === 'contain' ? 'contain' : 'cover'}
      onLoad={() => {
        console.log('[LearnRemoteImage] RNImage loaded', { uri: normalizedUri, platform: Platform.OS });
        onLoad?.();
      }}
      onError={(e) => {
        console.log('[LearnRemoteImage] RNImage error', {
          uri: normalizedUri,
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
      key={normalizedUri}
      source={{ uri: normalizedUri }}
      style={style}
      contentFit={contentFit}
      transition={transition}
      cachePolicy={cachePolicy}
      onLoad={() => {
        console.log('[LearnRemoteImage] ExpoImage loaded', { uri: normalizedUri, platform: Platform.OS });
        onLoad?.();
      }}
      onError={(e) => {
        const err = (e as unknown as { error?: string } | null | undefined)?.error;
        console.log('[LearnRemoteImage] ExpoImage error -> fallback RNImage', {
          uri: normalizedUri,
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
