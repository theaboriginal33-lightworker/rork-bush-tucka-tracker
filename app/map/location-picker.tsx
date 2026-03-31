import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Platform,
} from 'react-native';
import MapView, { Region } from 'react-native-maps';

import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';

// ── Your .env key ─────────────────────────────────────────────
const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY!;

const BG_DEEP   = '#041a14';
const CARD_BG   = '#0d1f18';
const GREEN     = '#3aad7e';
const GREEN_BTN = '#3db87f';
const BORDER    = '#163326';
const TEXT_W    = '#ffffff';
const TEXT_M    = '#5a8a72';
const TEXT_H    = '#3a6650';

function CrosshairIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} stroke={GREEN} strokeWidth={1.8} />
      <Path d="M12 2v4M12 18v4M2 12h4M18 12h4"
        stroke={GREEN} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M19 12H5M5 12l7-7M5 12l7 7"
        stroke={TEXT_W} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Fixed pin SVG in centre of map
function PinIcon() {
  return (
    <Svg width={36} height={44} viewBox="0 0 36 44" fill="none">
      <Path
        d="M18 0C10.268 0 4 6.268 4 14c0 10.5 14 30 14 30S32 24.5 32 14C32 6.268 25.732 0 18 0z"
        fill={GREEN}
      />
      <Circle cx={18} cy={14} r={6} fill={BG_DEEP} />
    </Svg>
  );
}

