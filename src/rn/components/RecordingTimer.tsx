import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  time: string;
  isRecording: boolean;
  isPaused: boolean;
  isDarkMode?: boolean;
}

export const RecordingTimer: React.FC<Props> = ({
  time,
  isRecording,
  isPaused,
  isDarkMode = true,
}) => {
  return (
    <View style={styles.container}>
      <View style={[styles.badgeContainer, { backgroundColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}>
        {isRecording && (
          <View style={[styles.dot, isPaused ? styles.pausedDot : styles.activeDot]} />
        )}
        <Text style={[styles.statusText, { color: isDarkMode ? '#94A3B8' : '#475569' }]}>
          {!isRecording ? 'READY TO RECORD' : isPaused ? 'RECORDING PAUSED' : 'RECORDING LIVE'}
        </Text>
      </View>
      <Text style={[styles.timerText, { color: isDarkMode ? '#F8FAFC' : '#0F172A' }]}>{time || '00:00:00'}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  activeDot: {
    backgroundColor: '#EF4444',
  },
  pausedDot: {
    backgroundColor: '#F59E0B',
  },
  statusText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  timerText: {
    fontSize: 52,
    fontWeight: '800',
    color: '#F8FAFC',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
});
