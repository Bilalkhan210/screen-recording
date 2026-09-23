import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { RecordedItem } from '../types';

interface Props {
  onBack: () => void;
}

export const RecordingsScreen: React.FC<Props> = ({ onBack }) => {
  const [recordings, setRecordings] = useState<RecordedItem[]>([
    {
      id: 'rec-sample-1',
      filePath: '/storage/emulated/0/Movies/ScreenRecordings/ScreenRecording_20260914_001200.mp4',
      fileName: 'ScreenRecording_20260914_001200.mp4',
      date: 'Today, 12:00 AM',
      durationFormatted: '00:01:45',
      durationMillis: 105000,
      fileSizeBytes: 18450000,
      resolution: '1080 × 1920 (60 FPS)',
      savedToGallery: true,
    },
    {
      id: 'rec-sample-2',
      filePath: '/storage/emulated/0/Movies/ScreenRecordings/ScreenRecording_20260913_184520.mp4',
      fileName: 'ScreenRecording_20260913_184520.mp4',
      date: 'Yesterday, 06:45 PM',
      durationFormatted: '00:03:12',
      durationMillis: 192000,
      fileSizeBytes: 34200000,
      resolution: '1080 × 1920 (60 FPS)',
      savedToGallery: true,
    },
  ]);

  const handleDelete = (id: string, fileName: string) => {
    Alert.alert(
      'Delete Recording',
      `Are you sure you want to remove ${fileName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setRecordings(prev => prev.filter(r => r.id !== id));
          },
        },
      ]
    );
  };

  const handleShare = (fileName: string) => {
    Alert.alert('Share Video', `Opening Android share sheet for ${fileName}`);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Saved Recordings</Text>
        <View style={{ width: 60 }} />
      </View>

      {recordings.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🎬</Text>
          <Text style={styles.emptyTitle}>No Recordings Yet</Text>
          <Text style={styles.emptySubtitle}>
            Recorded videos will appear here and in your Android Gallery.
          </Text>
        </View>
      ) : (
        <FlatList
          data={recordings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.videoBadge}>
                  <Text style={styles.videoBadgeText}>MP4</Text>
                </View>
                <View style={styles.titleColumn}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {item.fileName}
                  </Text>
                  <Text style={styles.dateText}>{item.date}</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Duration</Text>
                  <Text style={styles.metaValue}>{item.durationFormatted}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Size</Text>
                  <Text style={styles.metaValue}>
                    {(item.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Resolution</Text>
                  <Text style={styles.metaValue}>{item.resolution}</Text>
                </View>
              </View>

              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.actionBtnSecondary}
                  onPress={() => handleShare(item.fileName)}
                >
                  <Text style={styles.actionBtnText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtnDanger}
                  onPress={() => handleDelete(item.id, item.fileName)}
                >
                  <Text style={styles.actionDangerText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 24 : 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: '#3B82F6',
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },
  list: {
    padding: 16,
    gap: 14,
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  videoBadge: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 10,
  },
  videoBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  titleColumn: {
    flex: 1,
  },
  fileName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  dateText: {
    color: '#64748B',
    fontSize: 12,
  },
  metaRow: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 10,
    justifyContent: 'space-around',
    marginBottom: 14,
  },
  metaItem: {
    alignItems: 'center',
  },
  metaLabel: {
    color: '#94A3B8',
    fontSize: 10,
    marginBottom: 2,
  },
  metaValue: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtnSecondary: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  actionBtnDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  actionDangerText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
  },
});
