import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image as RNImage, ImageStyle, Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

function isAttachmentLikeUri(uri: string): boolean {
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
  preferAttachmentProxy?: boolean;
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
  preferAttachmentProxy,
}: LearnRemoteImageProps) {
  const [hasError, setHasError] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentUri, setCurrentUri] = useState<string>('');

  const normalizedUri = useMemo(() => String(uri ?? '').trim(), [uri]);

  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
    setCurrentUri(normalizedUri);
  }, [normalizedUri]);

  const attachmentProxyUri = useMemo(() => {
    if (!normalizedUri) return '';
    if (!isAttachmentLikeUri(normalizedUri)) return '';
    return proxyToJpeg(normalizedUri);
  }, [normalizedUri]);

  const effectivePreferAttachmentProxy = preferAttachmentProxy ?? true;

  useEffect(() => {
    if (!effectivePreferAttachmentProxy) return;
    if (!attachmentProxyUri) return;
    if (currentUri === attachmentProxyUri) return;

    console.log('[LearnRemoteImage] using proxy as primary for attachment', {
      original: normalizedUri,
      proxy: attachmentProxyUri,
      platform: Platform.OS,
    });
    setCurrentUri(attachmentProxyUri);
  }, [attachmentProxyUri, currentUri, effectivePreferAttachmentProxy, normalizedUri]);

  const resolvedUri = useMemo(() => String(currentUri ?? '').trim(), [currentUri]);

  if (!resolvedUri) {
    return (
      <View style={style} testID={testID}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  const fallback = (
    <View style={style} testID={testID ? `${testID}-rn-wrap` : undefined}>
      <RNImage
        source={{ uri: resolvedUri }}
        style={{ width: '100%', height: '100%' }}
        resizeMode={contentFit === 'contain' ? 'contain' : 'cover'}
        onLoad={() => {
          console.log('[LearnRemoteImage] RNImage loaded', { uri: resolvedUri, platform: Platform.OS });
          setIsLoading(false);
          onLoad?.();
        }}
        onError={(e) => {
          const err = (e as unknown as { nativeEvent?: { error?: string } })?.nativeEvent?.error;
          console.log('[LearnRemoteImage] RNImage error', {
            uri: resolvedUri,
            platform: Platform.OS,
            error: err,
            original: normalizedUri,
            attachmentProxyUri,
          });

          if (attachmentProxyUri && resolvedUri !== attachmentProxyUri) {
            console.log('[LearnRemoteImage] RNImage switching to proxy', {
              from: resolvedUri,
              to: attachmentProxyUri,
              platform: Platform.OS,
            });
            setCurrentUri(attachmentProxyUri);
            return;
          }

          setIsLoading(false);
          onError?.(err);
        }}
        testID={testID ? `${testID}-rn` : undefined}
      />

      {isLoading ? (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.06)',
          }}
          pointerEvents="none"
          testID={testID ? `${testID}-loading` : undefined}
        >
          <ActivityIndicator />
        </View>
      ) : null}
    </View>
  );

  if (hasError) return fallback;

  return (
    <View style={style} testID={testID ? `${testID}-expo-wrap` : undefined}>
      <ExpoImage
        key={resolvedUri}
        source={{ uri: resolvedUri }}
        style={{ width: '100%', height: '100%' }}
        contentFit={contentFit}
        transition={transition}
        cachePolicy={cachePolicy}
        onLoad={() => {
          console.log('[LearnRemoteImage] ExpoImage loaded', { uri: resolvedUri, platform: Platform.OS });
          setIsLoading(false);
          onLoad?.();
        }}
        onError={(e) => {
          const err = (e as unknown as { error?: string } | null | undefined)?.error;
          console.log('[LearnRemoteImage] ExpoImage error', {
            uri: resolvedUri,
            platform: Platform.OS,
            error: err,
            original: normalizedUri,
            attachmentProxyUri,
          });

          if (attachmentProxyUri && resolvedUri !== attachmentProxyUri) {
            console.log('[LearnRemoteImage] ExpoImage switching to proxy', {
              from: resolvedUri,
              to: attachmentProxyUri,
              platform: Platform.OS,
            });
            setCurrentUri(attachmentProxyUri);
            return;
          }

          console.log('[LearnRemoteImage] ExpoImage error -> fallback RNImage', { uri: resolvedUri, platform: Platform.OS });
          setIsLoading(false);
          setHasError(true);
          onError?.(err);
        }}
        testID={testID ? `${testID}-expo` : undefined}
      />

      {isLoading ? (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.06)',
          }}
          pointerEvents="none"
          testID={testID ? `${testID}-loading` : undefined}
        >
          <ActivityIndicator />
        </View>
      ) : null}
    </View>
  );
}
