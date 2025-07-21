import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ImageBackground,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { useFonts } from 'expo-font';
import { LineChart } from 'react-native-chart-kit';
import { FontAwesome5 } from '@expo/vector-icons';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';

// Extend Date interface to include getWeekNumber
declare global {
  interface Date {
    getWeekNumber(): number;
  }
}

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAWs_lSL0Z09pYVQ70lvxEaqQl6YSsE6tY",
  databaseURL: "https://kibbler-24518-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kibbler-24518",
  appId: "1:1093837743559:web:3d4a3a0a1f4e3f5c1a2f1f"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

interface Feeding {
  date?: string;
  timestamp?: string;
  uid?: string;
  pet_name?: string;
}

interface DeviceData {
  feeding_history?: { [key: string]: Feeding };
  history?: { daily?: any };
  device_status?: {
    battery_level?: number;
  };
}

interface AnalyticsData {
  visits_per_pet_per_day: { [date: string]: { [uid: string]: { count: number; name: string } } };
  visits_per_pet_per_week: { [uid: string]: { count: number; name: string } };
  peak_hours: number[];
  last_visit_times: { [uid: string]: { name: string; time: string; timestamp: number } };
  new_tags_this_week: { [uid: string]: { name: string; first_seen: string } };
  most_frequent_visitor: { name: string; count: number } | null;
  most_inactive_pet: { name: string; hours: number } | null;
  visit_rate_change: number;
  unique_pets: { [uid: string]: string };
  feeding_history: { [key: string]: Feeding };
  daily_history: any;
  device_status: { battery_level?: number } | null;
  error?: string;
}