export default function LocationPicker() {
  const mapRef = useRef<MapView>(null);
  const [region, setRegion]           = useState<Region | null>(null);
  const [pinCoords, setPinCoords]     = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress]         = useState('');
  const [locLoading, setLocLoading]   = useState(true);
  const [addrLoading, setAddrLoading] = useState(false);

  // ── Get current location ──────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow location access to use map picker.');
        setLocLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const r: Region = {
        latitude:       loc.coords.latitude,
        longitude:      loc.coords.longitude,
        latitudeDelta:  0.01,
        longitudeDelta: 0.01,
      };
      setRegion(r);
      setPinCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      await reverseGeocode(loc.coords.latitude, loc.coords.longitude);
      setLocLoading(false);
    })();
  }, []);

  // ── Reverse geocode using Google API ─────────────────────
  async function reverseGeocode(lat: number, lng: number) {
    setAddrLoading(true);
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}`
      );
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        setAddress(data.results[0].formatted_address);
      } else {
        setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    } finally {
      setAddrLoading(false);
    }
  }

  // ── Map drag complete → update pin + address ──────────────
  function onRegionChangeComplete(r: Region) {
    setPinCoords({ lat: r.latitude, lng: r.longitude });
    reverseGeocode(r.latitude, r.longitude);
  }

  // ── Go to my location ─────────────────────────────────────
  async function goToMyLocation() {
    try {
      const loc = await Location.getCurrentPositionAsync({});
      const r: Region = {
        latitude:       loc.coords.latitude,
        longitude:      loc.coords.longitude,
        latitudeDelta:  0.01,
        longitudeDelta: 0.01,
      };
      mapRef.current?.animateToRegion(r, 600);
      setPinCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      reverseGeocode(loc.coords.latitude, loc.coords.longitude);
    } catch {
      Alert.alert('Error', 'Could not get your location.');
    }
  }

  // ── Confirm → pass data back via router params ────────────
  function confirmLocation() {
    if (!pinCoords) return;
    // Go back and pass selected location as params
    router.back();
    // Small delay so back animation completes
    setTimeout(() => {
      router.setParams({
        pickedLat:     String(pinCoords.lat),
        pickedLng:     String(pinCoords.lng),
        pickedAddress: address,
      });
    }, 100);
  }

  if (locLoading || !region) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color={GREEN} />
        <Text style={s.loaderText}>Getting your location…</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>

      {/* ── Full screen map ── */}
      

<MapView
  ref={mapRef}
  style={StyleSheet.absoluteFill}
  initialRegion={region}
  onRegionChangeComplete={onRegionChangeComplete}
  showsUserLocation
  showsMyLocationButton={false}
/>
      {/* ── Fixed centre pin ── */}
      <View style={s.pinWrap} pointerEvents="none">
        <PinIcon />
        <View style={s.pinShadow} />
      </View>

      {/* ── Top bar ── */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}>
          <BackIcon />
        </TouchableOpacity>
        <View style={s.topTitleWrap}>
          <Text style={s.topTitle}>Pick Location</Text>
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* ── My location FAB ── */}
      <TouchableOpacity style={s.myLocBtn} onPress={goToMyLocation}>
        <CrosshairIcon />
      </TouchableOpacity>

      {/* ── Bottom sheet ── */}
      <View style={s.sheet}>
        <View style={s.handle} />

        <Text style={s.sheetLabel}>SELECTED LOCATION</Text>

        {/* Address box */}
        <View style={s.addrBox}>
          {addrLoading ? (
            <ActivityIndicator color={GREEN} size="small" />
          ) : (
            <Text style={s.addrText} numberOfLines={2}>
              {address || 'Drag map to select location'}
            </Text>
          )}
        </View>

        {/* Lat / Lng chips */}
        {pinCoords && (
          <View style={s.chips}>
            <View style={s.chip}>
              <Text style={s.chipLabel}>LAT</Text>
              <Text style={s.chipValue}>{pinCoords.lat.toFixed(6)}°</Text>
            </View>
            <View style={s.chip}>
              <Text style={s.chipLabel}>LNG</Text>
              <Text style={s.chipValue}>{pinCoords.lng.toFixed(6)}°</Text>
            </View>
          </View>
        )}

        {/* Confirm button */}
        <TouchableOpacity
          style={[s.confirmBtn, (!pinCoords || addrLoading) && s.confirmBtnOff]}
          disabled={!pinCoords || addrLoading}
          onPress={confirmLocation}
          activeOpacity={0.85}
        >
          <Text style={s.confirmText}>✓  Confirm Location</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_DEEP },

  loader: {
    flex: 1, backgroundColor: BG_DEEP,
    justifyContent: 'center', alignItems: 'center', gap: 14,
  },
  loaderText: { color: TEXT_M, fontSize: 14 },

  // Centre pin
  pinWrap: {
    position: 'absolute',
    top: '50%', left: '50%',
    marginLeft: -18,
    marginTop: -46,
    alignItems: 'center',
    zIndex: 10,
  },
  pinShadow: {
    width: 12, height: 5, borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
    marginTop: 1,
  },

  // Top bar
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingTop: Platform.OS === 'ios' ? 58 : 42,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(4,26,20,0.8)',
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(13,31,24,0.95)',
    borderWidth: 1, borderColor: BORDER,
    justifyContent: 'center', alignItems: 'center',
  },
  topTitleWrap: {
    backgroundColor: 'rgba(13,31,24,0.9)',
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: BORDER,
  },
  topTitle: { fontSize: 14, fontWeight: '600', color: TEXT_W },

  // My location FAB
  myLocBtn: {
    position: 'absolute', bottom: 320, right: 16,
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: CARD_BG,
    borderWidth: 1, borderColor: BORDER,
    justifyContent: 'center', alignItems: 'center',
    elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.4,
    shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },

  // Bottom sheet
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, borderColor: BORDER,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 44 : 56,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: 'center', marginBottom: 20,
  },
  sheetLabel: {
    fontSize: 10, fontWeight: '700', color: TEXT_H,
    letterSpacing: 1.5, marginBottom: 10,
  },
  addrBox: {
    backgroundColor: BG_DEEP,
    borderRadius: 12, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14, paddingVertical: 14,
    minHeight: 50, justifyContent: 'center',
    marginBottom: 12,
  },
  addrText: { fontSize: 14, color: TEXT_W, lineHeight: 20 },

  chips: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  chip: {
    flex: 1, backgroundColor: BG_DEEP,
    borderRadius: 10, borderWidth: 1, borderColor: BORDER,
    paddingVertical: 10, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  chipLabel: { fontSize: 10, fontWeight: '700', color: TEXT_H, letterSpacing: 1 },
  chipValue: { fontSize: 13, color: GREEN, fontWeight: '600' },

  confirmBtn: {
    backgroundColor: GREEN_BTN,
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  confirmBtnOff: {
    backgroundColor: 'rgba(58,173,126,0.1)',
    borderWidth: 1, borderColor: BORDER,
  },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#000', letterSpacing: 0.3 },
});

const darkMapStyle = [
  { elementType: 'geometry',           stylers: [{ color: '#0d1f18' }] },
  { elementType: 'labels.text.fill',   stylers: [{ color: '#3aad7e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#041a14' }] },
  { featureType: 'road', elementType: 'geometry',        stylers: [{ color: '#163326' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#041a14' }] },
  { featureType: 'water', elementType: 'geometry',       stylers: [{ color: '#020e09' }] },
  { featureType: 'poi',   elementType: 'geometry',       stylers: [{ color: '#0a1a13' }] },
  { featureType: 'poi',   elementType: 'labels.text.fill', stylers: [{ color: '#3a6650' }] },
];