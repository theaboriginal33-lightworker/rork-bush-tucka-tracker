import React, { useCallback, useMemo } from 'react';
import { Alert, View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Filter, LogOut, UserCircle2 } from 'lucide-react-native';
import { router } from 'expo-router';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/app/providers/AuthProvider';

const LEARN_DATA = [
  { id: '1', name: 'Finger Lime', scientific: 'Citrus australasica', type: 'Fruit', color: '#E8F5E9', image: 'https://images.unsplash.com/photo-1669279093414-061057c320d7?q=80&w=2787&auto=format&fit=crop' },
  { id: '2', name: 'Wattleseed', scientific: 'Acacia', type: 'Seed', color: '#FFF3E0', image: 'https://images.unsplash.com/photo-1627916533550-c8f93e3d4899?q=80&w=2670&auto=format&fit=crop' },
  { id: '3', name: 'Davidson Plum', scientific: 'Davidsonia', type: 'Fruit', color: '#F3E5F5', image: 'https://images.unsplash.com/photo-1678165842817-062e21245781?q=80&w=2574&auto=format&fit=crop' },
  { id: '4', name: 'Saltbush', scientific: 'Atriplex nummularia', type: 'Leaf', color: '#E0F7FA', image: 'https://images.unsplash.com/photo-1596726540679-0df8e8e7a61d?q=80&w=2787&auto=format&fit=crop' },
  { id: '5', name: 'Macadamia', scientific: 'Macadamia integrifolia', type: 'Nut', color: '#FFF8E1', image: 'https://images.unsplash.com/photo-1523498877546-6c8469c4505c?q=80&w=2670&auto=format&fit=crop' },
];

export default function LearnScreen() {
  const { signOut, user, hasConfig, isReady } = useAuth();

  const authStatusText = useMemo(() => {
    if (!hasConfig) return 'Supabase not configured';
    if (!isReady) return 'Checking session…';
    if (!user) return 'Not signed in';
    const email = typeof user.email === 'string' ? user.email : null;
    return email ? `Signed in as ${email}` : 'Signed in';
  }, [hasConfig, isReady, user]);

  const onPressSignOut = useCallback(() => {
    Alert.alert('Sign out?', 'You will need to log in again to sync your data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          signOut().catch((e) => {
            const message = e instanceof Error ? e.message : String(e);
            console.log('[Learn] signOut failed', { message });
            Alert.alert('Could not sign out', message);
          });
        },
      },
    ]);
  }, [signOut]);

  const onPressAccount = useCallback(() => {
    console.log('[Learn] account pressed', {
      hasConfig,
      isReady,
      hasUser: Boolean(user),
      email: typeof user?.email === 'string' ? user.email : null,
    });

    if (!hasConfig) {
      Alert.alert('Auth is disabled', 'Supabase is not configured yet, so there is no active session to sign out of.');
      return;
    }

    if (!isReady) {
      Alert.alert('Please wait', 'Still checking your session. Try again in a moment.');
      return;
    }

    if (!user) {
      Alert.alert('Not signed in', 'Go to the Login / Sign up screen?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Go to Login',
          onPress: () => {
            try {
              router.push('/auth');
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              console.log('[Learn] router.push(/auth) failed', { message });
            }
          },
        },
      ]);
      return;
    }

    Alert.alert('Account', authStatusText, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: onPressSignOut },
    ]);
  }, [authStatusText, hasConfig, isReady, onPressSignOut, user]);

  const renderItem = ({ item }: { item: typeof LEARN_DATA[0] }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.imageContainer}>
        <Image source={{ uri: item.image }} style={styles.cardImage} />
        <View style={[styles.typeTag, { backgroundColor: 'rgba(7,17,11,0.78)' }]}>
          <Text style={styles.typeText}>{item.type}</Text>
        </View>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.cardSubtitle}>{item.scientific}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Encyclopedia</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1} testID="learn-auth-status">
              {authStatusText}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton} onPress={onPressAccount} testID="learn-account">
              <UserCircle2 size={22} color={COLORS.text} />
            </TouchableOpacity>
            {user ? (
              <TouchableOpacity style={styles.iconButton} onPress={onPressSignOut} testID="learn-signout">
                <LogOut size={22} color={COLORS.text} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.iconButton} testID="learn-search">
              <Search size={22} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} testID="learn-filter">
              <Filter size={22} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          data={LEARN_DATA}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    marginBottom: 8,
    gap: 16,
  },
  headerLeft: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 6,
  },
  listContent: {
    padding: 24,
    paddingTop: 8,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: 24,
    marginBottom: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 7,
    padding: 10,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  typeTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cardContent: {
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
});
