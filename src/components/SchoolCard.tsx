import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
const Ionicons = require('@expo/vector-icons').Ionicons;

const radius = { xl: 20 } as const;

type SchoolCardProps = {
  name: string;
  address: string;
  imageUrl: string;
  onPress: () => void;
};

export function SchoolCard({ name, address, imageUrl, onPress }: SchoolCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.imageWrap}>
        <Image source={{ uri: imageUrl }} style={styles.image} />
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {name}
        </Text>
        <View style={styles.location}>
          <Ionicons name="location-outline" size={14} color="#64748b" />
          <Text style={styles.address} numberOfLines={1}>
            {address}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.95,
  },
  imageWrap: {
    height: 140,
    backgroundColor: '#e2e8f0',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  body: {
    padding: 20,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
    lineHeight: 22,
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  address: {
    fontSize: 14,
    color: '#64748b',
    flex: 1,
  },
});
