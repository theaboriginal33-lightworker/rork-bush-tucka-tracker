import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image as RNImage,
  ImageStyle,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
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
  const withoutScheme = withScheme.replace(/^https?:\/\//i, '');
  return `https://wsrv.nl/?url=${encodeURIComponent(withoutScheme)}&output=jpg&n=-1`;
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
  const [loadTimedOut, setLoadTimedOut] = useState<boolean>(false);
  const loadStartRef = useRef<number>(Date.now());

  const normalizedUri = useMemo(() => String(uri ?? '').trim(), [uri]);

  useEffect(() => {
    setHasError(false);
    setIsLoading(true);
    setLoadTimedOut(false);
    setCurrentUri(normalizedUri);
    loadStartRef.current = Date.now();
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
  const renderUri = resolvedUri;

  useEffect(() => {
    if (!resolvedUri) return;

    const timeoutMs = 9000;
    const t = setTimeout(() => {
      if (!isLoading) return;
      console.log('[LearnRemoteImage] load timeout -> forcing fallback', {
        uri: resolvedUri,
        platform: Platform.OS,
        ms: Date.now() - loadStartRef.current,
        original: normalizedUri,
        attachmentProxyUri,
      });
      setLoadTimedOut(true);
      setHasError(true);
      setIsLoading(false);
      onError?.('timeout');
    }, timeoutMs);

    return () => clearTimeout(t);
  }, [attachmentProxyUri, isLoading, normalizedUri, onError, resolvedUri]);


  const containerStyle = useMemo<StyleProp<ViewStyle>>(() => {
    const base: ViewStyle = {
      position: 'relative',
      minWidth: 1,
      minHeight: 1,
      backgroundColor: 'rgba(255,255,255,0.02)',
    };
    return [base, style as StyleProp<ViewStyle>];
  }, [style]);

  const imageFillStyle = useMemo<StyleProp<ImageStyle>>(() => {
    const s: ImageStyle = {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    };
    return s;
  }, []);

  if (!renderUri) {
    return (
      <View style={containerStyle} testID={testID}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  const fallback = (
    <View style={containerStyle} testID={testID ? `${testID}-rn-wrap` : undefined}>
      <RNImage
        source={{ uri: renderUri }}
        style={imageFillStyle}
        resizeMode={contentFit === 'contain' ? 'contain' : 'cover'}
        onLoad={() => {
          console.log('[LearnRemoteImage] RNImage loaded', { uri: renderUri, platform: Platform.OS, resolvedUri });
          setIsLoading(false);
          onLoad?.();
        }}
        onError={(e) => {
          const err = (e as unknown as { nativeEvent?: { error?: string } })?.nativeEvent?.error;
          console.log('[LearnRemoteImage] RNImage error', {
            uri: renderUri,
            resolvedUri,
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
          setLoadTimedOut(false);
          onError?.(err);
        }}
        testID={testID ? `${testID}-rn` : undefined}
      />

      {isLoading ? (
        <View
          style={[
            styles.loadingOverlay,
            { backgroundColor: 'rgba(0,0,0,0.06)' },
          ]}
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
    <View style={containerStyle} testID={testID ? `${testID}-expo-wrap` : undefined}>
      <ExpoImage
        key={renderUri}
        source={{ uri: renderUri }}
        style={imageFillStyle}
        contentFit={contentFit}
        transition={transition}
        cachePolicy={cachePolicy}
        onLoad={() => {
          console.log('[LearnRemoteImage] ExpoImage loaded', { uri: renderUri, platform: Platform.OS, resolvedUri });
          setIsLoading(false);
          onLoad?.();
        }}
        onError={(e) => {
          const err = (e as unknown as { error?: string } | null | undefined)?.error;
          console.log('[LearnRemoteImage] ExpoImage error', {
            uri: renderUri,
            resolvedUri,
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

          console.log('[LearnRemoteImage] ExpoImage error -> fallback RNImage', { uri: renderUri, platform: Platform.OS, resolvedUri });
          setIsLoading(false);
          setHasError(true);
          onError?.(err);
        }}
        testID={testID ? `${testID}-expo` : undefined}
      />

      {isLoading ? (
        <View style={[styles.loadingOverlay, { backgroundColor: 'rgba(0,0,0,0.06)' }]} pointerEvents="none" testID={testID ? `${testID}-loading` : undefined}>
          <ActivityIndicator />
        </View>
      ) : null}

      {loadTimedOut ? (
        <View
          style={[
            styles.loadingOverlay,
            { backgroundColor: 'rgba(0,0,0,0.24)', paddingHorizontal: 10 },
          ]}
          pointerEvents="none"
          testID={testID ? `${testID}-timeout` : undefined}
        >
          <Text style={styles.timeoutText} numberOfLines={2}>
            Image timed out
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeoutText: {
    marginTop: 10,
    color: 'rgba(20,20,20,0.7)',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
