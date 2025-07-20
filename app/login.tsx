import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ImageBackground,
  ScrollView,
} from 'react-native';
import { useFonts } from 'expo-font';
import Ionicons from '@expo/vector-icons/Ionicons';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set } from 'firebase/database';
import { useRouter } from 'expo-router';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAWs_lSL0Z09pYVQ70lvxEaqQl6YSsE6tY",
  databaseURL: "https://kibbler-24518-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kibbler-24518",
  appId: "1:1093837743559:web:3d4a3a0a1f4e3f5c1a2f1f",
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const LoginScreen = () => {
  const [fontsLoaded] = useFonts({
    Poppins: require('../assets/fonts/Poppins/Poppins-Light.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins/Poppins-Bold.ttf'),
  });

  const [deviceId, setDeviceId] = useState('');
  const [passcode, setPasscode] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [inputErrors, setInputErrors] = useState({ deviceId: false, passcode: false });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();

  useEffect(() => {
    // Check if already logged in
    const userRef = ref(database, 'users/current_user');
    get(userRef)
      .then((snapshot) => {
        const userData = snapshot.val();
        console.log('Initial check - userData:', userData);
        if (userData?.isLoggedIn) {
          console.log('User is already logged in, redirecting to /(tabs)');
          router.replace('/(tabs)');
        }
        setLoading(false);
      })
      .catch((error: unknown) => {
        console.error('Error checking login state:', error);
        setToast({ message: 'Connection error. Please try again.', type: 'error' });
        setLoading(false);
      });
  }, [router]);

  useEffect(() => {
    // Auto-dismiss toast after 3 seconds
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleLogin = () => {
    // Reset errors
    setInputErrors({ deviceId: false, passcode: false });

    // Validate inputs (only check for non-empty)
    if (!deviceId || !passcode) {
      setInputErrors({ deviceId: !deviceId, passcode: !passcode });
      setToast({ message: 'Please fill in all fields', type: 'error' });
      return;
    }

    setIsLoggingIn(true);
    const userRef = ref(database, 'users/current_user');
    get(userRef)
      .then((snapshot) => {
        const userData = snapshot.val();
        console.log('Login attempt - userData:', userData);
        console.log('Entered deviceId:', deviceId, 'Entered passcode:', passcode);
        if (userData && userData.device_id == deviceId && userData.passcode === passcode) {
          console.log('Credentials match, updating isLoggedIn');
          // Update login state
          set(ref(database, 'users/current_user/isLoggedIn'), true)
            .then(() => {
              console.log('isLoggedIn set to true, redirecting to /(tabs)');
              setToast({ message: 'Login successful! Redirecting...', type: 'success' });
              setDeviceId('');
              setPasscode('');
              setTimeout(() => router.replace('/(tabs)'), 1500);
            })
            .catch((error: unknown) => {
              console.error('Error updating isLoggedIn:', error);
              setToast({ message: 'Failed to update login state. Please try again.', type: 'error' });
              setIsLoggingIn(false);
            });
        } else {
          console.log('Credentials do not match');
          setInputErrors({ deviceId: true, passcode: true });
          setToast({ message: 'Invalid Device ID or Passcode', type: 'error' });
          setIsLoggingIn(false);
        }
      })
      .catch((error: unknown) => {
        console.error('Firebase error:', error);
        setToast({ message: 'Connection error. Please try again.', type: 'error' });
        setIsLoggingIn(false);
      });
  };

  const handleForgotPasscode = () => {
    console.log('Navigating to settings#contact');
    router.push('/(tabs)/settings#contact');
  };

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#dd2c00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../assets/BG.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.contentContainer}
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              <Ionicons name="log-in" size={18} color="#fff" /> Kibbler
            </Text>
            <ImageBackground
              source={require('../assets/Paw-Logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.section}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Device ID</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="hardware-chip" size={16} color="#fff" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, inputErrors.deviceId && styles.inputError]}
                  value={deviceId}
                  onChangeText={setDeviceId}
                  placeholder="8-digit ID here"
                  placeholderTextColor="#a0a0a0"
                  keyboardType="default"
                  accessibilityLabel="Device ID input"
                />
              </View>
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Passcode</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={16} color="#fff" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, inputErrors.passcode && styles.inputError]}
                  value={passcode}
                  onChangeText={setPasscode}
                  secureTextEntry
                  placeholder="Device passcode"
                  placeholderTextColor="#a0a0a0"
                  accessibilityLabel="Passcode input"
                />
              </View>
            </View>
            <TouchableOpacity
              style={[styles.loginButton, isLoggingIn && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoggingIn}
              accessibilityLabel="Login button"
            >
              <Ionicons
                name={isLoggingIn ? 'hourglass-outline' : 'log-in'}
                size={16}
                color="#fff"
                style={isLoggingIn ? styles.spinner : null}
              />
              <Text style={styles.buttonText}>{isLoggingIn ? 'Logging in...' : 'Login'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.forgotLink}
              onPress={handleForgotPasscode}
              accessibilityLabel="Forgot passcode"
            >
              <Text style={styles.forgotText}>Forgot Passcode? Email Us</Text>
            </TouchableOpacity>
            <View style={styles.noDeviceContainer}>
              <Text style={styles.noDeviceText}>Don't have a device yet?</Text>
              <TouchableOpacity accessibilityLabel="Get Kibbler device">
                <Text style={styles.getDeviceText}>Get your Kibbler device</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {toast && (
          <View
            style={[
              styles.toastContainer,
              toast.type === 'success' ? styles.toastSuccess : styles.toastError,
            ]}
          >
            <Ionicons
              name={toast.type === 'success' ? 'checkmark-circle' : 'alert-circle'}
              size={16}
              color="#fff"
            />
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        )}
      </ImageBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    backgroundColor: 'rgba(18, 18, 18, 0.7)',
    paddingTop: StatusBar.currentHeight || 50,
    paddingBottom: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(77, 82, 89, 0.7)',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ff9100',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 24,
  },
  logo: {
    width: 60,
    height: 60,
    marginTop: 10,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  formGroup: {
    marginBottom: 15,
  },
  label: {
    color: '#fff',
    fontFamily: 'Poppins',
    fontSize: 14,
    marginBottom: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontFamily: 'Poppins',
    fontSize: 14,
    paddingVertical: 10,
  },
  inputError: {
    borderColor: '#ff4747',
    borderWidth: 1,
    borderRadius: 8,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dd2c00',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    justifyContent: 'center',
    width: '25%',
    alignSelf: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    marginLeft: 10,
  },
  spinner: {
    transform: [{ rotate: '360deg' }],
  },
  forgotLink: {
    alignSelf: 'center',
    marginVertical: 15,
  },
  forgotText: {
    color: '#ff9100',
    fontFamily: 'Poppins',
    fontSize: 13,
    textDecorationLine: 'none',
  },
  noDeviceContainer: {
    alignItems: 'center',
    marginTop: 25,
  },
  noDeviceText: {
    color: '#aaa',
    fontFamily: 'Poppins',
    fontSize: 13,
    marginBottom: 10,
  },
  getDeviceText: {
    color: '#ff9100',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 13,
    textDecorationLine: 'none',
  },
  toastContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
  },
  toastSuccess: {
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
  },
  toastError: {
    backgroundColor: 'rgba(255, 71, 71, 0.9)',
  },
  toastText: {
    color: '#fff',
    fontFamily: 'Poppins',
    fontSize: 14,
    marginLeft: 10,
  },
});

export default LoginScreen;