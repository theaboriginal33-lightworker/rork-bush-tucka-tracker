import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, MapPin, MoreHorizontal } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';

const JOURNAL_ENTRIES = [
  { 
    id: '1', 
    title: 'Found Warrigal Greens', 
    date: '2025-01-28', 
    location: 'Royal National Park', 
    image: 'https://images.unsplash.com/photo-1627916533550-c8f93e3d4899?q=80&w=2670&auto=format&fit=crop',
    tags: ['Leaf', 'Edible']
  },
  { 
    id: '2', 
    title: 'Banksia Harvest', 
    date: '2025-01-25', 
    location: 'Blue Mountains', 
    image: 'https://images.unsplash.com/photo-1596726540679-0df8e8e7a61d?q=80&w=2787&auto=format&fit=crop',
    tags: ['Flower', 'Nectar']
  },
  { 
    id: '3', 
    title: 'Saltbush Discovery', 
    date: '2025-01-20', 
    location: 'Backyard', 
    image: 'https://images.unsplash.com/photo-1669279093414-061057c320d7?q=80&w=2787&auto=format&fit=crop',
    tags: ['Leaf', 'Salty']
  },
];

export default function JournalScreen() {
  const entries = JOURNAL_ENTRIES;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Collection</Text>
          <TouchableOpacity style={styles.addButton} testID="journal-add">
            <Plus size={24} color={COLORS.background} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={entries}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.entryCard}>
              <View style={styles.cardHeader}>
                <Image source={{ uri: item.image }} style={styles.entryImage} />
                <View style={styles.metaOverlay}>
                   <View style={styles.dateBadge}>
                    <Text style={styles.dateText}>{item.date.split('-')[2]} JAN</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.cardBody}>
                <View style={styles.titleRow}>
                  <Text style={styles.entryTitle}>{item.title}</Text>
                  <MoreHorizontal size={20} color={COLORS.textSecondary} />
                </View>
                
                <View style={styles.locationRow}>
                  <MapPin size={14} color={COLORS.primary} />
                  <Text style={styles.locationText}>{item.location}</Text>
                </View>

                <View style={styles.tagsRow}>
                  {item.tags.map(tag => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </TouchableOpacity>
          )}
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
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  listContent: {
    padding: 24,
    paddingTop: 8,
  },
  entryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    marginBottom: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.3,
    shadowRadius: 22,
    elevation: 7,
    overflow: 'hidden',
  },
  cardHeader: {
    height: 180,
    position: 'relative',
  },
  entryImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  metaOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateBadge: {
    backgroundColor: 'rgba(7,17,11,0.78)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.35)',
  },
  dateText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 0.4,
  },
  cardBody: {
    padding: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  entryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  locationText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tag: {
    backgroundColor: COLORS.highlight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.25)',
  },
  tagText: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '700',
  },
});