const AnalyticsScreen = () => {
  const [fontsLoaded] = useFonts({
    'Poppins': require('../../assets/fonts/Poppins/Poppins-Light.ttf'),
    'Poppins-SemiBold': require('../../assets/fonts/Poppins/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../../assets/fonts/Poppins/Poppins-Bold.ttf'),
  });

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubtab, setActiveSubtab] = useState('Feeding Patterns');
  const [contentOffsets, setContentOffsets] = useState<{ [key: string]: number }>({});
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const dbRef = ref(database, '/devices/kibbler_001');

    const unsubscribe = onValue(dbRef, (snapshot) => {
      const firebaseData = snapshot.val();
      if (firebaseData) {
        const processedData = processAnalyticsData(firebaseData);
        setData(processedData);
      } else {
        setData({ error: 'Could not load analytics data' } as AnalyticsData);
      }
      setLoading(false);
    }, (error) => {
      console.error('Firebase error:', error);
      setData({ error: 'Could not load analytics data' } as AnalyticsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const processAnalyticsData = (deviceData: DeviceData): AnalyticsData => {
    const feedingHistory = deviceData.feeding_history || {};
    const dailyHistory = deviceData.history?.daily || {};

    // Get all unique pets
    const uniquePets: { [uid: string]: string } = {};
    Object.values(feedingHistory).forEach((feeding: Feeding) => {
      if (feeding.uid) {
        uniquePets[feeding.uid] = feeding.pet_name || 'Unknown';
      }
    });

    // 1. Visits per Pet per Day
    const visitsPerPetPerDay: { [date: string]: { [uid: string]: { count: number; name: string } } } = {};
    const today = new Date().toISOString().split('T')[0];
    Object.values(feedingHistory).forEach((feeding: Feeding) => {
      if (!feeding.date || !feeding.uid) return;

      const date = feeding.date;
      const petId = feeding.uid;

      if (!visitsPerPetPerDay[date]) {
        visitsPerPetPerDay[date] = {};
      }

      if (!visitsPerPetPerDay[date][petId]) {
        visitsPerPetPerDay[date][petId] = {
          count: 0,
          name: feeding.pet_name || 'Unknown'
        };
      }

      visitsPerPetPerDay[date][petId].count++;
    });

    // 2. Visits per Pet per Week
    const visitsPerPetPerWeek: { [uid: string]: { count: number; name: string } } = {};
    const currentWeek = new Date().getWeekNumber();
    Object.values(feedingHistory).forEach((feeding: Feeding) => {
      if (!feeding.timestamp || !feeding.uid) return;

      const timestamp = new Date(feeding.timestamp).getTime() / 1000;
      const weekNumber = new Date(timestamp * 1000).getWeekNumber();
      const petId = feeding.uid;

      if (weekNumber !== currentWeek) return;

      if (!visitsPerPetPerWeek[petId]) {
        visitsPerPetPerWeek[petId] = {
          count: 0,
          name: feeding.pet_name || 'Unknown'
        };
      }

      visitsPerPetPerWeek[petId].count++;
    });

    // 3. Peak Feeding Hours
    const hourlyCounts = Array(24).fill(0);
    Object.values(feedingHistory).forEach((feeding: Feeding) => {
      if (!feeding.timestamp) return;

      const hour = new Date(feeding.timestamp).getUTCHours();
      hourlyCounts[hour]++;
    });
    const peakHours = hourlyCounts.reduce((acc: number[], count, index) => {
      if (count === Math.max(...hourlyCounts)) acc.push(index);
      return acc;
    }, []);

    // 4. Last Visit Time per Pet
    const lastVisitTimes: { [uid: string]: { name: string; time: string; timestamp: number } } = {};
    Object.entries(uniquePets).forEach(([uid, name]) => {
      lastVisitTimes[uid] = { name, time: 'Never', timestamp: 0 };
    });

    Object.values(feedingHistory).forEach((feeding: Feeding) => {
      if (!feeding.uid || !feeding.timestamp) return;

      const uid = feeding.uid;
      const timestamp = new Date(feeding.timestamp).getTime() / 1000;
      if (timestamp > lastVisitTimes[uid].timestamp) {
        lastVisitTimes[uid].time = new Date(timestamp * 1000).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        lastVisitTimes[uid].timestamp = timestamp;
      }
    });

    // 5. New RFID Tags Detected (This Week)
    const newTagsThisWeek: { [uid: string]: { name: string; first_seen: string } } = {};
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekStartTimestamp = weekStart.getTime() / 1000;
    const allTimeTags: { [uid: string]: boolean } = {};

    Object.values(feedingHistory).forEach((feeding: Feeding) => {
      if (!feeding.timestamp || !feeding.uid) return;

      const timestamp = new Date(feeding.timestamp).getTime() / 1000;
      if (timestamp < weekStartTimestamp) {
        allTimeTags[feeding.uid] = true;
      }
    });

    Object.values(feedingHistory).forEach((feeding: Feeding) => {
      if (!feeding.timestamp || !feeding.uid) return;

      const timestamp = new Date(feeding.timestamp).getTime() / 1000;
      if (timestamp >= weekStartTimestamp && !allTimeTags[feeding.uid]) {
        if (!newTagsThisWeek[feeding.uid]) {
          newTagsThisWeek[feeding.uid] = {
            name: feeding.pet_name || 'Unknown',
            first_seen: new Date(timestamp * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric' })
          };
        }
      }
    });

    // 6. Most Frequent Visitor
    const visitCounts = Object.entries(uniquePets).map(([uid, name]) => ({
      name,
      count: 0,
      uid
    }));

    Object.values(feedingHistory).forEach((feeding: Feeding) => {
      if (!feeding.uid) return;
      const visitor = visitCounts.find(v => v.uid === feeding.uid);
      if (visitor) visitor.count++;
    });

    const mostFrequentVisitor = visitCounts.sort((a, b) => b.count - a.count)[0] || null;

    // 7. Most Inactive Pet
    const currentTime = Date.now() / 1000;
    const inactivePets = Object.entries(lastVisitTimes).map(([uid, data]) => ({
      name: data.name,
      hours: Math.round((currentTime - data.timestamp) / 3600)
    }));

    const mostInactivePet = inactivePets.sort((a, b) => b.hours - a.hours)[0] || null;

    // 8. Visit Rate Change
    let currentWeekCount = 0;
    let lastWeekCount = 0;
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    Object.values(feedingHistory).forEach((feeding: Feeding) => {
      if (!feeding.timestamp) return;

      const timestamp = new Date(feeding.timestamp).getTime() / 1000;
      if (timestamp >= weekStartTimestamp) {
        currentWeekCount++;
      } else if (timestamp >= lastWeekStart.getTime() / 1000 && timestamp < weekStartTimestamp) {
        lastWeekCount++;
      }
    });

    const visitRateChange = lastWeekCount > 0 ? Math.round((currentWeekCount - lastWeekCount) / lastWeekCount * 100) : 0;

    return {
      visits_per_pet_per_day: visitsPerPetPerDay,
      visits_per_pet_per_week: visitsPerPetPerWeek,
      peak_hours: peakHours,
      last_visit_times: lastVisitTimes,
      new_tags_this_week: newTagsThisWeek,
      most_frequent_visitor: mostFrequentVisitor,
      most_inactive_pet: mostInactivePet,
      visit_rate_change: visitRateChange,
      unique_pets: uniquePets,
      feeding_history: feedingHistory,
      daily_history: dailyHistory,
      device_status: deviceData.device_status || null
    };
  };

  // Define getWeekNumber method
  Date.prototype.getWeekNumber = function (): number {
    const d = new Date(Date.UTC(this.getFullYear(), this.getMonth(), this.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  };

  const getBatteryIcon = (level?: number) => {
    if (!level) return 'battery-empty';
    if (level >= 80) return 'battery-full';
    if (level >= 60) return 'battery-three-quarters';
    if (level >= 40) return 'battery-half';
    if (level >= 20) return 'battery-quarter';
    return 'battery-empty';
  };

  const ranges = {
    '12AM - 6AM': [0, 6],
    '6AM - 12PM': [6, 12],
    '12PM - 6PM': [12, 18],
    '6PM - 12AM': [18, 24]
  };

  const rangeCounts: { [key: string]: number } = Object.keys(ranges).reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
  let totalFeedings = 0;

  Object.values(data?.feeding_history || {}).forEach((feeding: Feeding) => {
    if (!feeding.timestamp) return;
    try {
      const hour = new Date(feeding.timestamp).getUTCHours();
      totalFeedings++;
      for (const [label, hours] of Object.entries(ranges)) {
        if (hour >= hours[0] && hour < hours[1]) {
          rangeCounts[label]++;
          break;
        }
      }
    } catch (e) {
      console.error('Error processing feeding time:', e);
    }
  });

  const hourlyData = Array(24).fill(0);
  Object.values(data?.feeding_history || {}).forEach((feeding: Feeding) => {
    if (feeding.timestamp) {
      const hour = new Date(feeding.timestamp).getUTCHours();
      hourlyData[hour]++;
    }
  });

  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - i);
    return date.toISOString().split('T')[0];
  }).reverse();

  const handleTabPress = (tabName: string) => {
    setActiveSubtab(tabName);

    if (contentOffsets[tabName] !== undefined) {
      scrollViewRef.current?.scrollTo({
        y: contentOffsets[tabName],
        animated: true
      });
    }
  };

  const handleLayout = (tabName: string) => (event: any) => {
    const { y } = event.nativeEvent.layout;
    setContentOffsets(prev => ({
      ...prev,
      [tabName]: y - 100
    }));
  };

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#dd2c00" />
      </View>
    );
  }

  if (data?.error) {
    return (
      <View style={styles.errorContainer}>
        <FontAwesome5 name="exclamation-triangle" size={24} color="#ff6b6b" />
        <Text style={styles.errorText}>{data.error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ImageBackground
        source={require('../../assets/main.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <View style={styles.contentContainer}>
          <View style={styles.headerContent}>
            <View style={styles.logoSection}>
              <View style={styles.dashboardTitleRow}>
                <Text style={styles.headerText}>Analytics</Text>
                <View style={styles.taglineBox}>
                  <FontAwesome5 name="paw" size={12} color="#fff" style={styles.pawHeader} />
                  <Text style={styles.taglineText}> Detailed feeding insights and patterns</Text>
                </View>
                <View style={styles.headerData}>
                  <View style={[styles.statusBadge, styles.connected]}>
                    <View style={[styles.statusDot, styles.connectedDot]} />
                    <Text style={styles.statusText}>Online</Text>
                  </View>
                  <View style={styles.batteryIndicator}>
                    <FontAwesome5 name={getBatteryIcon(data?.device_status?.battery_level)} size={16} color="#fff" style={styles.batteryIcon} />
                    <Text style={styles.batteryText}>{data?.device_status?.battery_level ?? '--'}%</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.subtabsOuterContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.subtabsScrollContainer}
              style={styles.subtabsScrollView}
            >
              <TouchableOpacity
                style={[styles.subtab, activeSubtab === 'Feeding Patterns' && styles.activeSubtab]}
                onPress={() => handleTabPress('Feeding Patterns')}
              >
                <Text style={styles.subtabText}>Feeding Patterns</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.subtab, activeSubtab === 'Historical Data' && styles.activeSubtab]}
                onPress={() => handleTabPress('Historical Data')}
              >
                <Text style={styles.subtabText}>Historical Data</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.subtab, activeSubtab === 'Overview' && styles.activeSubtab]}
                onPress={() => handleTabPress('Overview')}
              >
                <Text style={styles.subtabText}>Overview</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.subtab, activeSubtab === 'Pet Insights' && styles.activeSubtab]}
                onPress={() => handleTabPress('Pet Insights')}
              >
                <Text style={styles.subtabText}>Pet Insights</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          <View style={styles.headerLine} />

          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollContainer}
            onScroll={(event) => {
              const scrollY = event.nativeEvent.contentOffset.y;
              const offsets = Object.entries(contentOffsets);

              for (let i = offsets.length - 1; i >= 0; i--) {
                const [tabName, offset] = offsets[i];
                if (scrollY >= offset - 50) {
                  setActiveSubtab(tabName);
                  break;
                }
              }
            }}
            scrollEventThrottle={16}
            bounces={false}
            overScrollMode="never"
            contentContainerStyle={{ paddingBottom: 80 }}
          >
            {/* Feeding Patterns Section */}
            <View onLayout={handleLayout('Feeding Patterns')}>

              <View style={styles.panel}>
                <View style={styles.panelHeader}>
                  <Text style={styles.panelTitle}>
                    <FontAwesome5 name="clock" size={16} color="#fff" /> Peak Feeding Hours
                  </Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={true}
                  style={styles.chartScrollContainer}
                >
                  <View style={styles.chartContainer}>
                    <LineChart
                      data={{
                        labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
                        datasets: [{ data: hourlyData }]
                      }}
                      width={Dimensions.get('window').width * 3}
                      height={220}
                      chartConfig={{
                        backgroundGradientFromOpacity: 0,
                        backgroundGradientToOpacity: 0,
                        decimalPlaces: 0,
                        color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                        labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                        style: {
                          borderRadius: 16,
                        },
                        propsForDots: {
                          r: "6",
                          strokeWidth: "2",
                          stroke: "#ffffff"
                        }
                      }}
                      bezier
                      style={{
                        marginVertical: 8,
                        borderRadius: 16,
                        paddingRight: 20 // Add some padding on the right
                      }}
                    />
                  </View>
                </ScrollView>

                {/* 2x2 Grid Layout */}
                <View style={styles.timeRangesGrid}>
                  {/* First Row */}
                  <View style={styles.timeRangeRow}>
                    <View style={styles.timeRangeItem}>
                      <Text style={styles.timeRangeLabel}>12AM - 6AM</Text>
                      <Text style={styles.timeRangeValue}>
                        {rangeCounts['12AM - 6AM']} ({totalFeedings > 0 ? Math.round((rangeCounts['12AM - 6AM'] / totalFeedings) * 100) : 0}%)
                      </Text>
                    </View>

                    <View style={styles.timeRangeItem}>
                      <Text style={styles.timeRangeLabel}>6AM - 12PM</Text>
                      <Text style={styles.timeRangeValue}>
                        {rangeCounts['6AM - 12PM']} ({totalFeedings > 0 ? Math.round((rangeCounts['6AM - 12PM'] / totalFeedings) * 100) : 0}%)
                      </Text>
                    </View>
                  </View>

                  {/* Second Row */}
                  <View style={styles.timeRangeRow}>
                    <View style={styles.timeRangeItem}>
                      <Text style={styles.timeRangeLabel}>12PM - 6PM</Text>
                      <Text style={styles.timeRangeValue}>
                        {rangeCounts['12PM - 6PM']} ({totalFeedings > 0 ? Math.round((rangeCounts['12PM - 6PM'] / totalFeedings) * 100) : 0}%)
                      </Text>
                    </View>

                    <View style={styles.timeRangeItem}>
                      <Text style={styles.timeRangeLabel}>6PM - 12AM</Text>
                      <Text style={styles.timeRangeValue}>
                        {rangeCounts['6PM - 12AM']} ({totalFeedings > 0 ? Math.round((rangeCounts['6PM - 12AM'] / totalFeedings) * 100) : 0}%)
                      </Text>
                    </View>
                  </View>
                </View>



                <Text style={styles.peakHoursFooter}>
                  <Text style={styles.bold}>Peak hours: </Text>
                  {data?.peak_hours.map(h => new Date(0, 0, 0, h).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })).join(', ')}
                </Text>
              </View>
            </View>

            {/* Historical Data Section */}
            <View onLayout={handleLayout('Historical Data')}>
              <View style={styles.panel}>
                <View style={styles.panelHeader}>
                  <Text style={styles.panelTitle}>
                    <FontAwesome5 name="calendar-week" size={16} color="#fff" /> Visits This Week
                  </Text>
                </View>
                <Text style={styles.panelSubtitle}>Daily feeding counts for each pet</Text>
                <ScrollView
                  style={styles.scrollableActivities}
                  nestedScrollEnabled={true}
                  horizontal={true}
                >
                  <View>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableHeaderCell, styles.stickyHeader]}>Pet</Text>
                      {dates.map(date => (
                        <Text key={date} style={[styles.tableHeaderCell, styles.stickyHeader]}>
                          {new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}
                        </Text>
                      ))}
                      <Text style={[styles.tableHeaderCell, styles.stickyHeader]}>Total</Text>
                    </View>
                    {Object.entries(data?.unique_pets || {}).map(([uid, name]) => {
                      let total = 0;
                      return (
                        <View key={uid} style={styles.tableRow}>
                          <Text style={styles.tableCell}>{name}</Text>
                          {dates.map(date => {
                            const count = data?.visits_per_pet_per_day[date]?.[uid]?.count || 0;
                            total += count;
                            return (
                              <Text
                                key={date}
                                style={[styles.tableCell, count > 0 ? styles.highlightCell : null]}
                              >
                                {count}
                              </Text>
                            );
                          })}
                          <Text style={[styles.tableCell, styles.bold]}>{total}</Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            </View>

            {/* Overview Section */}
            <View onLayout={handleLayout('Overview')}>
              <View style={styles.panel}>
                <View style={styles.panelHeader}>
                  <Text style={styles.panelTitle}>
                    <FontAwesome5 name="chart-bar" size={16} color="#fff" /> Overview
                  </Text>
                </View>
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <View style={styles.statHeader}>
                      <FontAwesome5 name="calendar" style={[styles.statIcon, styles.green]} />
                      <FontAwesome5
                        name="chart-line"
                        style={[styles.statTrend, data?.visit_rate_change && data.visit_rate_change >= 0 ? styles.green : styles.red]}
                      />
                    </View>
                    <View style={styles.statContent}>
                      <Text style={styles.statLabel}>Visit Rate Change</Text>
                      <Text style={styles.statValue}>{data?.visit_rate_change ? Math.abs(data.visit_rate_change) : 0}%</Text>
                      <Text style={[styles.statChange, data?.visit_rate_change && data.visit_rate_change >= 0 ? styles.positive : styles.negative]}>
                        {data?.visit_rate_change && data.visit_rate_change >= 0 ? 'Up' : 'Down'} from last week
                      </Text>
                    </View>
                  </View>

                  <View style={styles.statCard}>
                    <View style={styles.statHeader}>
                      <FontAwesome5 name="dog" style={[styles.statIcon, styles.blue]} />
                      <FontAwesome5 name="crown" style={[styles.statTrend, styles.yellow]} />
                    </View>
                    <View style={styles.statContent}>
                      <Text style={styles.statLabel}>Most Frequent Visitor</Text>
                      <Text style={styles.statValue}>{data?.most_frequent_visitor?.name || '--'}</Text>
                      <Text style={styles.statChange}>{data?.most_frequent_visitor?.count || 0} visits</Text>
                    </View>
                  </View>

                  <View style={styles.statCard}>
                    <View style={styles.statHeader}>
                      <FontAwesome5 name="clock" style={[styles.statIcon, styles.purple]} />
                      <FontAwesome5 name="bed" style={[styles.statTrend, styles.red]} />
                    </View>
                    <View style={styles.statContent}>
                      <Text style={styles.statLabel}>Most Inactive Pet</Text>
                      <Text style={styles.statValue}>{data?.most_inactive_pet?.name || '--'}</Text>
                      <Text style={[styles.statChange, styles.negative]}>{data?.most_inactive_pet?.hours || 0}h inactive</Text>
                    </View>
                  </View>

                  <View style={styles.statCard}>
                    <View style={styles.statHeader}>
                      <FontAwesome5 name="tag" style={[styles.statIcon, styles.yellow]} />
                      <FontAwesome5 name="plus" style={[styles.statTrend, styles.green]} />
                    </View>
                    <View style={styles.statContent}>
                      <Text style={styles.statLabel}>New Tags This Week</Text>
                      <Text style={styles.statValue}>{Object.keys(data?.new_tags_this_week || {}).length}</Text>
                      <Text style={[styles.statChange, styles.positive]}>New pets detected</Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>

            {/* Pet Insights Section */}
            <View onLayout={handleLayout('Pet Insights')}>
              <View style={styles.panel}>
                <View style={styles.panelHeader}>
                  <Text style={styles.panelTitle}>
                    <FontAwesome5 name="paw" size={16} color="#fff" /> Pet Insights
                  </Text>
                </View>
                <Text style={styles.panelSubtitle}>Most recent feeding time for each pet</Text>
                <ScrollView
                  style={styles.scrollableActivities}
                  nestedScrollEnabled={true}
                >
                  {Object.values(data?.last_visit_times || {}).map((pet, index) => (
                    <View key={index} style={styles.activityItem}>
                      <View style={[styles.activityIcon, styles.feedingIcon]}>
                        <FontAwesome5 name="paw" size={16} color="#fff" />
                      </View>
                      <View style={styles.activityContent}>
                        <Text style={styles.activityMessage}>{pet.name}</Text>
                        <Text style={styles.activityTime}>{pet.time}</Text>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          </ScrollView>
        </View>
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
  contentContainer: {
    flex: 1,
    backgroundColor: 'rgba(18, 18, 18, 0.7)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(18, 18, 18, 0.7)',
  },
  errorText: {
    color: '#ff6b6b',
    fontFamily: 'Poppins',
    fontSize: 16,
    marginTop: 10,
  },
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: StatusBar.currentHeight || 50,
    height: 210
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dashboardTitleRow: {
    flexDirection: 'column',
    marginTop: 20
  },
  headerText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 25,
  },
  taglineBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  pawHeader: {
    marginRight: 5,
  },
  taglineText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins-Light',
    fontSize: 14,
  },
  headerData: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 10,
    backgroundColor: 'rgba(195, 195, 195, 0.2)',
  },
  connected: {
    backgroundColor: 'rgba(195, 195, 195, 0.2)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 50,
    marginRight: 5,
  },
  connectedDot: {
    backgroundColor: '#00C853',
  },
  statusText: {
    color: '#fff',
    fontFamily: 'Poppins',
    fontSize: 12,
  },
  batteryIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 75,
    height: 30,
    backgroundColor: 'rgba(195, 195, 195, 0.2)',
    borderRadius: 50
  },
  batteryIcon: {
    marginRight: 5,
  },
  batteryText: {
    color: '#fff',
    fontFamily: 'Poppins',
    fontSize: 12,
  },
  subtabsOuterContainer: {
    height: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
  },
  subtabsScrollContainer: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  subtabsScrollView: {
    height: 50,
  },
  subtab: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    justifyContent: 'center',
    height: 40,
    marginHorizontal: 2,
  },
  activeSubtab: {
    borderBottomWidth: 2,
    borderBottomColor: '#ff9100',
  },
  subtabText: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
  },
  headerLine: {
    height: 1,
    backgroundColor: 'rgba(77, 82, 89, 0.7)',
    width: '100%',
    marginBottom: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  statCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statIcon: {
    fontSize: 16,
  },
  statTrend: {
    fontSize: 16,
  },
  green: {
    color: '#4CAF50',
  },
  yellow: {
    color: '#FFC107',
  },
  blue: {
    color: '#2196F3',
  },
  purple: {
    color: '#9C27B0',
  },
  red: {
    color: '#FF4747',
  },
  statContent: {},
  statLabel: {
    color: '#FFFFFF',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
    marginBottom: 5,
  },
  statValue: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 24,
    marginBottom: 5,
  },
  statChange: {
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
  },
  positive: {
    color: '#4CAF50',
  },
  negative: {
    color: '#FF4747',
  },
  panel: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 15,
    marginHorizontal: 15,
    marginBottom: 20,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  panelTitle: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
  },
  panelSubtitle: {
    color: '#a0a0a0',
    fontFamily: 'Poppins',
    fontSize: 12,
    marginBottom: 15,
  },
  controlMetrics: {
    marginBottom: 15,
  },
  controlMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d2d',
  },
  controlIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  controlInfo: {
    flex: 1,
  },
  controlLabel: {
    color: '#a0a0a0',
    fontFamily: 'Poppins',
    fontSize: 12,
  },
  controlValue: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
  },
  chartContainer: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingRight: 20,
  },
  chartScrollContainer: {
    width: '100%',
    marginBottom: 10,
  },
  peakHoursFooter: {
    color: '#a0a0a0',
    fontFamily: 'Poppins',
    fontSize: 12,
    marginTop: 10,
  },
  bold: {
    fontFamily: 'Poppins-SemiBold',
  },
  scrollableActivities: {
    maxHeight: 300,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d2d',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  feedingIcon: {
    backgroundColor: '#dd2c00',
  },
  activityContent: {
    flex: 1,
  },
  activityMessage: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    marginBottom: 3,
  },
  activityTime: {
    color: '#a0a0a0',
    fontFamily: 'Poppins',
    fontSize: 12,
  },
  scrollContainer: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 10,
  },
  tableHeaderCell: {
    flex: 1,
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
    textAlign: 'center',
    minWidth: 60,
    paddingHorizontal: 5,
  },
  stickyHeader: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tableCell: {
    flex: 1,
    color: '#e8e8e8',
    fontFamily: 'Poppins',
    fontSize: 12,
    textAlign: 'center',
    minWidth: 60,
    paddingHorizontal: 5,
  },
  highlightCell: {
    backgroundColor: 'rgba(221, 44, 0, 0.2)',
  },
  timeRangesGrid: {
    marginBottom: 15,
  },
  timeRangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  timeRangeItem: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
  },
  timeRangeLabel: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    marginBottom: 4,
  },
  timeRangeValue: {
    color: '#fff',
    fontFamily: 'Poppins',
    fontSize: 16,
  },
});

export default AnalyticsScreen;