import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ImageBackground, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Clock, ChefHat, Search } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { LinearGradient } from 'expo-linear-gradient';

export default function CookScreen() {
  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Recipes</Text>
          <TouchableOpacity style={styles.searchButton} testID="cook-search">
            <Search size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Featured Recipe - Large Card */}
          <TouchableOpacity style={styles.featuredContainer} testID="cook-featured">
            <ImageBackground
              source={{ uri: 'https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=2670&auto=format&fit=crop' }}
              style={styles.featuredImage}
              imageStyle={{ borderRadius: 32 }}
            >
              <LinearGradient
                colors={['rgba(7,17,11,0)', 'rgba(7,17,11,0.92)']}
                style={styles.featuredGradient}
              >
                <View style={styles.featuredContent}>
                  <View style={styles.featuredTag}>
                    <Text style={styles.featuredTagText}>Trending</Text>
                  </View>
                  <Text style={styles.featuredTitle}>Lemon Myrtle Barramundi</Text>
                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Clock size={16} color="#FFF" />
                      <Text style={styles.metaText}>45 min</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <ChefHat size={16} color="#FFF" />
                      <Text style={styles.metaText}>Medium</Text>
                    </View>
                  </View>
                </View>
              </LinearGradient>
            </ImageBackground>
          </TouchableOpacity>

          {/* Categories */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesScroll}>
            {['All', 'Mains', 'Desserts', 'Sauces', 'Drinks'].map((cat, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.categoryChip, index === 0 && styles.categoryChipActive]}
                testID={`cook-category-${cat.toLowerCase()}`}
              >
                <Text style={[styles.categoryText, index === 0 && styles.categoryTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Popular Recipes Grid */}
          <Text style={styles.sectionTitle}>Popular Now</Text>
          <View style={styles.recipesGrid}>
            {[1, 2, 3, 4].map((item) => (
              <TouchableOpacity key={item} style={styles.recipeCard}>
                <View style={styles.recipeImageWrapper}>
                  <Image 
                    source={{ uri: `https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=2670&auto=format&fit=crop&random=${item}` }} 
                    style={styles.recipeImage}
                  />
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingText}>4.8 ★</Text>
                  </View>
                </View>
                <Text style={styles.recipeTitle}>Bush Tomato Chutney</Text>
                <Text style={styles.recipeAuthor}>By Aunty Mary</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
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
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  searchButton: {
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
  scrollContent: {
    paddingBottom: 100,
  },
  featuredContainer: {
    paddingHorizontal: 24,
    marginBottom: 32,
    height: 320,
  },
  featuredImage: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  featuredGradient: {
    borderRadius: 32,
    padding: 24,
    height: '100%',
    justifyContent: 'flex-end',
  },
  featuredContent: {
    gap: 8,
  },
  featuredTag: {
    backgroundColor: 'rgba(56,217,137,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.35)',
  },
  featuredTagText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  featuredTitle: {
    color: '#FFF',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '500',
  },
  categoriesScroll: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
  },
  categoryChip: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 100,
    backgroundColor: COLORS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  categoryChipActive: {
    backgroundColor: 'rgba(56,217,137,0.16)',
    borderColor: 'rgba(56,217,137,0.5)',
  },
  categoryText: {
    fontWeight: '700',
    color: COLORS.text,
    fontSize: 14,
  },
  categoryTextActive: {
    color: COLORS.secondary,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  recipesGrid: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  recipeCard: {
    width: '47%',
    marginBottom: 24,
  },
  recipeImageWrapper: {
    height: 180,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 12,
    position: 'relative',
  },
  recipeImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  ratingBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(7,17,11,0.82)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(56,217,137,0.35)',
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 4,
  },
  recipeAuthor: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
});
