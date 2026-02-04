import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LearnRemoteImage } from '@/components/LearnRemoteImage';
import { Stack, useLocalSearchParams, usePathname } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, Trash2 } from 'lucide-react-native';
import { COLORS } from '@/constants/colors';
import { hasSupabaseConfig, supabase, supabasePublicDebugInfo } from '@/constants/supabase';
import { useLearnImages } from '@/app/providers/LearnImageProvider';

type LearnPlant = {
  id: string;
  slug: string;
  commonName: string;
  scientificName?: string;
  category?: string;
  heroImageUrl?: string;
  overview?: string;
  isBushTucker?: boolean;
  isMedicinal?: boolean;
  safetyLevel?: string;
  confidenceHint?: string;
  edibleParts?: string[];
  preparation?: string;
  seasonality?: string;
  warnings?: string;
  lookalikes?: string;
  culturalNotes?: string;
  suggestedUses?: string;
  prepBasics?: string[];
  seasonalityNote?: string;
  sourceRefs?: string[];
  tags?: string[];
  edibilityStatus?: string;
  createdAt?: string;
  updatedAt?: string;
};

type SupabasePlantRow = {
  id: string;
  slug?: string | null;
  common_name?: string | null;
  scientific_name?: string | null;
  category?: string | null;
  overview?: string | null;
  edible_parts?: string[] | null;
  preparation?: string | null;
  seasonality?: string | null;
  warnings?: string | null;
  lookalikes?: string | null;
  cultural_notes?: string | null;
  suggested_uses?: string | null;
  is_bush_tucker?: boolean | null;
  is_medicinal?: boolean | null;
  safety_level?: string | null;
  confidence_hint?: string | null;
  prep_basics?: string[] | null;
  seasonality_note?: string | null;
  source_refs?: string[] | null;
  edibility_status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const FALLBACK_PLANTS: LearnPlant[] = [
  {
    id: 'finger-lime',
    slug: 'finger-lime',
    commonName: 'Finger Lime',
    scientificName: 'Native Citrus • Citrus Caviar',
    category: 'Fruit / Citrus',
    heroImageUrl:
      'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/n7m5z15iiqrv0xjj2jfby',
    overview:
      'Finger Lime is a native Australian citrus traditionally found in subtropical rainforest regions of eastern Australia. Known for its elongated shape and unique caviar-like pearls, it delivers a sharp, refreshing citrus burst unlike any other fruit.\n\nHighly valued today in contemporary cuisine, Finger Lime bridges traditional knowledge and modern food innovation.',
    safetyLevel: 'safe',
    confidenceHint: 'Confirm ID (shape + habitat) and harvest only ripe fruit; timing matters.',
    seasonality: 'Late Summer → Autumn',
    seasonalityNote: 'Fruit colour varies by species and region (green, pink, red, yellow).',
    preparation:
      'Harvest ripe fruit. Slice open lengthways and gently press to release the pearls. Use fresh for best flavour — minimal preparation preserves texture and aroma.',
    suggestedUses:
      'Seafood garnishes • Salads & fresh dishes • Desserts & pastries • Beverages & cocktails • Sauces & dressings\n\nOften used as a finishing ingredient rather than cooked down.',
    culturalNotes:
      'Traditionally harvested from rainforest edges and shared seasonally. Knowledge is passed through careful observation of ripeness and seasons.\n\nFinger Lime teaches patience — timing is everything.\n\nCultural knowledge shared here is general and non-restricted.',
    warnings:
      'Status: SAFE\n\n• Safe to eat when ripe\n• Suitable raw or cooked\n• Naturally acidic\n• Generally well tolerated when consumed in moderation',
    lookalikes:
      'Other small citrus can be confused at a glance. Confirm identification using multiple features (leaf, thorny branches, fruit shape/skin) and local guidance.',
    edibleParts: ['fruit'],
    prepBasics: ['harvest ripe fruit', 'wash', 'slice lengthways', 'press pearls out', 'use fresh'],
    tags: ['Fruit', 'Citrus', 'Safe', 'Preparation: Minimal', 'Flavour: Sharp / Citrus', 'Environment: Subtropical Rainforest'],
    sourceRefs: ['Community knowledge (varies by Country)', 'Local field guides', 'Local Indigenous voices'],
    isBushTucker: true,
    isMedicinal: false,
    edibilityStatus: 'safe',
  },
  {
    id: 'lemon-aspen',
    slug: 'lemon-aspen',
    commonName: 'Lemon Aspen',
    scientificName: 'Rainforest Native Fruit • Citrus-Flavoured Berry',
    category: 'Fruit',
    heroImageUrl:
      'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/sg7y96jpf74eyg7kql43u',
    overview:
      'Lemon Aspen is a native rainforest fruit traditionally found in eastern Australia, particularly in subtropical and tropical rainforest regions. Small in size but intense in flavour, it delivers a bright, lemony tang with floral notes.\n\nIt is highly regarded in modern native cuisine for its fresh acidity and aromatic profile.',
    safetyLevel: 'safe',
    confidenceHint:
      'Safe to consume when ripe. Naturally acidic. Best used fresh or lightly processed; generally well tolerated when eaten in moderation.',
    seasonality: 'Late Summer → Autumn',
    seasonalityNote: 'Fruit ripens following warm, wet conditions.',
    preparation:
      'Harvest ripe fruit. Wash thoroughly. Use whole, or remove seed if preferred. Balance acidity with sweetness or fats — a small amount provides strong flavour.',
    suggestedUses:
      'Sauces & dressings • Desserts & baking • Beverages & cordials • Seafood pairings • Syrups & preserves.\n\nOften used where lemon or lime would traditionally be used.',
    culturalNotes:
      'Traditionally harvested seasonally from rainforest Country, used fresh and shared within communities. Knowledge is guided by ripeness and seasonal change, reflecting abundance after rain.\n\nLemon Aspen reminds us that small fruits can carry strong medicine.\n\nCultural knowledge shared here is general and non-restricted.',
    warnings:
      'Status: SAFE\n\n• Safe to consume when ripe\n• Naturally acidic\n• Best used fresh or lightly processed\n• Generally well tolerated when eaten in moderation',
    lookalikes:
      'Some small rainforest berries can look similar at a glance. Confirm identification using multiple features (leaf form, aroma when crushed, fruit size/colour, habitat) and local guidance before eating.',
    edibleParts: ['fruit'],
    prepBasics: ['harvest ripe fruit', 'wash thoroughly', 'use whole or remove seed', 'balance acidity with sweet or fats'],
    tags: ['Fruit', 'Safe', 'Preparation: Minimal', 'Flavour: Citrus / Aromatic', 'Environment: Subtropical Rainforest'],
    sourceRefs: ['Community knowledge (varies by Country)', 'Local field guides', 'Local Indigenous voices'],
    isBushTucker: true,
    isMedicinal: false,
    edibilityStatus: 'safe',
  },
  {
    id: 'lemon-myrtle',
    slug: 'lemon-myrtle',
    commonName: 'Lemon Myrtle',
    scientificName: 'Native Leaf • Aromatic Herb',
    category: 'Leaf / Herb',
    heroImageUrl:
      'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/9aps3g2u5gb9wfop6gmjy',
    overview:
      'Lemon Myrtle is a native Australian rainforest tree celebrated for its intense lemon aroma, often stronger than conventional citrus. Traditionally valued by Aboriginal communities, its leaves have been used for flavouring, cleansing, and wellbeing.\n\nToday, Lemon Myrtle is one of the most widely recognised native herbs in modern Australian cuisine.',
    safetyLevel: 'safe',
    confidenceHint:
      'Safe when used as a culinary herb. Very concentrated — use small amounts only; avoid excessive consumption.',
    seasonality: 'Leaves: Available year-round (best in warmer months)',
    seasonalityNote: 'Leaves are most aromatic when mature and healthy.',
    preparation:
      'Harvest mature leaves. Wash gently and dry. Use fresh, or dry for storage. Crush or grind before use — drying intensifies aroma and shelf life.',
    suggestedUses:
      'Herbal teas • Baking & desserts • Seasoning blends • Seafood & poultry • Infused oils & syrups\n\nOften used as a lemon substitute, but with deeper complexity.',
    culturalNotes:
      'Traditionally used for cleansing and flavour; leaves are respected for strength and potency. Knowledge is passed through careful use, not excess, and harvest is guided by attention to tree health.\n\nLemon Myrtle teaches restraint — strength lies in balance.\n\nCultural knowledge shared here is general and non-restricted.',
    warnings:
      'Status: SAFE (Use in Moderation)\n\n• Safe when used as a culinary herb\n• Very concentrated — small amounts only\n• Avoid excessive consumption\n• Generally safe for most people when used appropriately',
    lookalikes:
      'Some Myrtaceae species can look similar at a glance. Confirm identification using multiple features (leaf aroma when crushed, leaf shape, habitat) and local guidance before use.',
    edibleParts: ['leaves'],
    prepBasics: ['harvest mature leaves', 'wash gently', 'dry (optional)', 'crush or grind', 'use sparingly'],
    tags: ['Leaf / Herb', 'Safe (Moderation)', 'Preparation: Dry / Infuse', 'Flavour: Lemon / Aromatic', 'Environment: Rainforest'],
    sourceRefs: ['Community knowledge (varies by Country)', 'Local field guides', 'Local Indigenous voices'],
    isBushTucker: true,
    isMedicinal: true,
    edibilityStatus: 'safe',
  },
  {
    id: 'kurrajong',
    slug: 'kurrajong',
    commonName: 'Kurrajong',
    scientificName: 'Native Tree • Seed & Fibre Plant',
    category: 'Seed / Tree',
    heroImageUrl:
      'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/btyrnxjhwk5xvf16buiiv',
    overview:
      'Kurrajong is a hardy native Australian tree traditionally valued for its seeds, inner bark fibre, and water-holding roots. Found across many regions, it has long supported Aboriginal communities as a reliable survival resource during dry periods.\n\nIts broad canopy and resilience make it a strong symbol of adaptability and endurance on Country.',
    safetyLevel: 'caution',
    confidenceHint:
      'Seeds are not eaten raw. Proper roasting/processing is required. Fibres and roots are not food. Only consume seeds when correctly prepared.',
    seasonality: 'Seeds / Pods: Late Summer → Autumn',
    seasonalityNote: 'Pods mature as they dry and split open on the tree.',
    preparation:
      'Collect mature, dry pods and remove seeds. Roast thoroughly to neutralise irritants, then eat roasted or grind into a meal/flour (small quantities). Roasting is essential for safety and flavour.',
    suggestedUses:
      'Roasted seed snack • Ground seed meal • Emergency food source • Modern bush-inspired flours (small quantities)\n\nTraditionally used when other food sources were scarce.',
    culturalNotes:
      'Seeds were harvested during times of need, and the tree was valued for multiple uses beyond food. Inner bark fibre was used for cordage and tools, with knowledge passed through survival teaching.\n\nKurrajong teaches preparedness and respect for resources.\n\nCultural knowledge shared here is general and non-restricted.',
    warnings:
      'Status: CAUTION — PREPARATION REQUIRED\n\n• Seeds are not eaten raw\n• Proper roasting/processing is required\n• Fibres and roots are not food\n• Only consume seeds when correctly prepared',
    lookalikes:
      'Some seed pods from other native trees can look similar. Confirm identification using multiple traits (leaf shape, pod form, seed characteristics, habitat) and local guidance before consuming.',
    edibleParts: ['seeds'],
    prepBasics: ['collect mature, dry pods', 'remove seeds', 'roast thoroughly', 'eat roasted or grind into meal'],
    tags: ['Seed / Tree', 'Caution', 'Preparation: Required', 'Flavour: Nutty (roasted)', 'Environment: Woodland / Arid'],
    sourceRefs: ['Community knowledge (varies by Country)', 'Local field guides', 'Local Indigenous voices'],
    isBushTucker: true,
    isMedicinal: false,
    edibilityStatus: 'caution',
  },
  {
    id: 'mountain-pepper',
    slug: 'mountain-pepper',
    commonName: 'Mountain Pepper',
    scientificName: 'Native Pepperberry • Potent Bush Spice',
    category: 'Spice / Leaf / Berry',
    heroImageUrl:
      'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/q8ou304h1cawpspih96i3',
    overview:
      "Mountain Pepper is a native Australian plant traditionally found in cool, highland and temperate rainforest regions, particularly in south-eastern Australia and Tasmania. Both the leaves and berries are valued for their strong, peppery heat and aromatic complexity.\n\nIt is one of Australia’s most potent native spices and is used sparingly with respect.",
    safetyLevel: 'caution',
    confidenceHint:
      'Safe in small culinary amounts only. Very strong flavour — use sparingly. Not recommended in large quantities. Avoid medicinal dosing without expert guidance.',
    seasonality: 'Leaves: most of the year • Berries: Late Summer → Autumn',
    seasonalityNote: 'Berries darken as they ripen and are usually dried before use.',
    preparation:
      'Leaves: harvest mature leaves, wash and dry, use fresh or dried, crush lightly.\n\nBerries: harvest ripe berries, dry thoroughly, then grind or crush — drying enhances flavour and shelf life.',
    suggestedUses:
      'Meat rubs • Savoury sauces • Vegetable dishes • Bush spice blends • Infused oils\n\nOften used as a black pepper substitute — but much stronger.',
    culturalNotes:
      'Traditionally used as both food and medicine, harvested carefully in cool forest systems. Knowledge emphasises restraint and respect; leaves are often used more gently than berries.\n\nMountain Pepper teaches power through balance.\n\nCultural knowledge shared here is general and non-restricted.',
    warnings:
      'Status: CAUTION — STRONG & CONCENTRATED\n\n• Safe in small culinary amounts only\n• Very strong flavour — use sparingly\n• Not recommended in large quantities\n• Avoid medicinal dosing without expert guidance',
    lookalikes:
      'Some shrubs with aromatic leaves can look similar. Confirm ID using multiple features (leaf shape, habitat, berries/flowers) and local guidance before use.',
    edibleParts: ['leaves', 'berries'],
    prepBasics: ['use sparingly', 'dry leaves (optional)', 'dry berries thoroughly', 'grind/crush before use'],
    tags: ['Spice', 'Caution', 'Preparation: Dry / Grind', 'Flavour: Hot / Peppery', 'Environment: Cool Temperate / Highland'],
    sourceRefs: ['Community knowledge (varies by Country)', 'Local field guides', 'Local Indigenous voices'],
    isBushTucker: true,
    isMedicinal: true,
    edibilityStatus: 'caution',
  },
  {
    id: 'native-caper-bush',
    slug: 'native-caper-bush',
    commonName: 'Native Caper Bush',
    scientificName: 'Native Shrub • Flower Bud & Fruit',
    category: 'Shrub / Condiment',
    heroImageUrl:
      'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/inpehr5gvdisuvxibesep',
    overview:
      'Native Caper Bush refers to several native Capparis species found across arid, semi-arid, and coastal regions of Australia. Traditionally, different parts of the plant — including flower buds and ripe fruit — have been used as food after correct preparation.\n\nFlavour is sharp, tangy, and savoury, similar to Mediterranean capers but uniquely adapted to Australian conditions.',
    safetyLevel: 'caution',
    confidenceHint:
      'Only specific parts are edible, and correct preparation matters. If unsure of the species or part, do not consume.',
    seasonality: 'Flower buds: Spring → Early Summer • Fruit: Summer',
    seasonalityNote: 'Timing varies by rainfall and region.',
    preparation:
      'Flower buds: harvest young buds, soak or ferment in brine, then rinse before use.\n\nFruit: harvest fully ripe fruit, cook or process before eating; discard seeds if advised by local knowledge. Preparation reduces bitterness and improves flavour.',
    suggestedUses:
      'Pickled caper-style buds • Savoury sauces • Condiments • Vegetable dishes • Modern bush-inspired garnishes\n\nOften used as a flavour accent, not a main ingredient.',
    culturalNotes:
      'Knowledge of edible parts is highly localised, and preparation techniques are passed through experience. Often harvested sparingly, reflecting deep understanding of plant chemistry.\n\nNative Caper Bush teaches discernment — not everything edible is obvious.\n\nCultural knowledge shared here is general and non-restricted.',
    warnings:
      'Status: CAUTION — CORRECT PART & PREPARATION REQUIRED\n\n• Only specific plant parts are edible\n• Unripe fruit and raw buds can be bitter or unsafe\n• Proper preparation is essential\n• Never consume unless correctly identified\n• If unsure, do not consume',
    lookalikes:
      'Some shrubs with similar buds/fruit occur in arid and coastal systems. Confirm identification using multiple traits (leaf form, flower structure, fruit shape, habitat) and local guidance.',
    edibleParts: ['flower buds', 'fruit'],
    prepBasics: ['harvest young buds', 'brine/ferment', 'rinse', 'harvest fully ripe fruit', 'cook/process'],
    tags: ['Shrub / Condiment', 'Caution', 'Preparation: Required', 'Flavour: Tangy / Savoury', 'Environment: Arid / Coastal'],
    sourceRefs: ['Community knowledge (varies by Country)', 'Local field guides', 'Local Indigenous voices'],
    isBushTucker: true,
    isMedicinal: false,
    edibilityStatus: 'caution',
  },
  {
    id: 'fallback-2',
    slug: 'wattleseed',
    commonName: 'Wattleseed',
    scientificName: 'Acacia spp.',
    category: 'Seed',
    overview: 'Nutty, coffee-like roasted seed often used in baking and spice blends.',
    isBushTucker: true,
    isMedicinal: false,
    safetyLevel: 'unknown',
    confidenceHint: 'Use only known edible species and properly prepared seeds.',
    edibleParts: ['seed'],
    preparation: 'Dry roast then grind; use sparingly as a flavour booster.',
    seasonality: 'Varies by region',
    warnings: 'Some Acacia are not used as food — confirm species.',
    lookalikes: 'Other Acacia seeds; verify pod and leaf form.',
    culturalNotes: 'Many preparations are regional and cultural.',
    suggestedUses: 'Baking, spice rubs, ice cream, coffee-style infusions.',
    prepBasics: ['dry roast', 'cool', 'grind'],
    sourceRefs: ['Local field guides', 'Community knowledge'],
    edibilityStatus: 'unknown',
    heroImageUrl:
      'https://images.unsplash.com/photo-1627916533550-c8f93e3d4899?q=80&w=2670&auto=format&fit=crop',
  },
  {
    id: 'fallback-3',
    slug: 'davidson-plum',
    commonName: 'Davidson Plum',
    scientificName: 'Davidsonia spp.',
    category: 'Fruit',
    heroImageUrl:
      'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/k95ccbdmm9553oq2sjwcr',
    overview:
      'Davidson Plum is a native rainforest fruit traditionally found along the east coast of Australia. Known for its deep purple flesh and sharp, tart flavour, it is rarely eaten raw but highly valued once prepared.\n\nThis fruit is widely used in contemporary bush foods, blending traditional knowledge with modern culinary practice.',
    safetyLevel: 'safe',
    confidenceHint: 'Very acidic — not usually eaten raw. Best used cooked, preserved, or processed.',
    seasonality: 'Summer → Early Autumn',
    seasonalityNote: 'Harvested when fruit falls naturally or turns deep purple.',
    preparation:
      'Harvest ripe fruit only. Remove seed before use. Cook, ferment, or preserve to balance acidity. Combine with sweet or savoury elements. Cooking enhances flavour and reduces sharpness.',
    suggestedUses:
      'Jams & preserves • Sauces & reductions • Syrups & drinks • Desserts & baking • Marinades & glazes.\n\nDavidson Plum is prized for its colour, acidity, and complexity.',
    culturalNotes:
      'Traditionally harvested from rainforest Country. Use and knowledge vary by Nation and region. Fruit is often shared, preserved, or traded. Respectful harvesting maintains tree health.\n\nKnowledge systems are local — always learn from Country.\n\nCultural knowledge shared here is general and non-restricted.',
    warnings:
      'Status: SAFE — PREPARATION ADVISED\n\n• Safe to consume when ripe\n• Very acidic — not usually eaten raw\n• Best used cooked, preserved, or processed\n• Suitable for most people when prepared properly',
    lookalikes:
      'Many rainforest fruits can be confused at a glance. Confirm ID using multiple features (leaf shape, fruit form/colour, habitat) and local guidance before eating.',
    edibleParts: ['fruit'],
    prepBasics: ['harvest ripe fruit only', 'remove seed', 'cook/ferment/preserve', 'balance with sweet or savoury'],
    tags: ['Rainforest Native Fruit', 'Safe', 'Preparation: Recommended', 'Flavour: Sour / Acidic', 'Cultural Use: Regional'],
    sourceRefs: ['Community knowledge (varies by Country)', 'Local field guides', 'Local Indigenous voices'],
    isBushTucker: true,
    isMedicinal: false,
    edibilityStatus: 'safe',
  },
  {
    id: 'fallback-4',
    slug: 'saltbush',
    commonName: 'Saltbush',
    scientificName: 'Atriplex nummularia',
    category: 'Leaf',
    overview: 'A native leaf with a clean saline finish—excellent with roasted meats.',
    isBushTucker: true,
    isMedicinal: true,
    safetyLevel: 'unknown',
    confidenceHint: 'Avoid plants exposed to salt spray/contamination; rinse well.',
    edibleParts: ['leaves'],
    preparation: 'Use young leaves fresh or dried; balance the salty flavour.',
    seasonality: 'Year-round in many areas',
    warnings: 'High salt content—use in moderation.',
    lookalikes: 'Other Atriplex species; check leaf shape and habitat.',
    culturalNotes: 'Traditional uses vary by Nation and region.',
    suggestedUses: 'Roast meats, breads, veggie dishes.',
    prepBasics: ['rinse', 'pat dry', 'use fresh or dehydrate'],
    sourceRefs: ['Local field guides', 'Community knowledge'],
    edibilityStatus: 'unknown',
    heroImageUrl:
      'https://images.unsplash.com/photo-1596726540679-0df8e8e7a61d?q=80&w=2787&auto=format&fit=crop',
  },
  {
    id: 'fallback-5',
    slug: 'macadamia',
    commonName: 'Macadamia',
    scientificName: 'Macadamia integrifolia',
    category: 'Nut',
    overview: 'Creamy native nut used for pralines, oils, pestos and crusts.',
    isBushTucker: true,
    isMedicinal: false,
    safetyLevel: 'unknown',
    confidenceHint: 'Only eat properly cured/processed nuts; avoid mouldy kernels.',
    edibleParts: ['nut'],
    preparation: 'Crack, dry, roast lightly; store airtight to protect oils.',
    seasonality: 'Varies by region',
    warnings: 'Keep away from dogs (toxic to dogs).',
    lookalikes: 'Other hard-shelled nuts; check tree and husk.',
    culturalNotes: 'Harvest responsibly and avoid damaged nuts.',
    suggestedUses: 'Pestos, desserts, oils, nut butters.',
    prepBasics: ['crack', 'dry', 'roast'],
    sourceRefs: ['Local field guides', 'Community knowledge'],
    edibilityStatus: 'unknown',
    heroImageUrl:
      'https://images.unsplash.com/photo-1523498877546-6c8469c4505c?q=80&w=2670&auto=format&fit=crop',
  },
  {
    id: 'bush-tomato',
    slug: 'bush-tomato',
    commonName: 'Bush Tomato',
    scientificName: 'Bush Tomato (Desert Raisin)',
    category: 'Fruit / Seed',
    heroImageUrl:
      'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?q=80&w=2670&auto=format&fit=crop',
    overview:
      'Bush Tomato, often known as Desert Raisin, is a highly valued native food traditionally harvested across arid and semi-arid regions of Australia. When properly prepared, it has a rich, savoury flavour and is widely used in both traditional and contemporary bush foods.\n\nImportant: only the fully ripe fruit is safe to consume.',
    safetyLevel: 'high caution',
    confidenceHint:
      'Only consume fully ripe fruit that has been traditionally dried or properly prepared. Unripe (green) fruit can be toxic. If unsure — do not consume.',
    seasonality: 'Late Spring → Summer',
    seasonalityNote:
      'Often follows rain events in desert regions. Traditionally harvested once plants naturally dry and fruit matures.',
    preparation:
      'Harvest only fully ripe fruit. Sun-dry naturally until dark and raisin-like. Store dried fruit in a cool, dry place. Rehydrate or grind when ready to use. Drying neutralises toxins and concentrates flavour.',
    suggestedUses:
      'Sauces & relishes • Seasoning blends • Stews & slow-cooked dishes • Pasta & savoury bakes • Contemporary bush spice mixes.\n\nFlavour is often described as umami, caramelised, tomato-like (safe & prepared only).',
    culturalNotes:
      'Traditionally harvested after plants dry naturally and often prepared/stored for long journeys. Knowledge is passed through observation, timing, and care. Use varies significantly by Country and community.\n\nCultural knowledge shared here is general and non-restricted. Respect cultural protocols and local knowledge systems.',
    warnings:
      'Status: CAUTION — PREPARATION REQUIRED.\n\nUnripe (green) bush tomatoes are toxic.\nOnly consume fruit that is fully ripened and has been traditionally dried or properly prepared.\nNever eat raw or green fruit.\nDo not substitute with lookalike Solanum species.\nIf unsure — do not consume.',
    lookalikes: 'Do not substitute with lookalike Solanum species. If unsure — do not consume.',
    edibleParts: ['fruit'],
    prepBasics: ['harvest fully ripe fruit only', 'sun-dry until dark and raisin-like', 'store cool & dry', 'rehydrate or grind to use'],
    sourceRefs: ['Community knowledge (varies by Country)', 'Local Indigenous voices', 'Field guides (Solanum spp.)'],
    isBushTucker: true,
    isMedicinal: false,
    edibilityStatus: 'caution',
  },
  {
    id: 'bush-plum',
    slug: 'bush-plum',
    commonName: 'Bush Plum',
    scientificName: undefined,
    category: 'Fruit',
    heroImageUrl: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/5jlxv3srevkvmlnhqj5ij',
    overview:
      'Bush Plum refers to several native Australian plum species traditionally harvested by Aboriginal communities as a nutrient-dense seasonal food. Flavour ranges from tart to mildly sweet, often enjoyed fresh or dried, and sometimes preserved for later use.\n\nKnowledge and use vary by Country, language group, and season.',
    safetyLevel: 'caution',
    confidenceHint: 'Only consume positively identified bush plums. Some lookalike species may be inedible or unsafe. Never eat if unsure — consult local knowledge holders.',
    seasonality: 'Late Summer → Autumn',
    seasonalityNote:
      'Timing varies by region, rainfall, and species. Bush plums often appear after seasonal rains and are an important indicator of changing Country.',
    preparation:
      'Harvest ripe fruit only. Wash gently in clean water. Eat fresh or sun-dry for storage. Can be lightly cooked or preserved. Drying was traditionally used to extend availability beyond the harvest season.',
    suggestedUses:
      'Fresh snack • Dried fruit • Infused in water or teas • Jams & preserves • Modern bush-inspired desserts.\n\nRecipes should always respect safety, season, and cultural context.',
    culturalNotes:
      'Traditionally gathered by women and families in many regions. Shared during seasonal movement across Country. Harvesting followed principles of respect, timing, and regeneration.\n\nAlways seek permission before harvesting on Country that is not your own. Cultural knowledge shared here is general and non-restricted.\n\nRespect & sustainability: Take only what is needed, leave fruit to regenerate, respect land access laws, and learn from local Indigenous voices.',
    warnings:
      'Status: Caution. Only consume positively identified bush plums. Some lookalike species may be inedible or unsafe. Never eat if unsure — consult local knowledge holders.',
    edibleParts: ['fruit'],
    prepBasics: ['harvest ripe fruit only', 'wash gently', 'eat fresh or sun-dry', 'lightly cook or preserve'],
    sourceRefs: ['Local Indigenous voices', 'Community knowledge', 'Field guides (species varies by region)'],
    tags: ['Traditional Native Food', 'Caution', 'Preparation: Standard', 'Cultural Use: Regional'],
    isBushTucker: true,
    isMedicinal: false,
    edibilityStatus: 'caution',
  },
  {
    id: 'desert-lime',
    slug: 'desert-lime',
    commonName: 'Desert Lime',
    scientificName: 'Desert Lime',
    category: 'Fruit',
    heroImageUrl:
      'https://images.unsplash.com/photo-1580915411954-282cb1c96b3b?q=80&w=2787&auto=format&fit=crop',
    overview:
      'Desert Lime is a hardy native citrus traditionally found in arid and semi-arid regions of Australia. Small in size but powerful in flavour, it delivers a sharp, tangy citrus punch prized in both traditional use and modern bush-food cuisine.\n\nThis plant thrives where others don’t — a true symbol of resilience, adaptation, and Country knowledge.',
    safetyLevel: 'safe',
    confidenceHint: 'Safe to eat when ripe. Naturally acidic. Suitable raw or cooked. Basic cleaning is sufficient.',
    seasonality: 'Late Summer → Autumn',
    seasonalityNote: 'Fruit ripens from green to yellow-green depending on region.',
    preparation:
      'Harvest ripe fruit. Wash thoroughly. Use whole, juiced, or zested. Balance acidity with fats or sweetness — a little goes a long way.',
    suggestedUses:
      'Seafood seasoning • Sauces & dressings • Marinades • Beverages & syrups • Desserts & baking.\n\nOften used where lemon or lime would traditionally appear.',
    lookalikes:
      'Other small citrus or lime-like fruits can be confused at a glance. Confirm ID using multiple features (leaf, thorn/branch habit, fruit aroma, habitat) and local guidance before eating.',
    culturalNotes:
      'Traditionally used across desert and inland Nations. Valued for flavour and long-keeping qualities. Often harvested sparingly due to harsh environments, with knowledge passed through seasonal observation.\n\nCultural knowledge shared here is general and non-restricted.',
    warnings:
      'Status: SAFE\n\n• Safe to eat when ripe\n• Naturally acidic\n• Suitable raw or cooked\n• No special preparation required beyond basic cleaning',
    edibleParts: ['fruit'],
    prepBasics: ['harvest ripe fruit', 'wash thoroughly', 'juice/zest/whole use', 'balance acidity'],
    sourceRefs: ['Community knowledge (varies by Country)', 'Local field guides', 'Local Indigenous voices'],
    tags: ['Arid Native Citrus', 'Safe', 'Preparation: Minimal', 'Flavour: Citrus / Tangy', 'Environment: Arid'],
    isBushTucker: true,
    isMedicinal: false,
    edibilityStatus: 'safe',
  },
  {
    id: 'dorrigo-pepper',
    slug: 'dorrigo-pepper',
    commonName: 'Dorrigo Pepper',
    scientificName: 'Rainforest Pepper • Native Spice',
    category: 'Spice / Leaf',
    heroImageUrl:
      'https://images.unsplash.com/photo-1524593119773-cc06f1d9e2a8?q=80&w=2787&auto=format&fit=crop',
    overview:
      'Dorrigo Pepper is a native rainforest plant known for its aromatic leaves and spicy berries. Closely related to native pepperberries, it delivers a warm, peppery heat with subtle floral notes, making it a prized ingredient in both traditional use and modern native cuisine.\n\nIt thrives in cool, moist rainforest environments, reflecting balance, shade, and layered flavour.',
    safetyLevel: 'caution',
    confidenceHint:
      'Safe in small culinary quantities. Strong flavour — use sparingly. Avoid excessive consumption. Not recommended in large amounts for children or during pregnancy.',
    seasonality: 'Leaves: most of the year • Berries: Late Summer → Autumn',
    seasonalityNote: 'Seasonality varies by rainfall and elevation.',
    preparation:
      'Leaves: harvest mature leaves, wash and dry, use fresh or dried, crush or infuse.\n\nBerries: harvest ripe berries, dry slowly, grind or crush before use.',
    suggestedUses:
      'Seasoning for meats & vegetables • Pepper substitute • Sauces & rubs • Infused oils • Bush spice blends.\n\nLeaves are often milder and more aromatic than berries.',
    lookalikes:
      'Native pepperberry relatives and other rainforest aromatics can look similar. Confirm ID using multiple traits (leaf aroma when crushed, berry appearance, habitat) and local guidance before use.',
    culturalNotes:
      'Used traditionally as a flavouring and medicinal plant, harvested carefully in rainforest systems. Knowledge is shared through observation and respect for seasonal cycles; leaves are often preferred for everyday use.\n\nCultural knowledge shared here is general and non-restricted.',
    warnings:
      'Status: CAUTION\n\n• Safe in small culinary quantities\n• Strong flavour — use sparingly\n• Avoid excessive consumption\n• Not recommended in large amounts for children or during pregnancy',
    edibleParts: ['leaves', 'berries'],
    prepBasics: ['harvest lightly', 'wash & dry', 'crush/infuse leaves', 'dry berries slowly', 'grind before use'],
    sourceRefs: ['Community knowledge (varies by Country)', 'Local field guides', 'Local Indigenous voices'],
    tags: ['Rainforest Pepper', 'Caution', 'Preparation: Dry / Infuse', 'Flavour: Peppery / Warm', 'Environment: Rainforest'],
    isBushTucker: true,
    isMedicinal: true,
    edibilityStatus: 'caution',
  },
  {
    id: 'emu-apple',
    slug: 'emu-apple',
    commonName: 'Emu Apple',
    scientificName: 'Native Shrub Fruit • Seasonal Berry',
    category: 'Fruit',
    heroImageUrl:
      'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/mnjeackl074xi8muhu5k9',
    overview:
      'Emu Apple is a native fruit traditionally found in southern and south-eastern Australia, growing on low shrubs and ground-hugging plants. Its name comes from the way emus feed on the fruit and disperse the seeds, playing an important role in regeneration.\n\nFlavour is mild, fresh, and lightly sweet, with a crisp texture.',
    safetyLevel: 'safe',
    confidenceHint:
      'Safe to consume when ripe. Suitable raw or prepared. Always confirm identification before eating and consume in moderation.',
    seasonality: 'Spring → Early Summer',
    seasonalityNote:
      'Fruit ripens after flowering and is often gathered as part of seasonal movement across Country.',
    preparation:
      'Harvest ripe fruit only. Wash gently. Eat fresh or lightly process. Remove seed if desired. Often enjoyed raw to highlight freshness.',
    suggestedUses:
      'Fresh eating • Salads • Light preserves • Desserts • Garnishes.\n\nBest used in simple dishes to honour its subtle flavour.',
    culturalNotes:
      'Named for the emu’s role in seed dispersal. Traditionally harvested in small quantities and often shared within family groups, reflecting interconnection between animal, plant, and land.\n\nCultural knowledge shared here is general and non-restricted.',
    warnings:
      'Status: SAFE\n\n• Safe to consume when ripe\n• Suitable raw or prepared\n• Always confirm identification before eating\n• Generally well tolerated when eaten in moderation',
    lookalikes:
      'Some low-growing native berries and shrub fruits can be confusing. Confirm identification using multiple features and local guidance before eating.',
    edibleParts: ['fruit'],
    prepBasics: ['harvest ripe fruit only', 'wash gently', 'eat fresh or lightly process', 'remove seed if desired'],
    sourceRefs: ['Community knowledge (varies by Country)', 'Local field guides', 'Local Indigenous voices'],
    tags: ['Fruit', 'Safe', 'Preparation: Minimal', 'Flavour: Mild / Fresh', 'Environment: Coastal / Woodland'],
    isBushTucker: true,
    isMedicinal: false,
    edibilityStatus: 'safe',
  },
  {
    id: 'muntries',
    slug: 'muntries',
    commonName: 'Muntries',
    scientificName: 'Native Berry • Crisp Groundcover Fruit',
    category: 'Berry',
    heroImageUrl:
      'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/4wyowwuva5315m2h56ip3',
    overview:
      'Muntries are a native Australian berry traditionally found across southern Australia, growing close to the ground on creeping shrubs. The berries range from green to red and are known for their crisp texture and apple-like flavour with gentle sweetness.\n\nThey have long been enjoyed as a fresh, seasonal food, particularly valued for their refreshing quality.',
    safetyLevel: 'safe',
    confidenceHint: 'Safe to consume when ripe. Suitable raw or prepared. Always confirm identification.',
    seasonality: 'Spring → Early Summer',
    seasonalityNote: 'Fruit ripens after flowering, often following cooler months.',
    preparation:
      'Harvest ripe berries gently. Wash lightly if needed. Eat fresh or lightly prepare. Use soon after harvest — Muntries are delicate and best used fresh.',
    suggestedUses:
      'Fresh snacking • Salads • Desserts • Light preserves • Garnishes\n\nTheir crispness makes them ideal for fresh and lightly prepared dishes.',
    culturalNotes:
      'Traditionally gathered by families while moving across Country, often eaten fresh at harvest sites. Knowledge is shared through seasonal practice, reflecting a close relationship with ground-level plants.\n\nMuntries teach attentiveness — nourishment can be found close to the earth.\n\nCultural knowledge shared here is general and non-restricted.',
    warnings:
      'Status: SAFE\n\n• Safe to consume when ripe\n• Suitable raw or prepared\n• Always confirm identification\n• Generally low risk and well tolerated',
    lookalikes:
      'Small groundcover berries can be confused with other creeping shrubs. Confirm identification using multiple features (leaf shape, growth habit, fruit form, habitat) and local guidance before eating.',
    edibleParts: ['berry', 'fruit'],
    prepBasics: ['harvest ripe berries gently', 'wash lightly', 'eat fresh', 'use soon after harvest', 'avoid trampling groundcover'],
    sourceRefs: ['Community knowledge (varies by Country)', 'Local field guides', 'Local Indigenous voices'],
    tags: ['Berry', 'Safe', 'Preparation: Minimal', 'Flavour: Crisp / Sweet', 'Environment: Southern Woodland / Coastal'],
    isBushTucker: true,
    isMedicinal: false,
    edibilityStatus: 'safe',
  },
  {
    id: 'illawarra-plum',
    slug: 'illawarra-plum',
    commonName: 'Illawarra Plum',
    scientificName: 'Rainforest Native Fruit • Dark Plum',
    category: 'Fruit',
    heroImageUrl:
      'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/wniclm256l583hw566ce1',
    overview:
      'Illawarra Plum is a native rainforest fruit found along the east coast of Australia, growing on tall canopy trees. Recognisable by its deep purple to black flesh and large seed, it has a rich, mild sweetness with earthy undertones.\n\nTraditionally harvested seasonally, it is now valued in both bush food knowledge and modern native cuisine.',
    safetyLevel: 'caution',
    confidenceHint:
      'Fruit flesh is edible when fully ripe, but the large seed is NOT edible and must be removed. Do not consume unripe fruit. Always confirm identification before eating.',
    seasonality: 'Late Summer → Autumn',
    seasonalityNote: 'Fruit ripens after warm, wet conditions in rainforest environments.',
    preparation:
      'Harvest fully ripe fruit. Cut away and discard the large seed. Use the flesh fresh or cooked. Balance flavour with sweetness or spice — cooking enhances texture and depth.',
    suggestedUses:
      'Jams & preserves • Desserts & baking • Sauces & reductions • Chutneys • Savoury accompaniments.\n\nOften compared to European plums but with a distinctly native character.',
    culturalNotes:
      'Traditionally harvested from tall rainforest trees and shared within communities during peak season. Harvesting required skill and timing, reflecting deep knowledge of forest cycles.\n\nCultural knowledge shared here is general and non-restricted.',
    warnings:
      'Status: CAUTION — PREPARATION REQUIRED\n\n• Fruit flesh is edible when ripe\n• Seed is NOT edible and must be removed\n• Do not consume unripe fruit\n• Always prepare correctly before use',
    lookalikes:
      'Some rainforest fruits can look similar at a glance. Confirm identification using multiple features (leaf form, fruit/seed size, habitat) and local guidance before eating.',
    edibleParts: ['fruit'],
    prepBasics: ['harvest fully ripe fruit', 'remove and discard the large seed', 'use flesh fresh or cooked', 'balance with sweetness/spice'],
    sourceRefs: ['Community knowledge (varies by Country)', 'Local field guides', 'Local Indigenous voices'],
    tags: ['Rainforest Native Fruit', 'Caution', 'Preparation: Required', 'Flavour: Rich / Mildly Sweet', 'Environment: Rainforest'],
    isBushTucker: true,
    isMedicinal: false,
    edibilityStatus: 'caution',
  },
  {
    id: 'lilly-pilly',
    slug: 'lilly-pilly',
    commonName: 'Lilly Pilly',
    scientificName: 'Native Berry • Rainforest & Coastal Fruit',
    category: 'Berry',
    heroImageUrl:
      'https://images.unsplash.com/photo-1705360156521-40c178a4fa92?fm=jpg&q=60&w=2000&auto=format&fit=crop',
    overview:
      'Lilly Pilly refers to several native Syzygium species traditionally found along Australia’s east coast, from rainforest margins to coastal woodlands. The berries range in colour from pink to deep purple and vary in flavour from mildly sweet to tart.\n\nLong valued as a seasonal bush food, Lilly Pilly is now also common in urban landscapes — though not all varieties are palatable.',
    safetyLevel: 'caution',
    confidenceHint:
      'Species varies. Many are edible, but some ornamental varieties are bitter or unpleasant. Only consume fruit from known edible species.',
    seasonality: 'Spring → Summer',
    seasonalityNote: 'Fruit ripens as weather warms, often signalling seasonal abundance.',
    preparation:
      'Harvest ripe fruit only. Wash thoroughly. Remove seed if desired. Use fresh or cooked — cooking often improves flavour and softness.',
    suggestedUses:
      'Jams & preserves • Sauces & chutneys • Baking & desserts • Fresh snacking (selected species) • Syrups & cordials\n\nOften paired with spice or citrus to balance tartness.',
    culturalNotes:
      'Traditionally harvested seasonally and shared fresh or preserved. Knowledge of edible species is local and passed through observation.\n\nLilly Pilly teaches us that names can be shared, but knowledge is specific.\n\nCultural knowledge shared here is general and non-restricted.',
    warnings:
      'Status: CAUTION — SPECIES VARIES\n\n• Many Lilly Pilly species are edible\n• Flavour and texture vary widely\n• Some ornamental varieties are bitter or unpleasant\n• Only consume fruit from known edible species',
    lookalikes:
      'Many Lilly Pilly species look similar, and some ornamental plantings can be unpleasant to eat. Confirm species using multiple features (leaf, fruit, habitat) and local guidance before eating.',
    edibleParts: ['berry', 'fruit'],
    prepBasics: ['harvest ripe fruit only', 'wash thoroughly', 'remove seed (optional)', 'use fresh or cook'],
    tags: ['Berry', 'Caution', 'Preparation: Minimal / Cooked', 'Flavour: Sweet–Tart', 'Environment: Rainforest / Coastal'],
    sourceRefs: ['Community knowledge (varies by Country)', 'Local field guides', 'Local Indigenous voices'],
    isBushTucker: true,
    isMedicinal: false,
    edibilityStatus: 'caution',
  },
  {
    id: 'midyim-berry',
    slug: 'midyim-berry',
    commonName: 'Midyim Berry',
    scientificName: 'Native Berry • Sweet Myrtle Fruit',
    category: 'Berry',
    heroImageUrl:
      'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/9t5m36gwnpzgw20tb1rte',
    overview:
      'Midyim Berry is a small native berry traditionally found along Australia’s east coast, growing on low shrubs in coastal and woodland environments. The berries are white to pale pink, softly speckled, and known for their gentle sweetness and subtle spice.\n\nIt has long been valued as a fresh seasonal food, particularly enjoyed straight from the plant.',
    safetyLevel: 'safe',
    confidenceHint: 'Safe to consume when ripe. Always confirm identification — if unsure, do not consume.',
    seasonality: 'Spring → Early Summer',
    seasonalityNote: 'Berries ripen as weather warms and daylight increases.',
    preparation:
      'Harvest ripe berries gently. Wash lightly if needed. Eat fresh or lightly prepare — berries are delicate and best used soon after harvest.',
    suggestedUses:
      'Fresh snacking • Salads • Desserts • Light jams & preserves • Garnishes\n\nMidyim Berry shines in simple, fresh preparations.',
    culturalNotes:
      'Traditionally gathered by families (often women and children) and eaten fresh while moving across Country. Knowledge is shared through seasonal observation, reflecting lightness, care, and connection.\n\nMidyim Berry teaches us that nourishment can be gentle.\n\nCultural knowledge shared here is general and non-restricted.',
    warnings:
      'Status: SAFE\n\n• Safe to consume when ripe\n• Suitable raw or prepared\n• Always confirm identification\n• Generally well tolerated and low risk',
    lookalikes:
      'Some small native berries can look similar. Confirm using multiple features (leaf form, fruit speckling/colour, plant habit, habitat) and local guidance before eating.',
    edibleParts: ['berry', 'fruit'],
    prepBasics: ['harvest gently', 'wash lightly (optional)', 'eat fresh promptly', 'use in simple dishes'],
    tags: ['Berry', 'Safe', 'Preparation: Minimal', 'Flavour: Sweet / Mild', 'Environment: Coastal / Woodland'],
    sourceRefs: ['Community knowledge (varies by Country)', 'Local field guides', 'Local Indigenous voices'],
    isBushTucker: true,
    isMedicinal: false,
    edibilityStatus: 'safe',
  },
  {
    id: 'native-pepperberry',
    slug: 'native-pepperberry',
    commonName: 'Native Pepperberry',
    scientificName: 'Native Spice • Mountain Pepper (Tasmannia lanceolata)',
    category: 'Spice / Leaf / Berry',
    heroImageUrl:
      'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/x3he40ggds7lj65cyxhgm',
    overview:
      'Mountain Pepper (Native Pepperberry) is a native Australian plant traditionally found in cool, highland and temperate rainforest regions, particularly in south-eastern Australia and Tasmania. Both the leaves and berries are valued for their strong, peppery heat and aromatic complexity.\n\nIt is one of Australia’s most potent native spices and is used sparingly with respect.',
    safetyLevel: 'caution',
    confidenceHint:
      'Safe in small culinary amounts only. Very strong flavour — use sparingly. Avoid large quantities and avoid medicinal dosing without expert guidance.',
    seasonality: 'Leaves: Most of the year • Berries: Late Summer → Autumn',
    seasonalityNote: 'Berries darken as they ripen and are usually dried before use; drying enhances shelf life and intensity.',
    preparation:
      'Leaves: Harvest mature leaves, wash and dry, use fresh or dried; crush or grind lightly.\n\nBerries: Harvest ripe berries, dry thoroughly, then grind or crush before use.',
    suggestedUses:
      'Meat rubs • Savoury sauces • Vegetable dishes • Bush spice blends • Infused oils\n\nOften used as a black pepper substitute, but much stronger — start with a pinch.',
    culturalNotes:
      'Traditionally used as both food and medicine, harvested carefully in cool forest systems. Knowledge emphasises restraint and respect; leaves are often used more gently than berries.\n\nMountain Pepper teaches power through balance.\n\nCultural knowledge shared here is general and non-restricted.',
    warnings:
      'Status: CAUTION — STRONG & CONCENTRATED\n\n• Safe in small culinary amounts only\n• Very strong flavour — use sparingly\n• Not recommended in large quantities\n• Avoid medicinal dosing without expert guidance',
    lookalikes:
      'Some aromatic shrubs may be confused when not fruiting. Confirm identification using multiple features (leaf shape/aroma, berry appearance, habitat) and local guidance before harvesting.',
    edibleParts: ['leaves', 'berries'],
    prepBasics: ['use sparingly', 'dry leaves or berries for storage', 'grind/crush before use', 'start with a pinch'],
    tags: ['Spice', 'Leaf', 'Berry', 'Caution', 'Preparation: Dry / Grind', 'Flavour: Hot / Peppery', 'Environment: Cool Temperate / Highland'],
    sourceRefs: ['Community knowledge (varies by Country)', 'Local field guides', 'Local Indigenous voices'],
    isBushTucker: true,
    isMedicinal: true,
    edibilityStatus: 'caution',
  },
  {
    id: 'kakadu-plum',
    slug: 'kakadu-plum',
    commonName: 'Kakadu Plum',
    scientificName: 'Northern Native Fruit • Superfruit',
    category: 'Fruit',
    heroImageUrl:
      'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/844nkttl25k3vrhrq4v8x',
    overview:
      'Kakadu Plum is a native fruit traditionally found across Northern Australia, growing on small to medium-sized trees in open woodland and savanna Country. It is renowned globally for having one of the highest natural Vitamin C contents of any fruit.\n\nFor Aboriginal communities, Kakadu Plum has long been valued as a seasonal food and wellbeing plant, harvested with care and deep environmental knowledge.',
    safetyLevel: 'safe',
    confidenceHint:
      'Safe to consume when ripe. Naturally acidic. Best used fresh or processed; generally safe for most people when consumed in moderation.',
    seasonality: 'Late Wet Season → Early Dry Season',
    seasonalityNote: 'Fruit ripens following seasonal rains, signalling a shift in Country.',
    preparation:
      'Harvest ripe fruit (often when fallen). Wash thoroughly. Use fresh or dry for storage. Process gently to preserve nutrients — drying and freezing are common modern methods to extend use.',
    suggestedUses:
      'Jams & preserves • Sauces & syrups • Powders & smoothies • Beverages • Desserts.\n\nOften used in small quantities due to strong acidity and nutrient density.',
    culturalNotes:
      'Traditionally harvested by hand during seasonal abundance. Knowledge is passed through careful observation of timing and ripeness. Fruit is often shared, dried, or traded, with practices that respect regeneration and Country.\n\nCultural knowledge shared here is general and non-restricted.',
    warnings:
      'Status: SAFE\n\n• Safe to consume when ripe\n• Naturally acidic\n• Best eaten fresh or processed\n• Generally safe for most people when consumed in moderation',
    lookalikes:
      'Some small green bush fruits can look similar at a glance. Confirm identification using multiple features (leaf, bark, habitat, fruit shape/stone) and local guidance before eating.',
    edibleParts: ['fruit'],
    prepBasics: ['harvest ripe fruit only', 'wash thoroughly', 'use fresh or dry', 'process gently', 'use small quantities'],
    sourceRefs: ['Community knowledge (varies by Country)', 'Local field guides', 'Local Indigenous voices'],
    tags: ['Fruit', 'Safe', 'Preparation: Minimal', 'Flavour: Sour / Acidic', 'Environment: Tropical / Savanna'],
    isBushTucker: true,
    isMedicinal: false,
    edibilityStatus: 'safe',
  },
];

function normalizeSlugish(input: string): string {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/\+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .replace(/\-+/g, '-')
    .replace(/^\-+/, '')
    .replace(/\-+$/, '');
}

function toLearnPlant(row: SupabasePlantRow, index: number): LearnPlant {
  const id = String(row.id ?? `row-${index}`);
  const slug = normalizeSlugish(String(row.slug ?? row.common_name ?? id));

  return {
    id,
    slug: slug.length > 0 ? slug : id,
    commonName: String(row.common_name ?? 'Unknown plant'),
    scientificName: row.scientific_name ? String(row.scientific_name) : undefined,
    category: row.category ? String(row.category) : undefined,
    overview: row.overview ? String(row.overview) : undefined,
    isBushTucker: typeof row.is_bush_tucker === 'boolean' ? row.is_bush_tucker : undefined,
    isMedicinal: typeof row.is_medicinal === 'boolean' ? row.is_medicinal : undefined,
    safetyLevel: row.safety_level ? String(row.safety_level) : undefined,
    confidenceHint: row.confidence_hint ? String(row.confidence_hint) : undefined,
    edibleParts: Array.isArray(row.edible_parts) ? row.edible_parts.map((p) => String(p)) : undefined,
    preparation: row.preparation ? String(row.preparation) : undefined,
    seasonality: row.seasonality ? String(row.seasonality) : undefined,
    warnings: row.warnings ? String(row.warnings) : undefined,
    lookalikes: row.lookalikes ? String(row.lookalikes) : undefined,
    culturalNotes: row.cultural_notes ? String(row.cultural_notes) : undefined,
    suggestedUses: row.suggested_uses ? String(row.suggested_uses) : undefined,
    prepBasics: Array.isArray(row.prep_basics) ? row.prep_basics.map((p) => String(p)) : undefined,
    seasonalityNote: row.seasonality_note ? String(row.seasonality_note) : undefined,
    sourceRefs: Array.isArray(row.source_refs) ? row.source_refs.map((p) => String(p)) : undefined,
    edibilityStatus: row.edibility_status ? String(row.edibility_status) : undefined,
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function pickFallbackForSupabaseRow(localKey: string, row: SupabasePlantRow | null): LearnPlant | null {
  const key = normalizeSlugish(localKey);
  if (!key) return null;

  const byKey = FALLBACK_PLANTS.find((p) => normalizeSlugish(p.id) === key || normalizeSlugish(p.slug) === key) ?? null;
  if (byKey) return byKey;

  const rowSlug = row?.slug ? normalizeSlugish(row.slug) : '';
  if (rowSlug) {
    const byContains =
      FALLBACK_PLANTS.find((p) => rowSlug.includes(normalizeSlugish(p.slug)) || normalizeSlugish(p.slug).includes(rowSlug)) ??
      null;
    if (byContains) return byContains;
  }

  const rowCommon = row?.common_name ? String(row.common_name).toLowerCase().trim() : '';
  if (rowCommon) {
    const byCommon = FALLBACK_PLANTS.find((p) => rowCommon.includes(p.commonName.toLowerCase())) ?? null;
    if (byCommon) return byCommon;
  }

  return null;
}

function mergePreferSupabase(supabasePlant: LearnPlant, fallback: LearnPlant | null): LearnPlant {
  if (!fallback) return supabasePlant;

  const pickString = (a: string | undefined, b: string | undefined) => (a && a.trim().length > 0 ? a : b);
  const pickStringArr = (a: string[] | undefined, b: string[] | undefined) => (a && a.length > 0 ? a : b);
  const pickBool = (a: boolean | undefined, b: boolean | undefined) => (typeof a === 'boolean' ? a : b);

  return {
    ...fallback,
    ...supabasePlant,
    slug: pickString(supabasePlant.slug, fallback.slug) ?? fallback.slug,
    commonName: pickString(supabasePlant.commonName, fallback.commonName) ?? fallback.commonName,
    scientificName: pickString(supabasePlant.scientificName, fallback.scientificName),
    category: pickString(supabasePlant.category, fallback.category),
    heroImageUrl: pickString(supabasePlant.heroImageUrl, fallback.heroImageUrl),
    overview: pickString(supabasePlant.overview, fallback.overview),
    safetyLevel: pickString(supabasePlant.safetyLevel, fallback.safetyLevel),
    confidenceHint: pickString(supabasePlant.confidenceHint, fallback.confidenceHint),
    edibleParts: pickStringArr(supabasePlant.edibleParts, fallback.edibleParts),
    preparation: pickString(supabasePlant.preparation, fallback.preparation),
    seasonality: pickString(supabasePlant.seasonality, fallback.seasonality),
    warnings: pickString(supabasePlant.warnings, fallback.warnings),
    lookalikes: pickString(supabasePlant.lookalikes, fallback.lookalikes),
    culturalNotes: pickString(supabasePlant.culturalNotes, fallback.culturalNotes),
    suggestedUses: pickString(supabasePlant.suggestedUses, fallback.suggestedUses),
    prepBasics: pickStringArr(supabasePlant.prepBasics, fallback.prepBasics),
    seasonalityNote: pickString(supabasePlant.seasonalityNote, fallback.seasonalityNote),
    sourceRefs: pickStringArr(supabasePlant.sourceRefs, fallback.sourceRefs),
    tags: pickStringArr(supabasePlant.tags, fallback.tags),
    edibilityStatus: pickString(supabasePlant.edibilityStatus, fallback.edibilityStatus),
    isBushTucker: pickBool(supabasePlant.isBushTucker, fallback.isBushTucker),
    isMedicinal: pickBool(supabasePlant.isMedicinal, fallback.isMedicinal),
  };
}

async function fetchPlantByIdOrSlug(idOrSlug: string): Promise<LearnPlant | null> {
  const trimmed = idOrSlug.trim();
  if (!trimmed) return null;

  const key = normalizeSlugish(trimmed);
  console.log('[learn-detail] fetchPlantByIdOrSlug', {
    raw: trimmed,
    normalized: key,
    hasSupabaseConfig,
  });

  const localExact =
    FALLBACK_PLANTS.find((p) => normalizeSlugish(p.slug) === key || normalizeSlugish(p.id) === key) ?? null;

  const localFuzzy =
    localExact ??
    FALLBACK_PLANTS.find((p) => {
      const slug = normalizeSlugish(p.slug);
      const id = normalizeSlugish(p.id);
      const name = p.commonName.toLowerCase();
      return slug === key || id === key || slug.includes(key) || key.includes(slug) || name.includes(trimmed.toLowerCase());
    }) ??
    null;

  const local = localFuzzy;

  if (!hasSupabaseConfig) {
    console.log('[learn-detail] supabase not configured; using fallback', supabasePublicDebugInfo);
    return local;
  }

  try {
    console.log('[learn-detail] fetching plant', { idOrSlug: trimmed, fallbackHit: Boolean(local) });

    const slugValue = key.length > 0 ? key : trimmed;

    const { data, error } = await supabase
      .from('plants')
      .select(
        'id, slug, common_name, scientific_name, category, is_bush_tucker, is_medicinal, safety_level, confidence_hint, overview, edible_parts, preparation, seasonality, warnings, lookalikes, cultural_notes, suggested_uses, prep_basics, seasonality_note, source_refs, edibility_status, created_at, updated_at'
      )
      .or(`id.eq.${trimmed},slug.eq.${trimmed},slug.eq.${slugValue}`)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log('[learn-detail] supabase error; falling back', { message: error.message });
      return local;
    }

    if (!data) {
      console.log('[learn-detail] not found in supabase by id/slug; falling back', { idOrSlug: trimmed });
      return local;
    }

    const fallback = pickFallbackForSupabaseRow(trimmed, data as SupabasePlantRow);
    const supa = toLearnPlant(data as SupabasePlantRow, 0);

    const merged = mergePreferSupabase(supa, fallback);

    console.log('[learn-detail] merged plant', {
      idOrSlug: trimmed,
      supabaseId: supa.id,
      supabaseSlug: supa.slug,
      fallbackId: fallback?.id,
      fallbackSlug: fallback?.slug,
      hasOverview: Boolean(merged.overview),
      hasPreparation: Boolean(merged.preparation),
      hasSeasonality: Boolean(merged.seasonality || merged.seasonalityNote),
      hasWarnings: Boolean(merged.warnings),
      hasLookalikes: Boolean(merged.lookalikes),
      hasCulturalNotes: Boolean(merged.culturalNotes),
      hasSuggestedUses: Boolean(merged.suggestedUses),
      tagsCount: merged.tags?.length ?? 0,
    });

    return merged;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log('[learn-detail] unexpected error; falling back', { message });
    return local;
  }
}

export default function LearnPlantDetailScreen() {
  const params = useLocalSearchParams();
  const pathname = usePathname();

  const idParamRaw = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';

  const firstStringParamRaw = useMemo(() => {
    const values = Object.values(params);
    for (const v of values) {
      if (typeof v === 'string' && v.trim().length > 0) return v;
      if (Array.isArray(v) && typeof v[0] === 'string' && String(v[0]).trim().length > 0) return String(v[0]);
    }
    return '';
  }, [params]);

  const safeDecode = (value: string): string => {
    const v = String(value ?? '');
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };

  const sanitizeParam = (raw: string): string => {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) return '';

    const noFragment = trimmed.split('#')[0] ?? '';
    const noQuery = noFragment.split('?')[0] ?? '';

    const segments = noQuery
      .split('/')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const lastSegment = segments.length > 0 ? (segments[segments.length - 1] ?? '') : '';

    const once = safeDecode(lastSegment).trim();
    const twice = safeDecode(once).trim();
    return twice;
  };

  const deriveFromPathname = (rawPath: string): string => {
    const p = String(rawPath ?? '').split('?')[0]?.split('#')[0] ?? '';
    const segs = p
      .split('/')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const last = segs.length > 0 ? (segs[segs.length - 1] ?? '') : '';
    return sanitizeParam(last);
  };

  const idParamFromParams = sanitizeParam(String(idParamRaw ?? ''));
  const idParamFromAnyParam = sanitizeParam(String(firstStringParamRaw ?? ''));
  const idParamFromPath = deriveFromPathname(pathname);
  const idParam = idParamFromParams || idParamFromAnyParam || idParamFromPath;
  const idParamNormalized = normalizeSlugish(idParam);
  console.log('[learn-detail] route param', {
    raw: idParamRaw,
    firstStringParamRaw,
    pathname,
    fromParams: idParamFromParams,
    fromPath: idParamFromPath,
    chosen: idParam,
    normalized: idParamNormalized,
    allParams: params,
  });

  const { getPlantImageUrl, setPlantImageUrl, clearPlantImageUrl } = useLearnImages();

  const plantQuery = useQuery({
    queryKey: ['learn', 'plant', idParam, idParamNormalized],
    queryFn: () => fetchPlantByIdOrSlug(idParamNormalized || idParam),
    enabled: (idParamNormalized || idParam).length > 0,
  });

  const plant = plantQuery.data ?? null;

  const hero =
    getPlantImageUrl(plant?.slug ?? idParamNormalized) ??
    plant?.heroImageUrl ??
    FALLBACK_PLANTS[0]?.heroImageUrl;

  const pickImageMutation = useMutation({
    mutationFn: async () => {
      if (!plant) throw new Error('Plant not loaded');

      const existingPerm = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (!existingPerm.granted) {
        const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!requested.granted) {
          console.log('[learn-detail] media library permission denied');
          throw new Error('Photos permission is required to change the image.');
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.9,
        aspect: [1, 1],
      });

      if (result.canceled) {
        console.log('[learn-detail] image pick canceled');
        return { canceled: true as const };
      }

      const uri = result.assets?.[0]?.uri;
      if (!uri) throw new Error('Could not read selected image');

      await setPlantImageUrl(plant.slug, uri);
      console.log('[learn-detail] image override saved', { slug: plant.slug });
      return { canceled: false as const, uri };
    },
  });

  const clearImageMutation = useMutation({
    mutationFn: async () => {
      if (!plant) throw new Error('Plant not loaded');
      await clearPlantImageUrl(plant.slug);
      console.log('[learn-detail] image override cleared', { slug: plant.slug });
    },
  });

  const { mutate: pickImageMutate, isPending: isPickingImage } = pickImageMutation;
  const { mutate: clearImageMutate, isPending: isClearingImage } = clearImageMutation;

  const onPressChangeImage = useCallback(() => {
    pickImageMutate(undefined, {
      onError: (e) => {
        const message = e instanceof Error ? e.message : String(e);
        Alert.alert('Could not change photo', message);
      },
    });
  }, [pickImageMutate]);

  const onPressRemoveImage = useCallback(() => {
    if (!plant) return;
    Alert.alert('Remove photo?', 'This will restore the default image for this plant.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          clearImageMutate(undefined, {
            onError: (e) => {
              const message = e instanceof Error ? e.message : String(e);
              Alert.alert('Could not remove photo', message);
            },
          });
        },
      },
    ]);
  }, [clearImageMutate, plant]);

  const chips = useMemo<string[]>(() => {
    const out: string[] = [];
    if (plant?.category) out.push(plant.category);
    if (plant?.isBushTucker) out.push('Bush tucker');
    if (plant?.isMedicinal) out.push('Medicinal');
    if (plant?.safetyLevel) out.push(`Safety: ${plant.safetyLevel}`);
    if (plant?.edibilityStatus) out.push(`Edibility: ${plant.edibilityStatus}`);
    const extraTags = (plant?.tags ?? []).map((t) => String(t)).filter((t) => t.trim().length > 0);
    out.push(...extraTags);
    return Array.from(new Set(out));
  }, [plant?.category, plant?.edibilityStatus, plant?.isBushTucker, plant?.isMedicinal, plant?.safetyLevel, plant?.tags]);

  const edibleParts = useMemo<string[]>(() => {
    return (plant?.edibleParts ?? []).map((t) => String(t)).filter((t) => t.trim().length > 0).slice(0, 12);
  }, [plant?.edibleParts]);

  const prepBasics = useMemo<string[]>(() => {
    return (plant?.prepBasics ?? []).map((t) => String(t)).filter((t) => t.trim().length > 0).slice(0, 12);
  }, [plant?.prepBasics]);

  const sourceRefs = useMemo<string[]>(() => {
    return (plant?.sourceRefs ?? []).map((t) => String(t)).filter((t) => t.trim().length > 0).slice(0, 12);
  }, [plant?.sourceRefs]);

  const renderChip = useCallback((t: string, prefix: string) => {
    const slug = `${prefix}-${t}`.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
    return (
      <View key={`${prefix}-${t}`} style={styles.tag} testID={`learn-${prefix}-${slug}`}>
        <Text style={styles.tagText}>{t}</Text>
      </View>
    );
  }, []);

  if (plantQuery.isLoading) {
    return (
      <View style={styles.loadingContainer} testID="learn-detail-loading">
        <ActivityIndicator color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (!plant) {
    return (
      <View style={styles.loadingContainer} testID="learn-detail-not-found">
        <Text style={styles.notFoundTitle}>Not found</Text>
        <Text style={styles.loadingText}>This plant resource isn’t available yet.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: plant.commonName,
          headerRight: () => (
            <View style={styles.headerActions} testID="learn-detail-header-actions">
              <Pressable
                style={({ pressed }) => [styles.headerIconButton, pressed && styles.headerIconButtonPressed]}
                onPress={onPressChangeImage}
                disabled={isPickingImage}
                testID="learn-detail-header-change"
              >
                <ImagePlus size={18} color={COLORS.text} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.headerIconButton, pressed && styles.headerIconButtonPressed]}
                onPress={onPressRemoveImage}
                disabled={isClearingImage}
                testID="learn-detail-header-remove"
              >
                <Trash2 size={18} color={COLORS.text} />
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="learn-detail-scroll" keyboardShouldPersistTaps="handled">
      <View style={styles.heroWrap}>
        {hero ? (
          <LearnRemoteImage
            uri={hero}
            style={styles.hero}
            contentFit="cover"
            transition={180}
            cachePolicy="disk"
            onLoad={() => {
              console.log('[learn-detail] hero loaded', { idParam: idParamNormalized, uri: hero });
            }}
            onError={(error) => {
              console.log('[learn-detail] hero load failed', { idParam: idParamNormalized, uri: hero, error });
            }}
            testID="learn-detail-hero-image"
          />
        ) : (
          <View style={styles.heroFallback} />
        )}
        <View style={styles.heroOverlay} />

        <View style={styles.heroActions} pointerEvents="box-none">
          <Pressable
            style={({ pressed }) => [styles.heroActionButton, pressed && styles.heroActionButtonPressed]}
            onPress={onPressChangeImage}
            disabled={isPickingImage}
            testID="learn-detail-change-image"
          >
            <ImagePlus size={16} color="rgba(255,255,255,0.92)" />
            <Text style={styles.heroActionText}>{isPickingImage ? 'Opening…' : 'Change'}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.heroActionButton, pressed && styles.heroActionButtonPressed]}
            onPress={onPressRemoveImage}
            disabled={isClearingImage}
            testID="learn-detail-clear-image"
          >
            <Trash2 size={16} color="rgba(255,255,255,0.92)" />
            <Text style={styles.heroActionText}>{isClearingImage ? 'Removing…' : 'Remove'}</Text>
          </Pressable>
        </View>

        <View style={styles.heroTextWrap}>
          <Text style={styles.title} testID="learn-detail-title">
            {plant.commonName}
          </Text>
          <Text style={styles.subtitle} testID="learn-detail-subtitle">
            {plant.scientificName ?? '—'}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.metaRow}>
          <View style={styles.metaChip} testID="learn-detail-category">
            <Text style={styles.metaChipText}>{plant.category ?? 'Plant'}</Text>
          </View>
          <View style={styles.metaChipMuted} testID="learn-detail-source">
            <Text style={styles.metaChipTextMuted}>{hasSupabaseConfig ? 'Supabase' : 'Offline'}</Text>
          </View>
        </View>

        {chips.length > 0 ? (
          <View style={styles.tagsRow} testID="learn-detail-chips">
            {chips.map((c) => renderChip(c, 'chip'))}
          </View>
        ) : null}

        {plant.overview ? (
          <Text style={styles.summary} testID="learn-detail-overview">
            {plant.overview}
          </Text>
        ) : (
          <Text style={styles.summaryMuted} testID="learn-detail-overview-empty">
            No overview yet.
          </Text>
        )}

        {plant.confidenceHint ? (
          <View style={styles.callout} testID="learn-detail-confidence">
            <Text style={styles.calloutTitle}>Confidence hint</Text>
            <Text style={styles.calloutText}>{plant.confidenceHint}</Text>
          </View>
        ) : null}

        {edibleParts.length > 0 ? (
          <View style={styles.block} testID="learn-detail-edible-parts">
            <Text style={styles.blockTitle}>Edible parts</Text>
            <View style={styles.tagsRow}>{edibleParts.map((t) => renderChip(t, 'edible'))}</View>
          </View>
        ) : null}

        {plant.preparation ? (
          <View style={styles.block} testID="learn-detail-preparation">
            <Text style={styles.blockTitle}>Preparation</Text>
            <Text style={styles.blockText}>{plant.preparation}</Text>
          </View>
        ) : null}

        {prepBasics.length > 0 ? (
          <View style={styles.block} testID="learn-detail-prep-basics">
            <Text style={styles.blockTitle}>Prep basics</Text>
            <View style={styles.tagsRow}>{prepBasics.map((t) => renderChip(t, 'prep'))}</View>
          </View>
        ) : null}

        {plant.seasonality || plant.seasonalityNote ? (
          <View style={styles.block} testID="learn-detail-seasonality">
            <Text style={styles.blockTitle}>Seasonality</Text>
            {plant.seasonality ? <Text style={styles.blockText}>{plant.seasonality}</Text> : null}
            {plant.seasonalityNote ? <Text style={styles.blockTextMuted}>{plant.seasonalityNote}</Text> : null}
          </View>
        ) : null}

        {plant.warnings ? (
          <View style={styles.warningBox} testID="learn-detail-warnings">
            <Text style={styles.warningTitle}>Warnings</Text>
            <Text style={styles.warningText}>{plant.warnings}</Text>
          </View>
        ) : null}

        {plant.lookalikes ? (
          <View style={styles.block} testID="learn-detail-lookalikes">
            <Text style={styles.blockTitle}>Lookalikes</Text>
            <Text style={styles.blockText}>{plant.lookalikes}</Text>
          </View>
        ) : null}

        {plant.culturalNotes ? (
          <View style={styles.block} testID="learn-detail-cultural">
            <Text style={styles.blockTitle}>Cultural notes</Text>
            <Text style={styles.blockText}>{plant.culturalNotes}</Text>
          </View>
        ) : null}

        {plant.suggestedUses ? (
          <View style={styles.block} testID="learn-detail-suggested-uses">
            <Text style={styles.blockTitle}>Suggested uses</Text>
            <Text style={styles.blockText}>{plant.suggestedUses}</Text>
          </View>
        ) : null}

        {sourceRefs.length > 0 ? (
          <View style={styles.block} testID="learn-detail-sources">
            <Text style={styles.blockTitle}>Sources</Text>
            <View style={styles.tagsRow}>{sourceRefs.map((t) => renderChip(t, 'source'))}</View>
          </View>
        ) : null}
      </View>
    </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingBottom: 36,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  notFoundTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  heroWrap: {
    height: 340,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
    marginRight: 6,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  headerIconButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  hero: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroFallback: {
    flex: 1,
    backgroundColor: COLORS.card,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  heroActions: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    gap: 10,
  },
  heroActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  heroActionButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  heroActionText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  heroTextWrap: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.86)',
    fontSize: 14,
    fontWeight: '800',
  },
  section: {
    paddingHorizontal: 18,
    paddingTop: 18,
    gap: 14,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  callout: {
    backgroundColor: 'rgba(46, 125, 50, 0.10)',
    borderColor: 'rgba(46, 125, 50, 0.20)',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  calloutTitle: {
    color: COLORS.text,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  calloutText: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  warningBox: {
    backgroundColor: 'rgba(255, 138, 101, 0.14)',
    borderColor: 'rgba(255, 138, 101, 0.26)',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  warningTitle: {
    color: COLORS.text,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  warningText: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  block: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
    gap: 8,
  },
  blockTitle: {
    color: COLORS.text,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  blockText: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  blockTextMuted: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  metaChip: {
    backgroundColor: 'rgba(46, 125, 50, 0.16)',
    borderColor: 'rgba(46, 125, 50, 0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
  },
  metaChipText: {
    color: COLORS.text,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  metaChipMuted: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
  },
  metaChipTextMuted: {
    color: COLORS.textSecondary,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  summary: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  summaryMuted: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  tag: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  tagText: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 12,
  },
  nextBox: {
    marginTop: 6,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  nextTitle: {
    color: COLORS.text,
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  nextText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 19,
  },
});
