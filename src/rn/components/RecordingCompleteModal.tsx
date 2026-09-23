import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { RecordingStopResult } from '../types';
import { ScreenRecorderService } from '../services/ScreenRecorderNative';

interface Props {
  visible: boolean;
  result: RecordingStopResult | null;
  onSaveSuccess: (galleryUri: string) => void;
  onCancel: () => void;
}

export const RecordingCompleteModal: React.FC<Props> = ({
  visible,
  result,
  onSaveSuccess,
  onCancel,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!result) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDuration = (millis: number) => {
    const totalSecs = Math.floor(millis / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const res = await ScreenRecorderService.saveToGallery(result.filePath);
      setIsSaving(false);
      if (res.success) {
        Alert.alert(
          'Saved Successfully!',
          'Your screen recording has been saved to your Photos / Gallery app.',
          [
            {
              text: 'OK',
              onPress: () => onSaveSuccess(res.galleryUri),
            },
          ]
        );
      }
    } catch (error: any) {
      setIsSaving(false);
      Alert.alert('Save Failed', error?.message || 'Could not save video to Gallery');
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await ScreenRecorderService.discardRecording(result.filePath);
      setIsDeleting(false);
      onCancel();
    } catch (error) {
      setIsDeleting(false);
      onCancel();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.iconCircle}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>
          <Text style={styles.title}>Recording Finished</Text>
          <Text style={styles.subtitle}>
            Your screen capture is ready. Do you want to save it to your gallery or delete it?
          </Text>

          {/* Details Card */}
          <View style={styles.detailsContainer}>
            <View style={styles.row}>
              <Text style={styles.label}>Duration</Text>
              <Text style={styles.value}>{formatDuration(result.durationMillis)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>File Size</Text>
              <Text style={styles.value}>{formatFileSize(result.fileSize)}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              disabled={isSaving || isDeleting}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Save to Gallery</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)', borderWidth: 1 }]}
              onPress={handleDelete}
              disabled={isSaving || isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator color="#EF4444" size="small" />
              ) : (
                <Text style={[styles.cancelButtonText, { color: '#EF4444' }]}>Delete Recording</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  checkIcon: {
    color: '#10B981',
    fontSize: 24,
    fontWeight: 'bold',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  detailsContainer: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 4,
  },
  label: {
    color: '#94A3B8',
    fontSize: 13,
  },
  value: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
  },
  actionContainer: {
    width: '100%',
    gap: 10,
  },
  saveButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
});
