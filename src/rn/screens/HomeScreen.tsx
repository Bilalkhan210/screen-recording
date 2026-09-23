import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  BackHandler,
  ScrollView,
  Platform,
  StatusBar,
} from 'react-native';
import { RecordingTimer } from '../components/RecordingTimer';
import { RecordingCompleteModal } from '../components/RecordingCompleteModal';
import { RecordingOptionsModal } from '../components/RecordingOptionsModal';
import { ScreenRecorderService } from '../services/ScreenRecorderNative';
import { requestScreenRecordingPermissions } from '../utils/permissions';
import { RecordingStopResult } from '../types';

interface Props {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onNavigateToSettings?: () => void;
}

export const HomeScreen: React.FC<Props> = ({
  isDarkMode,
  onToggleTheme,
  onNavigateToSettings,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timerText, setTimerText] = useState('00:00:00');
  const [elapsedMillis, setElapsedMillis] = useState(0);

  // Settings
  const [recordAudio, setRecordAudio] = useState(true);
  const [quality, setQuality] = useState<'1080p' | '720p'>('1080p');
  const [fps, setFps] = useState<60 | 30>(60);

  // Modal
  const [recordingResult, setRecordingResult] = useState<RecordingStopResult | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Listen to native module events
  useEffect(() => {
    const timerSub = ScreenRecorderService.addTimerListener((data) => {
      setTimerText(data.formattedTime);
      setElapsedMillis(data.elapsedMillis);
    });

    const stateSub = ScreenRecorderService.addStateListener((data) => {
      setIsRecording(data.isRecording);
      setIsPaused(data.isPaused);
      if (!data.isRecording) {
        setTimerText('00:00:00');
      }
    });

    const stopSub = ScreenRecorderService.addStopListener((data) => {
      setIsRecording(false);
      setIsPaused(false);
      setRecordingResult(data);
      setModalVisible(true);
    });

    const overlayStopSub = ScreenRecorderService.addOverlayStopListener(() => {
      handleStopRecording();
    });

    ScreenRecorderService.consumeOverlayStopRequest().then((requested) => {
      if (requested) handleStopRecording();
    }).catch(() => {});

    // Check initial recording state on mount
    ScreenRecorderService.isRecording().then((recording) => {
      setIsRecording(recording);
    }).catch(() => {});

    return () => {
      timerSub.remove();
      stateSub.remove();
      stopSub.remove();
      overlayStopSub.remove();
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, []);

  // Safe Android Back Button Handling: confirm if user tries to exit while recording
  useEffect(() => {
    const onBackPress = () => {
      if (isRecording) {
        Alert.alert(
          'Recording in Progress',
          'A screen recording is currently running. You can leave the app and it will continue in the background.',
          [
            {
              text: 'Keep Recording',
              style: 'cancel',
              onPress: () => BackHandler.exitApp(),
            },
            {
              text: 'Stop Recording',
              style: 'destructive',
              onPress: () => {
                handleStopRecording();
              },
            },
          ]
        );
        return true; // prevent immediate hard exit
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandler.remove();
  }, [isRecording]);

  const handleStartRecording = () => {
    setOptionsModalVisible(true);
  };

  const executeStartRecording = async (withAudio: boolean, withCamera: boolean) => {
    try {
      setIsStarting(true);

      // 1. Request Android runtime permissions (Notification + Audio + Camera)
      const perms = await requestScreenRecordingPermissions(withAudio, withCamera);

      if (withCamera) {
        const hasOverlayPerm = await ScreenRecorderService.checkOverlayPermission();
        if (!hasOverlayPerm) {
          Alert.alert(
            'Floating Bubble Permission',
            'To show the camera bubble over other apps, you need to allow "Display over other apps" in Android settings.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => setIsStarting(false) },
              { text: 'Enable Now', onPress: () => {
                setIsStarting(false);
                ScreenRecorderService.requestOverlayPermission();
              }}
            ]
          );
          return;
        }
      }

      // 2. Start recording with options (triggers Android MediaProjection dialog)
      const options = {
        width: quality === '1080p' ? 1080 : 720,
        height: quality === '1080p' ? 1920 : 1280,
        fps,
        bitrate: quality === '1080p' ? 8000000 : 4500000,
        recordAudio: withAudio,
        showCamera: withCamera,
      };

      await ScreenRecorderService.startRecording(options);

      setCountdown(3);
      await new Promise<void>((resolve) => {
        countdownTimerRef.current = setInterval(() => {
          setCountdown((current) => {
            if (current === null || current <= 1) {
              if (countdownTimerRef.current) {
                clearInterval(countdownTimerRef.current);
                countdownTimerRef.current = null;
              }
              resolve();
              return null;
            }
            return current - 1;
          });
        }, 1000);
      });

      await ScreenRecorderService.beginRecording();
      setIsRecording(true);
      setIsPaused(false);

      setIsStarting(false);
    } catch (error: any) {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      setCountdown(null);
      setIsStarting(false);
      if (error?.code !== 'ERR_PERMISSION_DENIED') {
        Alert.alert('Recording Error', error?.message || 'Failed to start screen recording');
      }
    }
  };

  const handleStopRecording = async () => {
    try {
      const result = await ScreenRecorderService.stopRecording();
      setIsRecording(false);
      setIsPaused(false);
      setRecordingResult(result);
      setModalVisible(true);
    } catch (error: any) {
      Alert.alert('Error Stopping', error?.message || 'Could not stop recording');
    }
  };

  const handleTogglePause = async () => {
    if (isPaused) {
      await ScreenRecorderService.resumeRecording();
      setIsPaused(false);
    } else {
      await ScreenRecorderService.pauseRecording();
      setIsPaused(true);
    }
  };

  const theme = isDarkMode
    ? {
        screen: '#0B0F19',
        topBar: '#0F172A',
        border: '#1E293B',
        card: '#0F172A',
        surface: '#1E293B',
        text: '#F8FAFC',
        muted: '#94A3B8',
        subtle: '#64748B',
        icon: '#CBD5E1',
      }
    : {
        screen: '#FFFFFF',
        topBar: '#F8FAFC',
        border: '#E2E8F0',
        card: '#F8FAFC',
        surface: '#F1F5F9',
        text: '#0F172A',
        muted: '#475569',
        subtle: '#64748B',
        icon: '#334155',
      };

  return (
    <View style={[styles.screen, { backgroundColor: theme.screen }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={theme.screen}
      />
      {/* Top App Bar */}
      <View style={[styles.topBar, { backgroundColor: theme.topBar, borderBottomColor: theme.border }]}>
        <View style={styles.brandRow}>
          <View style={styles.brandIcon}>
            <View style={styles.brandDot} />
          </View>
            <Text style={[styles.brandTitle, { color: theme.text }]}>Screen Recorder</Text>
        </View>
        <View style={styles.topBarActions}>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: theme.surface }]}
            onPress={onToggleTheme}
            accessibilityLabel={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <Text style={[styles.iconButtonText, { color: theme.icon }]}>{isDarkMode ? '☀' : '☾'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: theme.surface }]}
            onPress={onNavigateToSettings}
            accessibilityLabel="Settings"
          >
            <Text style={[styles.iconButtonText, { color: theme.icon }]}>⚙</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Main Recording Timer Display */}
        <View style={[styles.timerCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <RecordingTimer
            time={timerText}
            isRecording={isRecording}
            isPaused={isPaused}
            isDarkMode={isDarkMode}
          />

          {isRecording && (
            <Text style={[styles.backgroundHint, { color: theme.subtle }]}>
              Recording runs in foreground service. You can leave the app anytime.
            </Text>
          )}
        </View>

        {/* Quick Settings Bar */}
        {!isRecording && (
          <View style={[styles.settingsPillsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionHeading, { color: theme.subtle }]}>RECORDING CONFIGURATION</Text>

            <View style={styles.pillsRow}>
              {/* Quality Pill */}
              <TouchableOpacity
                style={[styles.pill, { backgroundColor: theme.surface, borderColor: theme.border }, quality === '1080p' && styles.pillActive]}
                onPress={() => setQuality(q => q === '1080p' ? '720p' : '1080p')}
              >
                <Text style={[styles.pillLabel, { color: theme.muted }]}>Resolution</Text>
                <Text style={[styles.pillValue, { color: theme.text }]}>{quality}</Text>
              </TouchableOpacity>

              {/* FPS Pill */}
              <TouchableOpacity
                style={[styles.pill, { backgroundColor: theme.surface, borderColor: theme.border }, fps === 60 && styles.pillActive]}
                onPress={() => setFps(f => f === 60 ? 30 : 60)}
              >
                <Text style={[styles.pillLabel, { color: theme.muted }]}>Frame Rate</Text>
                <Text style={[styles.pillValue, { color: theme.text }]}>{fps} FPS</Text>
              </TouchableOpacity>

              {/* Audio Toggle Pill */}
              <TouchableOpacity
                style={[styles.pill, { backgroundColor: theme.surface, borderColor: theme.border }, recordAudio && styles.pillActive]}
                onPress={() => setRecordAudio(a => !a)}
              >
                <Text style={[styles.pillLabel, { color: theme.muted }]}>Audio</Text>
                <Text style={[styles.pillValue, { color: theme.text }]}>{recordAudio ? 'Mic On' : 'Muted'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Primary Controls */}
        <View style={styles.controlsSection}>
          {!isRecording ? (
            <TouchableOpacity
              style={styles.mainRecordButton}
              onPress={handleStartRecording}
              disabled={isStarting}
              activeOpacity={0.8}
            >
              <View style={styles.recordCircleOuter}>
                <View style={styles.recordCircleInner} />
              </View>
              <Text style={styles.mainRecordButtonText}>
                {isStarting ? 'Preparing Capture…' : 'Start Recording'}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.activeControlsRow}>
              <TouchableOpacity
                style={[styles.pauseButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={handleTogglePause}
                activeOpacity={0.8}
              >
                <Text style={styles.controlIconText}>{isPaused ? '▶' : '⏸'}</Text>
                <Text style={[styles.pauseButtonText, { color: theme.text }]}>
                  {isPaused ? 'Resume' : 'Pause'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.stopButton}
                onPress={handleStopRecording}
                activeOpacity={0.8}
              >
                <View style={styles.stopIconSquare} />
                <Text style={styles.stopButtonText}>Stop Recording</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Info / Permissions Guide */}
        <View style={[styles.guideCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.guideTitle, { color: theme.muted }]}>Android MediaProjection</Text>
          <Text style={[styles.guideText, { color: theme.subtle }]}>
            • Requires Android 14/15 MediaProjection Foreground Service permission.
            {'\n'}• Records high-fidelity MP4 video directly to device storage.
            {'\n'}• Save to MediaStore places the video directly in Google Photos / Gallery.
          </Text>
        </View>
      </ScrollView>

      {countdown !== null && (
        <Modal
          visible
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => {}}
        >
          <View style={styles.countdownOverlay} pointerEvents="none">
          <View style={styles.countdownCard}>
            <Text style={styles.countdownLabel}>GET READY</Text>
            <Text style={styles.countdownText}>{countdown}</Text>
          </View>
          </View>
        </Modal>
      )}

      {/* Recording Complete Modal Dialog */}
      <RecordingCompleteModal
        visible={modalVisible}
        result={recordingResult}
        onSaveSuccess={() => {
          setModalVisible(false);
          setRecordingResult(null);
        }}
        onCancel={() => {
          setModalVisible(false);
          setRecordingResult(null);
        }}
      />

      <RecordingOptionsModal
        visible={optionsModalVisible}
        onSelect={executeStartRecording}
        onCancel={() => setOptionsModalVisible(false)}
      />

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
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 24 : 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  brandDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
  },
  brandTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  topBarActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonText: {
    fontSize: 16,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  timerCard: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 20,
    marginBottom: 20,
  },
  backgroundHint: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  settingsPillsCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 16,
    marginBottom: 24,
  },
  sectionHeading: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  pill: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  pillActive: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  pillLabel: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 2,
  },
  pillValue: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  controlsSection: {
    marginBottom: 24,
  },
  mainRecordButton: {
    backgroundColor: '#EF4444',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  recordCircleOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: '#0F172A',
    alignItems: 'center',
  },
  recordCircleInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
  },
  mainRecordButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  activeControlsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pauseButton: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pauseButtonText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  controlIconText: {
    fontSize: 16,
    color: '#F8FAFC',
  },
  stopButton: {
    flex: 1.4,
    backgroundColor: '#EF4444',
    borderRadius: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stopIconSquare: {
    width: 14,
    height: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },
  stopButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  guideCard: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 16,
  },
  guideTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  guideText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  countdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.42)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
    elevation: 50,
  },
  countdownCard: {
    width: 220,
    height: 240,
    borderRadius: 24,
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 12,
    zIndex: 51,
  },
  countdownLabel: {
    color: '#FCA5A5',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 2,
  },
  countdownText: {
    color: '#EF4444',
    fontSize: 112,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
