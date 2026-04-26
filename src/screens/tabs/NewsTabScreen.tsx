import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons, sp } from './tabConstants';

export function NewsTabScreen() {
  return (
    <View style={styles.placeholder}>
      <MaterialIcons name="article" size={48} color="#cbd5e1" />
      <Text style={styles.placeholderText}>Tin tức tuyển sinh</Text>
      <Text style={styles.placeholderSub}>Sắp ra mắt</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    paddingVertical: sp.xxxl,
  },
  placeholderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#64748b',
    marginTop: sp.md,
  },
  placeholderSub: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: sp.xs,
  },
});
