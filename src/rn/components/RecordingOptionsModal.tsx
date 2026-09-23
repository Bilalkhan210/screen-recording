import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';

interface Props {
  visible: boolean;
  onSelect: (recordAudio: boolean, showCamera: boolean) => void;
  onCancel: () => void;
}

export const RecordingOptionsModal: React.FC<Props> = ({
  visible,
  onSelect,
  onCancel,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.indicator} />
          <Text style={styles.title}>Start Recording</Text>
          <Text style={styles.subtitle}>Choose how you want to record your screen</Text>

          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => onSelect(false, false)}
            >
              <View style={[styles.iconBox, { backgroundColor: '#475569' }]}>
                <Text style={styles.iconText}>🔇</Text>
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Screen Only</Text>
                <Text style={styles.optionDesc}>No internal audio or microphone</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => onSelect(true, false)}
            >
              <View style={[styles.iconBox, { backgroundColor: '#2563EB' }]}>
                <Text style={styles.iconText}>🎙️</Text>
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Screen + Voice</Text>
                <Text style={styles.optionDesc}>Records with microphone audio</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => onSelect(true, true)}
            >
              <View style={[styles.iconBox, { backgroundColor: '#7C3AED' }]}>
                <Text style={styles.iconText}>🤳</Text>
              </View>
              <View style={styles.optionInfo}>
                <Text style={styles.optionTitle}>Screen + Voice + Camera</Text>
                <Text style={styles.optionDesc}>Adds a face cam overlay bubble</Text>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.8)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'android' ? 32 : 48,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  indicator: {
    width: 40,
    height: 4,
    backgroundColor: '#334155',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 14,
    marginBottom: 24,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconText: {
    fontSize: 24,
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  optionDesc: {
    color: '#64748B',
    fontSize: 12,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
  },
});
