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

function withCacheBust(uri: string, seed: number): string {
  const trimmed = uri.trim();
  if (!trimmed) return trimmed;
  const hasQuery = trimmed.includes('?');
  const sep = hasQuery ? '&' : '?';
  return `${trimmed}${sep}cb=${encodeURIComponent(String(seed))}`;
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
  const [attemptIndex, setAttemptIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadTimedOut, setLoadTimedOut] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const loadStartRef = useRef<number>(Date.now());

  const normalizedUri = useMemo(() => String(uri ?? '').trim(), [uri]);

  const attachmentProxyUri = useMemo(() => {
    if (!normalizedUri) return '';
    if (!isAttachmentLikeUri(normalizedUri)) return '';
    return proxyToJpeg(normalizedUri);
  }, [normalizedUri]);

  const effectivePreferAttachmentProxy = preferAttachmentProxy ?? true;

  const candidates = useMemo<string[]>(() => {
    const list: string[] = [];
    const base = normalizedUri;
    const proxy = attachmentProxyUri;

    if (effectivePreferAttachmentProxy && proxy) list.push(proxy);
    if (base) list.push(base);
    if (!effectivePreferAttachmentProxy && proxy) list.push(proxy);

    if (base) {
      list.push(withCacheBust(base, Date.now()));
    }

    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const item of list) {
      const key = item.trim();
      if (!key) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(key);
    }

    return deduped;
  }, [attachmentProxyUri, effectivePreferAttachmentProxy, normalizedUri]);

  const renderUri = useMemo(() => {
    const picked = candidates[attemptIndex] ?? '';
    return String(picked ?? '').trim();
  }, [attemptIndex, candidates]);

  useEffect(() => {
    setAttemptIndex(0);
    setIsLoading(true);
    setLoadTimedOut(false);
    setHasError(false);
    loadStartRef.current = Date.now();

    console.log('[LearnRemoteImage] start', {
      platform: Platform.OS,
      original: normalizedUri,
      proxy: attachmentProxyUri,
      candidatesCount: candidates.length,
      preferAttachmentProxy: effectivePreferAttachmentProxy,
    });
  }, [attachmentProxyUri, candidates.length, effectivePreferAttachmentProxy, normalizedUri]);

  useEffect(() => {
    if (!renderUri) return;

    const timeoutMs = 12000;
    const t = setTimeout(() => {
      if (!isLoading) return;

      console.log('[LearnRemoteImage] load timeout', {
        uri: renderUri,
        platform: Platform.OS,
        ms: Date.now() - loadStartRef.current,
        attemptIndex,
        candidatesCount: candidates.length,
        original: normalizedUri,
        attachmentProxyUri,
      });

      setLoadTimedOut(true);
      setIsLoading(false);

      if (attemptIndex + 1 < candidates.length) {
        console.log('[LearnRemoteImage] timeout -> trying next candidate', {
          from: renderUri,
          to: candidates[attemptIndex + 1],
          platform: Platform.OS,
        });
        setAttemptIndex((i) => i + 1);
        setIsLoading(true);
        setLoadTimedOut(false);
        loadStartRef.current = Date.now();
        return;
      }

      setHasError(true);
      onError?.('timeout');
    }, timeoutMs);

    return () => clearTimeout(t);
  }, [attemptIndex, attachmentProxyUri, candidates, isLoading, normalizedUri, onError, renderUri]);


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
          console.log('[LearnRemoteImage] RNImage loaded', {
            uri: renderUri,
            platform: Platform.OS,
            attemptIndex,
            candidatesCount: candidates.length,
          });
          setIsLoading(false);
          onLoad?.();
        }}
        onError={(e) => {
          const err = (e as unknown as { nativeEvent?: { error?: string } })?.nativeEvent?.error;
          console.log('[LearnRemoteImage] RNImage error', {
            uri: renderUri,
            platform: Platform.OS,
            attemptIndex,
            candidatesCount: candidates.length,
            error: err,
            original: normalizedUri,
            attachmentProxyUri,
          });

          if (attemptIndex + 1 < candidates.length) {
            const next = candidates[attemptIndex + 1];
            console.log('[LearnRemoteImage] RNImage -> next candidate', {
              from: renderUri,
              to: next,
              platform: Platform.OS,
            });
            setAttemptIndex((i) => i + 1);
            setIsLoading(true);
            setLoadTimedOut(false);
            loadStartRef.current = Date.now();
            return;
          }

          setIsLoading(false);
          setLoadTimedOut(false);
          setHasError(true);
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
        key={`${attemptIndex}-${renderUri}`}
        source={Platform.OS === 'web' ? renderUri : { uri: renderUri }}
        style={imageFillStyle}
        contentFit={contentFit}
        transition={transition}
        cachePolicy={cachePolicy}
        onLoad={() => {
          console.log('[LearnRemoteImage] ExpoImage loaded', {
            uri: renderUri,
            platform: Platform.OS,
            attemptIndex,
            candidatesCount: candidates.length,
          });
          setIsLoading(false);
          onLoad?.();
        }}
        onError={(e) => {
          const err = (e as unknown as { error?: string } | null | undefined)?.error;
          console.log('[LearnRemoteImage] ExpoImage error', {
            uri: renderUri,
            platform: Platform.OS,
            attemptIndex,
            candidatesCount: candidates.length,
            error: err,
            original: normalizedUri,
            attachmentProxyUri,
          });

          if (attemptIndex + 1 < candidates.length) {
            const next = candidates[attemptIndex + 1];
            console.log('[LearnRemoteImage] ExpoImage -> next candidate', {
              from: renderUri,
              to: next,
              platform: Platform.OS,
            });
            setAttemptIndex((i) => i + 1);
            setIsLoading(true);
            setLoadTimedOut(false);
            loadStartRef.current = Date.now();
            return;
          }

          console.log('[LearnRemoteImage] ExpoImage exhausted candidates -> fallback RNImage', {
            uri: renderUri,
            platform: Platform.OS,
          });
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
