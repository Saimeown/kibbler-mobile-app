import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  FlatList,
  ImageBackground,
  ActivityIndicator,
} from 'react-native';
import { useFonts } from 'expo-font';
import { FontAwesome5 } from '@expo/vector-icons';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update } from 'firebase/database';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Define the navigation stack param list
type RootStackParamList = {
  Pets: undefined;
  Notifications: undefined;
};

// Define the navigation prop type
type NotificationsScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Notifications'>;

// Define props interface
interface NotificationsScreenProps {
  navigation: NotificationsScreenNavigationProp;
}

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAWs_lSL0Z09pYVQ70lvxEaqQl6YSsE6tY",
  databaseURL: "https://kibbler-24518-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kibbler-24518",
  appId: "1:1093837743559:web:3d4a3a0a1f4e3f5c1a2f1f",
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

interface Notification {
  id: string;
  type: 'alert' | 'activity' | 'reminder';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  icon: string;
  pet_name?: string;
}

const NotificationsScreen = ({ navigation }: NotificationsScreenProps) => {
  const [fontsLoaded] = useFonts({
    Poppins: require('../../assets/fonts/Poppins/Poppins-Light.ttf'),
    'Poppins-SemiBold': require('../../assets/fonts/Poppins/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../../assets/fonts/Poppins/Poppins-Bold.ttf'),
  });

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'alert' | 'activity' | 'reminder'>('all');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    // Initialize notifications structure if it doesn't exist
    const notificationsRef = ref(database, '/devices/kibbler_001/notifications');
    onValue(notificationsRef, (snapshot) => {
      if (!snapshot.exists()) {
        set(notificationsRef, { read_status: {} });
      }
    }, { onlyOnce: true });

    // Set up real-time listener
    const dbRef = ref(database, '/devices/kibbler_001');
    const unsubscribe = onValue(dbRef, (snapshot) => {
      const deviceData = snapshot.val();
      processDeviceNotifications(deviceData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching notifications:', error);
      setToast({ message: 'Failed to load notifications', type: 'error' });
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Auto-dismiss toast after 3 seconds
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const processDeviceNotifications = (deviceData: any) => {
    const newNotifications: Notification[] = [];
    const readStatus = deviceData.notifications?.read_status || {};
    const now = new Date().toISOString();

    // Process alerts
    const status = deviceData.device_status || {};

    // Low Battery Alert
    if ((status.battery_level ?? 100) < 30) {
      const timestamp = deviceData.battery_last_updated || now;
      const id = `battery_${timestamp}`;
      newNotifications.push({
        id,
        type: 'alert',
        title: 'Low Battery',
        message: `Battery at ${status.battery_level}% - charge soon`,
        timestamp,
        read: readStatus[id] || false,
        icon: 'battery-quarter',
      });
    }

    // Low Container Alert
    if ((status.container_level ?? 100) < 20) {
      const timestamp = status.last_seen || now;
      const id = `container_${timestamp}`;
      newNotifications.push({
        id,
        type: 'alert',
        title: 'Low Container',
        message: `Food container at ${status.container_level}% - refill soon`,
        timestamp,
        read: readStatus[id] || false,
        icon: 'box',
      });
    }

    // Stale Food Alert
    if (deviceData.stale_food_alert === 'Active') {
      const timestamp = deviceData.last_empty_time || now;
      const id = `stale_${timestamp}`;
      newNotifications.push({
        id,
        type: 'alert',
        title: 'Stale Food',
        message: 'Food in tray over 24 hours - clean soon',
        timestamp,
        read: readStatus[id] || false,
        icon: 'exclamation-triangle',
      });
    }

    // Process activities
    const activities = deviceData.recent_activities || {};
    Object.entries(activities).forEach(([timestamp, activity]: [string, any]) => {
      const activityTimestamp = activity.timestamp || timestamp;
      const id = `activity_${activityTimestamp}`;
      newNotifications.push({
        id,
        type: 'activity',
        title: activity.pet_name ? `${activity.pet_name}'s Activity` : 'Feeding Activity',
        message: activity.message || 'Activity recorded',
        timestamp: activityTimestamp,
        pet_name: activity.pet_name || undefined,
        read: readStatus[id] || false,
        icon: 'paw',
      });
    });

    // Sort by timestamp (newest first)
    newNotifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setNotifications(newNotifications);
  };

  const formatNotificationTime = (timestamp: string) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const markNotificationRead = (id: string) => {
    const dbRef = ref(database, `/devices/kibbler_001/notifications/read_status/${id}`);
    set(dbRef, true).then(() => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setToast({ message: 'Notification marked as read', type: 'success' });
    }).catch((error) => {
      console.error('Error marking notification as read:', error);
      setToast({ message: 'Failed to mark notification as read', type: 'error' });
    });
  };

  const markAllNotificationsRead = () => {
    const dbRef = ref(database, '/devices/kibbler_001/notifications/read_status');
    const updates: { [key: string]: boolean } = {};
    notifications.forEach((notification) => {
      if (!notification.read) {
        updates[notification.id] = true;
      }
    });
    update(dbRef, updates).then(() => {
      setNotifications((prev) =>
        prev.map((n) => (updates[n.id] ? { ...n, read: true } : n))
      );
      setToast({ message: 'All notifications marked as read', type: 'success' });
    }).catch((error) => {
      console.error('Error marking all notifications as read:', error);
      setToast({ message: 'Failed to mark all notifications as read', type: 'error' });
    });
  };

  const filteredNotifications = notifications.filter((notification) =>
    activeFilter === 'all' ? true : notification.type === activeFilter
  );

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
        source={require('../../assets/BG.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <View style={styles.contentContainer}>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>
                <FontAwesome5 name="bell" size={18} color="#fff" /> Notifications
              </Text>
              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={styles.markAllButton}
                  onPress={markAllNotificationsRead}
                  accessibilityLabel="Mark all notifications as read"
                >
                  <FontAwesome5 name="check-double" size={14} color="#fff" />
                  <Text style={styles.markAllText}>Mark all read</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.filterContainer}>
            {(['all', 'alert', 'activity', 'reminder'] as const).map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[styles.filterButton, activeFilter === filter && styles.activeFilterButton]}
                onPress={() => setActiveFilter(filter)}
                accessibilityLabel={`Filter by ${filter}`}
              >
                <Text style={styles.filterButtonText}>
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FlatList
            data={filteredNotifications}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.notificationItem, item.read && styles.readNotification]}
                onPress={() => markNotificationRead(item.id)}
                accessibilityLabel={`${item.title}, ${item.read ? 'read' : 'unread'}`}
              >
                <View style={styles.notificationIcon}>
                  <FontAwesome5 name={item.icon} size={20} color="#fff" />
                </View>
                <View style={styles.notificationContent}>
                  <View style={styles.notificationHeader}>
                    <Text style={styles.notificationTitle}>{item.title}</Text>
                    <Text style={styles.notificationTime}>
                      {formatNotificationTime(item.timestamp)}
                    </Text>
                  </View>
                  <View style={styles.notificationMessageContainer}>
                    <Text style={styles.notificationMessage}>{item.message}</Text>
                    {item.pet_name && (
                      <View style={styles.petBadge}>
                        <Text style={styles.petBadgeText}>{item.pet_name}</Text>
                      </View>
                    )}
                  </View>
                </View>
                {item.read && (
                  <View style={styles.readIndicator}>
                    <FontAwesome5 name="check" size={14} color="#4CAF50" />
                  </View>
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <FontAwesome5 name="bell-slash" size={40} color="#a0a0a0" />
                <Text style={styles.emptyStateTitle}>
                  {activeFilter === 'all' ? 'No notifications yet' : `No ${activeFilter} notifications`}
                </Text>
                <Text style={styles.emptyStateText}>
                  {activeFilter === 'all'
                    ? "You'll see important alerts here when they occur."
                    : `No ${activeFilter} alerts to display at this time.`}
                </Text>
              </View>
            }
            contentContainerStyle={styles.notificationsContainer}
            bounces={false} // Disable iOS bounce effect
            overScrollMode="never" // Disable Android overscroll effect
            showsVerticalScrollIndicator={false} // Hide scrollbar
          />
        </View>
      </ImageBackground>

      {toast && (
        <View style={[styles.toastContainer, toast.type === 'success' ? styles.toastSuccess : styles.toastError]}>
          <FontAwesome5
            name={toast.type === 'success' ? 'check-circle' : 'exclamation-circle'}
            size={16}
            color="#fff"
          />
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}
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
  contentContainer: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 18, 0.7)',
    paddingTop: StatusBar.currentHeight || 50,
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
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 10,
  },
  markAllText: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
    marginLeft: 5,
  },
  closeButton: {
    padding: 10,
  },
  closeButtonText: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 20,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  filterButton: {
    paddingHorizontal: 26,
    paddingVertical: 8,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeFilterButton: {
    backgroundColor: '#6a47c2ff',
  },
  filterButtonText: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
  },
  notificationsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
  },
  readNotification: {
    opacity: 0.7,
  },
  notificationIcon: {
    marginRight: 10,
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  notificationTitle: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
  },
  notificationTime: {
    color: '#a0a0a0',
    fontFamily: 'Poppins',
    fontSize: 12,
  },
  notificationMessageContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  notificationMessage: {
    color: '#e8e8e8',
    fontFamily: 'Poppins',
    fontSize: 12,
  },
  petBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  petBadgeText: {
    color: '#fff',
    fontFamily: 'Poppins',
    fontSize: 12,
  },
  readIndicator: {
    justifyContent: 'center',
    marginLeft: 10,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    marginTop: 10,
  },
  emptyStateText: {
    color: '#a0a0a0',
    fontFamily: 'Poppins',
    fontSize: 14,
    marginTop: 5,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 720,
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

export default NotificationsScreen;