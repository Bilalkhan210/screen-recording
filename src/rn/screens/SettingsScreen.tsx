import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  StyleSheet,
  Platform,
} from 'react-native';
import { RecordingSettings } from '../types';

interface Props {
  onBack: () => void;
  isDarkMode: boolean;
  settings: RecordingSettings;
  onSettingsChange: (settings: RecordingSettings) => void;
}

export const SettingsScreen: React.FC<Props> = ({ onBack, isDarkMode, settings, onSettingsChange }) => {
  const updateSettings = (change: Partial<RecordingSettings>) => {
    onSettingsChange({ ...settings, ...change });
  };
  const [showNotificationControls, setShowNotificationControls] = useState(true);
  const theme = isDarkMode
    ? { screen: '#0B0F19', topBar: '#0F172A', card: '#0F172A', surface: '#1E293B', border: '#1E293B', text: '#F8FAFC', muted: '#94A3B8', subtle: '#64748B' }
    : { screen: '#FFFFFF', topBar: '#F8FAFC', card: '#F8FAFC', surface: '#F1F5F9', border: '#E2E8F0', text: '#0F172A', muted: '#475569', subtle: '#64748B' };

  return (
    <View style={[styles.screen, { backgroundColor: theme.screen }]}>
      <View style={[styles.topBar, { backgroundColor: theme.topBar, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Video Quality Section */}
        <Text style={[styles.sectionHeader, { color: theme.subtle }]}>VIDEO CONFIGURATION</Text>

        <View style={[styles.groupCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.groupLabel, { color: theme.text }]}>Resolution</Text>
          <View style={styles.optionsRow}>
            {(['1080p', '720p', '480p'] as const).map((res) => (
              <TouchableOpacity
                key={res}
                style={[styles.optionBtn, { backgroundColor: theme.surface, borderColor: theme.border }, settings.resolution === res && styles.optionBtnActive]}
                onPress={() => updateSettings({ resolution: res })}
              >
                <Text
                  style={[
                    styles.optionBtnText, { color: theme.muted },
                    settings.resolution === res && styles.optionBtnTextActive,
                  ]}
                >
                  {res}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.groupCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.groupLabel, { color: theme.text }]}>Frame Rate</Text>
          <View style={styles.optionsRow}>
            {([60, 30] as const).map((rate) => (
              <TouchableOpacity
                key={rate}
                style={[styles.optionBtn, { backgroundColor: theme.surface, borderColor: theme.border }, settings.fps === rate && styles.optionBtnActive]}
                onPress={() => updateSettings({ fps: rate })}
              >
                <Text
                  style={[
                    styles.optionBtnText, { color: theme.muted },
                    settings.fps === rate && styles.optionBtnTextActive,
                  ]}
                >
                  {rate} FPS
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.groupCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.groupLabel, { color: theme.text }]}>Bitrate</Text>
          <View style={styles.optionsRow}>
            {(['12Mbps', '8Mbps', '4Mbps'] as const).map((b) => (
              <TouchableOpacity
                key={b}
                style={[styles.optionBtn, { backgroundColor: theme.surface, borderColor: theme.border }, settings.bitrate === b && styles.optionBtnActive]}
                onPress={() => updateSettings({ bitrate: b })}
              >
                <Text
                  style={[
                    styles.optionBtnText, { color: theme.muted },
                    settings.bitrate === b && styles.optionBtnTextActive,
                  ]}
                >
                  {b}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Audio Section */}
        <Text style={[styles.sectionHeader, { color: theme.subtle }]}>AUDIO & CONTROLS</Text>
        <View style={[styles.groupCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchLabel, { color: theme.text }]}>Record Audio</Text>
              <Text style={[styles.switchSub, { color: theme.subtle }]}>
                Capture microphone and system audio via MediaRecorder
              </Text>
            </View>
            <Switch
              value={settings.recordAudio}
              onValueChange={(recordAudio) => updateSettings({ recordAudio })}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor={settings.recordAudio ? '#FFFFFF' : '#94A3B8'}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.switchLabel, { color: theme.text }]}>Foreground Notification</Text>
              <Text style={[styles.switchSub, { color: theme.subtle }]}>
                Show ongoing notification with timer and quick stop button
              </Text>
            </View>
            <Switch
              value={showNotificationControls}
              onValueChange={setShowNotificationControls}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor={showNotificationControls ? '#FFFFFF' : '#94A3B8'}
            />
          </View>
        </View>

        {/* Start Delay */}
        <Text style={[styles.sectionHeader, { color: theme.subtle }]}>CAPTURE BEHAVIOR</Text>
        <View style={[styles.groupCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.groupLabel, { color: theme.text }]}>Countdown Before Start</Text>
          <View style={styles.optionsRow}>
            {([{ label: 'Off', value: 0 }, { label: '3s', value: 3 }, { label: '5s', value: 5 }, { label: '10s', value: 10 }] as const).map((c) => (
              <TouchableOpacity
                key={c.value}
                style={[styles.optionBtn, { backgroundColor: theme.surface, borderColor: theme.border }, settings.countdownSeconds === c.value && styles.optionBtnActive]}
                onPress={() => updateSettings({ countdownSeconds: c.value })}
              >
                <Text
                  style={[
                    styles.optionBtnText, { color: theme.muted },
                    settings.countdownSeconds === c.value && styles.optionBtnTextActive,
                  ]}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* System Info */}
        <View style={[styles.infoBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.infoTitle, { color: theme.muted }]}>Native Android Engine</Text>
          <Text style={[styles.infoText, { color: theme.subtle }]}>
            MediaProjection API (Android 14/15 Compliant)
            {'\n'}Output Storage: Android MediaStore Movies/ScreenRecordings
            {'\n'}Codecs: Video H.264 (AVC) / Audio AAC (128 kbps, 44.1 kHz)
          </Text>
        </View>
      </ScrollView>
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
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 12,
  },
  groupCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 16,
    marginBottom: 16,
  },
  groupLabel: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  optionBtnActive: {
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    borderColor: '#3B82F6',
  },
  optionBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  optionBtnTextActive: {
    color: '#60A5FA',
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchLabel: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  switchSub: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
    paddingRight: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 14,
  },
  infoBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginTop: 10,
  },
  infoTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoText: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 18,
  },
});
