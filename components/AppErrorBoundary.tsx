import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { router } from 'expo-router';

type AppErrorBoundaryProps = {
  children: React.ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
  errorInfo: string | null;
};

export class AppErrorBoundary extends React.PureComponent<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const errorInfo = typeof info?.componentStack === 'string' ? info.componentStack : null;
    console.log('[AppErrorBoundary] caught error', {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      componentStack: errorInfo,
      platform: Platform.OS,
    });
    this.setState({ errorInfo });
  }

  private reset = () => {
    console.log('[AppErrorBoundary] reset requested');
    this.setState({ error: null, errorInfo: null });
    try {
      router.replace('/');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[AppErrorBoundary] router.replace failed', { message });
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.root} testID="app-error-boundary-root">
        <View style={styles.card}>
          <Text style={styles.title} testID="app-error-boundary-title">
            Something went wrong
          </Text>
          <Text style={styles.subtitle} testID="app-error-boundary-subtitle">
            Try resetting the screen.
          </Text>

          <View style={styles.meta}>
            <Text style={styles.metaLabel}>Error</Text>
            <Text style={styles.metaValue} selectable testID="app-error-boundary-message">
              {this.state.error.message || 'Unknown error'}
            </Text>
          </View>

          {this.state.errorInfo ? (
            <View style={styles.meta}>
              <Text style={styles.metaLabel}>Component stack</Text>
              <Text style={styles.metaValue} selectable testID="app-error-boundary-component-stack">
                {this.state.errorInfo}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity onPress={this.reset} activeOpacity={0.88} style={styles.button} testID="app-error-boundary-reset">
            <Text style={styles.buttonText}>Reset</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#F4F1EA',
  },
  card: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2C2C2C',
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(44,44,44,0.65)',
    lineHeight: 18,
  },
  meta: {
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(74,107,83,0.06)',
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(44,44,44,0.55)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  metaValue: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#2C2C2C',
    lineHeight: 16,
  },
  button: {
    marginTop: 16,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A6B53',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
