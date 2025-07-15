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
import { FontAwesome5, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';

// Initialize Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAWs_lSL0Z09pYVQ70lvxEaqQl6YSsE6tY",
    databaseURL: "https://kibbler-24518-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "kibbler-24518",
    appId: "1:1093837743559:web:3d4a3a0a1f4e3f5c1a2f1f"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

interface DeviceStatus {
    status: string;
    last_seen: string;
    battery_level: number;
    container_level: number;
    tray_level: number;
    wifi_signal: string | number;
    uptime: number;
    firebase_connected: boolean;
    feeding_interval_hours: number;
    last_empty_time?: string | number;
}

interface Stats {
    today_dispense_count: number;
    week_dispense_count: number;
    today_unique_pets: number;
    total_unique_uids: number;
    last_reset_date: string;
    last_fed_time: string;
    last_fed_pet: string;
}

interface Activity {
    type: string;
    message: string;
    pet_name: string;
    time: string;
    raw_timestamp: string;
    uid: string | null;
}

interface DashboardData {
    device_status: DeviceStatus;
    stats: Stats;
    current_settings: {
        portion_level: number;
        stale_food_alert: string;
    };
    recent_activities: Activity[];
    weekly_chart: number[];
    chart_labels: string[];
    last_empty_time: string;
    time_since_reset: string;
}

const HomeScreen = () => {
    const [fontsLoaded] = useFonts({
        'Poppins': require('../../assets/fonts/Poppins/Poppins-Light.ttf'),
        'Poppins-SemiBold': require('../../assets/fonts/Poppins/Poppins-SemiBold.ttf'),
        'Poppins-Bold': require('../../assets/fonts/Poppins/Poppins-Bold.ttf'),
    });

    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState('7days');
    const [activeTab, setActiveTab] = useState('Stats');
    const scrollViewRef = useRef<ScrollView>(null);
    const dropdownRef = useRef<View>(null);
    const [contentOffsets, setContentOffsets] = useState<{ [key: string]: number }>({});

    useEffect(() => {
        const dbRef = ref(database, '/devices/kibbler_001');

        const unsubscribe = onValue(dbRef, (snapshot) => {
            const firebaseData = snapshot.val();
            if (firebaseData) {
                const processedData = processDeviceData(firebaseData);
                setData(processedData);
            }
            setLoading(false);
        }, (error) => {
            console.error('Firebase error:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [selectedPeriod]);

    const handleTabPress = (tabName: string) => {
        setActiveTab(tabName);

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

    const processDeviceData = (firebaseData: any): DashboardData => {
        const deviceStatus = firebaseData.device_status || {
            status: 'offline',
            last_seen: new Date().toISOString(),
            battery_level: 0,
            container_level: 0,
            tray_level: 0,
            wifi_signal: 'Unknown',
            uptime: 0,
            firebase_connected: false,
            feeding_interval_hours: 2
        };

        let latestFeedingTime: string | null = null;
        if (firebaseData.feeding_history) {
            const feedingHistory = firebaseData.feeding_history;
            let latestTimestamp = 0;

            Object.entries(feedingHistory).forEach(([key, feeding]: [string, any]) => {
                try {
                    let currentTime = 0;
                    let currentFormatted: string | null = null;

                    if (feeding.timestamp) {
                        const dateTime = new Date(feeding.timestamp);
                        if (!isNaN(dateTime.getTime())) {
                            currentTime = dateTime.getTime();
                            currentFormatted = formatTimeForDisplay(feeding.timestamp);
                        }
                    }

                    if (currentTime === 0) {
                        const dateTime = new Date(key);
                        if (!isNaN(dateTime.getTime())) {
                            currentTime = dateTime.getTime();
                            currentFormatted = formatTimeForDisplay(key);
                        }
                    }

                    if (currentTime > latestTimestamp) {
                        latestTimestamp = currentTime;
                        latestFeedingTime = currentFormatted;
                    }
                } catch (e) {
                    console.error('Error processing feeding time:', e);
                }
            });
        }

        let lastEmptyTime = 'Never';
        let timeSinceReset = 'N/A';
        if (firebaseData.last_empty_time) {
            const emptyTime = firebaseData.last_empty_time;

            if (typeof emptyTime === 'number') {
                const seconds = Math.floor(emptyTime / 1000);
                const hours = Math.floor(seconds / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);
                const secs = seconds % 60;
                lastEmptyTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')} (device uptime)`;

                if (deviceStatus.status === 'online' && deviceStatus.uptime) {
                    const uptimeMs = deviceStatus.uptime * 1000;
                    const timeSinceMs = uptimeMs - emptyTime;
                    const timeSinceHours = Math.floor(timeSinceMs / (1000 * 60 * 60));
                    const timeSinceMinutes = Math.floor((timeSinceMs % (1000 * 60 * 60)) / (1000 * 60));
                    timeSinceReset = `${timeSinceHours} hours ${timeSinceMinutes} mins`;
                }
            } else if (typeof emptyTime === 'string') {
                const timestamp = new Date(emptyTime).getTime();
                if (!isNaN(timestamp)) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    if (timestamp >= today.getTime() && timestamp < today.getTime() + 86400000) {
                        lastEmptyTime = 'Today, ' + new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    } else {
                        lastEmptyTime = new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                    }

                    const timeSince = Date.now() - timestamp;
                    const timeSinceHours = Math.floor(timeSince / 3600000);
                    const timeSinceMinutes = Math.floor((timeSince % 3600000) / 60000);
                    timeSinceReset = `${timeSinceHours} hours ${timeSinceMinutes} mins`;
                } else {
                    lastEmptyTime = 'Invalid empty time';
                }
            }
        }

        const stats = {
            today_dispense_count: firebaseData.stats?.today_dispense_count || 0,
            week_dispense_count: getCurrentWeekDispenses(firebaseData),
            today_unique_pets: firebaseData.stats?.today_unique_pets || 0,
            total_unique_uids: firebaseData.stats?.total_unique_uids || 0,
            last_reset_date: firebaseData.stats?.last_reset_date || new Date().toISOString().split('T')[0],
            last_fed_time: latestFeedingTime || (firebaseData.stats?.last_fed_time && !isNaN(new Date(firebaseData.stats.last_fed_time).getTime()) ? firebaseData.stats.last_fed_time : new Date().toISOString()),
            last_fed_pet: firebaseData.stats?.last_fed_pet || 'None'
        };

        const petNameMap: Record<string, string> = {};
        if (firebaseData.feeding_history) {
            Object.values(firebaseData.feeding_history).forEach((feeding: any) => {
                if (feeding.uid && feeding.pet_name) {
                    petNameMap[feeding.uid] = feeding.pet_name;
                }
            });
        }

        const activities: Activity[] = [];
        if (firebaseData.recent_activities) {
            Object.entries(firebaseData.recent_activities).forEach(([timestamp, activity]: [string, any]) => {
                try {
                    if (!activity.timestamp) return;

                    const displayTime = formatTimeForDisplay(activity.timestamp);
                    const displayPetName = activity.pet_name || 'Unknown';

                    activities.push({
                        type: 'feeding',
                        message: activity.message || '',
                        pet_name: displayPetName,
                        time: displayTime,
                        raw_timestamp: activity.timestamp,
                        uid: activity.uid || null
                    });
                } catch (e) {
                    console.error('Error processing activity:', e);
                }
            });
        }

        activities.sort((a, b) => new Date(b.raw_timestamp).getTime() - new Date(a.raw_timestamp).getTime());

        let weeklyChart = [0, 0, 0, 0, 0, 0, 0];
        let chartLabels = ['', '', '', '', '', '', ''];

        if (firebaseData.history?.daily) {
            const dailyData = firebaseData.history.daily;

            if (selectedPeriod === '7days') {
                for (let i = 6; i >= 0; i--) {
                    const date = new Date();
                    date.setDate(date.getDate() - i);
                    const dateString = date.toISOString().split('T')[0];
                    chartLabels[6 - i] = formatChartLabel(date);

                    if (dailyData[dateString]) {
                        weeklyChart[6 - i] = dailyData[dateString].dispense_count ||
                            (dailyData[dateString].feedings ? Object.keys(dailyData[dateString].feedings).length : 0);
                    }
                }
            } else if (selectedPeriod === '4weeks') {
                weeklyChart = [0, 0, 0, 0];
                chartLabels = ['', '', '', ''];
                for (let i = 3; i >= 0; i--) {
                    const date = new Date();
                    date.setDate(date.getDate() - i * 7);
                    const dateString = date.toISOString().split('T')[0];
                    chartLabels[3 - i] = formatChartLabel(date);

                    if (dailyData[dateString]) {
                        weeklyChart[3 - i] = dailyData[dateString].dispense_count ||
                            (dailyData[dateString].feedings ? Object.keys(dailyData[dateString].feedings).length : 0);
                    }
                }
            } else if (selectedPeriod === '6months') {
                weeklyChart = [0, 0, 0, 0, 0, 0];
                chartLabels = ['', '', '', '', '', ''];
                for (let i = 5; i >= 0; i--) {
                    const date = new Date();
                    date.setMonth(date.getMonth() - i);
                    const monthString = date.toISOString().slice(0, 7);
                    chartLabels[5 - i] = formatChartLabel(date);

                    let monthTotal = 0;
                    Object.entries(dailyData).forEach(([dateKey, dayData]: [string, any]) => {
                        if (dateKey.startsWith(monthString)) {
                            monthTotal += dayData.dispense_count || (dayData.feedings ? Object.keys(dayData.feedings).length : 0);
                        }
                    });
                    weeklyChart[5 - i] = monthTotal;
                }
            }
        } else {
            if (selectedPeriod === '7days') {
                for (let i = 6; i >= 0; i--) {
                    const date = new Date();
                    date.setDate(date.getDate() - i);
                    chartLabels[6 - i] = formatChartLabel(date);
                }
            } else if (selectedPeriod === '4weeks') {
                for (let i = 3; i >= 0; i--) {
                    const date = new Date();
                    date.setDate(date.getDate() - i * 7);
                    chartLabels[3 - i] = formatChartLabel(date);
                }
            } else if (selectedPeriod === '6months') {
                for (let i = 5; i >= 0; i--) {
                    const date = new Date();
                    date.setMonth(date.getMonth() - i);
                    chartLabels[5 - i] = formatChartLabel(date);
                }
            }
        }

        return {
            device_status: deviceStatus,
            stats,
            current_settings: {
                portion_level: firebaseData.portion_level || 100,
                stale_food_alert: firebaseData.stale_food_alert || 'Clear'
            },
            recent_activities: activities.length > 0 ? activities : [{
                type: 'feeding',
                message: 'No recent activity',
                pet_name: 'System',
                time: 'No data',
                raw_timestamp: '',
                uid: null
            }],
            weekly_chart: weeklyChart,
            chart_labels: chartLabels,
            last_empty_time: lastEmptyTime,
            time_since_reset: timeSinceReset
        };
    };

    const getCurrentWeekDispenses = (firebaseData: any): number => {
        let total = 0;
        if (!firebaseData.history?.daily) return 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dayOfWeek = today.getDay();
        const daysSinceMonday = (dayOfWeek + 6) % 7;
        const lastMonday = new Date(today);
        lastMonday.setDate(today.getDate() - daysSinceMonday);

        Object.entries(firebaseData.history.daily).forEach(([date, dayData]: [string, any]) => {
            const feedingDate = new Date(date);
            if (feedingDate >= lastMonday) {
                total += dayData.dispense_count || 0;
            }
        });

        return total;
    };

    const formatTimeForDisplay = (timestamp: string | number | undefined | null): string => {
        console.log('formatTimeForDisplay input:', timestamp);

        if (!timestamp) {
            console.warn('Timestamp is null or undefined, returning Never');
            return 'Never';
        }

        let date: Date;
        try {
            if (typeof timestamp === 'number') {
                date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
            } else if (typeof timestamp === 'string') {
                date = new Date(timestamp);
                if (isNaN(date.getTime())) {
                    const match = timestamp.match(/^(\w{3})\s(\d{1,2}),\s(\d{1,2}):(\d{2})\s(AM|PM)$/i);
                    if (match) {
                        const [, monthStr, day, hours, minutes, period] = match;
                        const monthNames: { [key: string]: number } = {
                            jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
                            jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
                        };
                        const monthKey = monthStr.toLowerCase();
                        const month = monthNames[monthKey];
                        if (month === undefined) {
                            console.error('Invalid month in timestamp:', timestamp);
                            return 'Invalid date';
                        }
                        const year = new Date().getFullYear();
                        let hourNum = parseInt(hours, 10);
                        if (period.toUpperCase() === 'PM' && hourNum !== 12) {
                            hourNum += 12;
                        } else if (period.toUpperCase() === 'AM' && hourNum === 12) {
                            hourNum = 0;
                        }
                        date = new Date(year, month, parseInt(day, 10), hourNum, parseInt(minutes, 10));
                    } else {
                        console.error('Invalid date format:', timestamp);
                        return 'Invalid date';
                    }
                }
            } else {
                console.error('Unsupported timestamp type:', typeof timestamp);
                return 'Invalid date';
            }

            if (isNaN(date.getTime())) {
                console.error('Invalid date parsed from timestamp:', timestamp);
                return 'Invalid date';
            }
        } catch (e) {
            console.error('Error parsing timestamp:', timestamp, e);
            return 'Invalid date';
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (date >= today) {
            return `Today, ${timeString}`;
        } else if (date >= yesterday) {
            return `Yesterday, ${timeString}`;
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + timeString;
        }
    };

    const formatChartLabel = (date: Date): string => {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[date.getMonth()]} ${date.getDate()}`;
    };

    const getBatteryIcon = (level: number): string => {
        if (level >= 80) return 'battery-full';
        if (level >= 60) return 'battery-three-quarters';
        if (level >= 40) return 'battery-half';
        if (level >= 20) return 'battery-quarter';
        return 'battery-empty';
    };

    const formatWifiSignal = (rssi: string | number): string => {
        if (typeof rssi === 'number') {
            if (rssi >= -50) return 'Excellent';
            if (rssi >= -60) return 'Strong';
            if (rssi >= -70) return 'Good';
            return 'Weak';
        }
        return 'Unknown';
    };

    const renderStatsCards = () => {
        if (!data) return null;

        return (
            <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                    <View style={styles.statHeader}>
                        <FontAwesome5 name="calendar" style={[styles.statIcon, styles.green]} />
                        <FontAwesome5 name="chart-line" style={[styles.statTrend, styles.green]} />
                    </View>
                    <View style={styles.statContent}>
                        <Text style={styles.statLabel}>Today's Feedings</Text>
                        <Text style={styles.statValue}>{data.stats.today_dispense_count}</Text>
                        <Text style={[styles.statChange, styles.positive]}>Dispenses</Text>
                    </View>
                </View>

                <View style={styles.statCard}>
                    <View style={styles.statHeader}>
                        <FontAwesome5 name="bullseye" style={[styles.statIcon, styles.yellow]} />
                        <FontAwesome5 name="chart-line" style={[styles.statTrend, styles.green]} />
                    </View>
                    <View style={styles.statContent}>
                        <Text style={styles.statLabel}>Weekly Dispense Count</Text>
                        <Text style={styles.statValue}>{data.stats.week_dispense_count}</Text>
                        <Text style={[styles.statChange, styles.neutral]}>This week</Text>
                    </View>
                </View>

                <View style={styles.statCard}>
                    <View style={styles.statHeader}>
                        <FontAwesome5 name="check-circle" style={[styles.statIcon, styles.blue]} />
                        <FontAwesome5 name="chart-line" style={[styles.statTrend, styles.green]} />
                    </View>
                    <View style={styles.statContent}>
                        <Text style={styles.statLabel}>Pets Fed Today</Text>
                        <Text style={styles.statValue}>{data.stats.today_unique_pets}</Text>
                        <Text style={[styles.statChange, styles.positive]}>Unique Tags</Text>
                    </View>
                </View>

                <View style={styles.statCard}>
                    <View style={styles.statHeader}>
                        <FontAwesome5 name="bolt" style={[styles.statIcon, styles.purple]} />
                        <FontAwesome5 name="wave-square" style={[styles.statTrend, styles.purple]} />
                    </View>
                    <View style={styles.statContent}>
                        <Text style={styles.statLabel}>Pets Detected (All Time)</Text>
                        <Text style={styles.statValue}>{data.stats.total_unique_uids}</Text>
                        <Text style={[styles.statChange, styles.improvement]}>Unique Pets</Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderDeviceStatus = () => {
        if (!data) return null;

        const isStale = () => {
            const lastEmptyTime = data.last_empty_time;
            if (lastEmptyTime === 'Never') return false;

            if (typeof data.device_status.last_empty_time === 'number') {
                const emptySeconds = data.device_status.last_empty_time / 1000;
                const currentUptime = data.device_status.uptime || 0;
                return (currentUptime - emptySeconds) / 3600 > 24;
            } else {
                const emptyTime = new Date(lastEmptyTime).getTime();
                return (Date.now() - emptyTime) / 3600000 > 24;
            }
        };

        return (
            <View style={styles.panel}>
                <View style={styles.panelHeader}>
                    <Text style={styles.panelTitle}>Device Status</Text>
                    <View style={[styles.statusBadge, data?.device_status.status === 'online' ? styles.connected : styles.disconnected]}>
                        <View style={[
                            styles.statusDot,
                            data?.device_status.status === 'online' ? styles.connectedDot : styles.disconnectedDot
                        ]} />
                        <Text style={styles.statusText}>
                            {data?.device_status.status
                                ? data.device_status.status.charAt(0).toUpperCase() + data.device_status.status.slice(1)
                                : 'Unknown'}
                        </Text>
                    </View>
                </View>

                <View style={styles.deviceMetrics}>
                    <View style={styles.metric}>
                        <View style={[styles.metricIcon, styles.mode]}>
                            <FontAwesome5 name="paw" size={16} color="#fff" />
                        </View>
                        <View style={styles.metricInfo}>
                            <Text style={styles.metricLabel}>Power Source</Text>
                            <Text style={styles.metricValue}>Solar Battery</Text>
                        </View>
                    </View>

                    <View style={styles.metric}>
                        <View style={[styles.metricIcon, styles.battery]}>
                            <FontAwesome5 name={getBatteryIcon(data.device_status.battery_level)} size={16} color="#fff" />
                        </View>
                        <View style={styles.metricInfo}>
                            <Text style={styles.metricLabel}>Battery</Text>
                            <Text style={styles.metricValue}>{data.device_status.battery_level}%</Text>
                        </View>
                    </View>

                    <View style={styles.metric}>
                        <View style={[styles.metricIcon, styles.wifi]}>
                            <FontAwesome5 name="wifi" size={16} color="#fff" />
                        </View>
                        <View style={styles.metricInfo}>
                            <Text style={styles.metricLabel}>WiFi WiFi Signal</Text>
                            <Text style={styles.metricValue}>
                                {formatWifiSignal(data.device_status.wifi_signal)}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.metric}>
                        <View style={[styles.metricIcon, styles.temp]}>
                            <MaterialCommunityIcons name="box" size={16} color="#fff" />
                        </View>
                        <View style={styles.metricInfo}>
                            <Text style={styles.metricLabel}>Container Level</Text>
                            <Text style={styles.metricValue}>{data.device_status.container_level}%</Text>
                        </View>
                    </View>

                    <View style={styles.metric}>
                        <View style={[styles.metricIcon, styles.food]}>
                            <MaterialCommunityIcons name="food" size={16} color="#fff" />
                        </View>
                        <View style={styles.metricInfo}>
                            <Text style={styles.metricLabel}>Food Level</Text>
                            <Text style={styles.metricValue}>{data.device_status.tray_level}%</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.deviceTimes}>
                    <View style={styles.timeInfo}>
                        <Text style={styles.timeLabel}>Last Fed</Text>
                        <Text style={styles.timeValue}>
                            {formatTimeForDisplay(data.stats.last_fed_time)}
                        </Text>
                    </View>
                    <View style={styles.timeInfo}>
                        <Text style={styles.timeLabel}>Portion Size</Text>
                        <Text style={styles.timeValue}>
                            {data.current_settings.portion_level}%
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    const renderFeedingTrend = () => {
        if (!data) return null;

        const timePeriods = [
            { label: 'Last 7 Days', value: '7days' },
            { label: 'Last 4 Weeks', value: '4weeks' },
            { label: 'Last 6 Months', value: '6months' }
        ];

        const handlePeriodChange = (period: string) => {
            setSelectedPeriod(period);
            setDropdownOpen(false);
            console.log('Selected period:', period);
        };

        return (
            <View style={styles.panel}>
                <View style={styles.panelHeader}>
                    <Text style={styles.panelTitle}>
                        <FontAwesome5 name="chart-bar" size={16} color="#fff" /> Feeding Trend
                    </Text>
                    <View style={styles.dropdownContainer} ref={dropdownRef}>
                        <TouchableOpacity
                            style={styles.dropdownButton}
                            onPress={() => {
                                console.log('Dropdown button pressed');
                                setDropdownOpen(!dropdownOpen);
                            }}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.dropdownButtonText}>
                                {timePeriods.find(p => p.value === selectedPeriod)?.label || 'Select Period'}
                            </Text>
                            <FontAwesome5
                                name={dropdownOpen ? "caret-up" : "caret-down"}
                                size={14}
                                color="#fff"
                            />
                        </TouchableOpacity>

                        {dropdownOpen && (
                            <View style={styles.dropdownMenu}>
                                {timePeriods.map((period) => (
                                    <TouchableOpacity
                                        key={period.value}
                                        style={styles.dropdownMenuItem}
                                        onPress={() => handlePeriodChange(period.value)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.dropdownMenuItemText}>
                                            {period.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                </View>

                <View style={styles.chartContainer}>
                    <LineChart
                        data={{
                            labels: data.chart_labels,
                            datasets: [{
                                data: data.weekly_chart
                            }]
                        }}
                        width={Dimensions.get('window').width - 60}
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
                            zIndex: 0,
                        }}
                    />
                </View>
            </View>
        );
    };

    const renderFreshnessMonitoring = () => {
        if (!data) return null;

        const isStale = () => {
            const lastEmptyTime = data.last_empty_time;
            if (lastEmptyTime === 'Never') return false;

            if (typeof data.device_status.last_empty_time === 'number') {
                const emptySeconds = data.device_status.last_empty_time / 1000;
                const currentUptime = data.device_status.uptime || 0;
                return (currentUptime - emptySeconds) / 3600 > 24;
            } else {
                const emptyTime = new Date(lastEmptyTime).getTime();
                return (Date.now() - emptyTime) / 3600000 > 24;
            }
        };

        return (
            <View style={styles.panel}>
                <View style={styles.panelHeader}>
                    <Text style={styles.panelTitle}>
                        <FontAwesome5 name="leaf" size={16} color="#fff" /> Freshness Monitoring
                    </Text>
                </View>

                <View style={styles.controlMetrics}>
                    <View style={styles.controlMetric}>
                        <View style={styles.controlIcon}>
                            <FontAwesome5 name="clock" size={16} color="#fff" />
                        </View>
                        <View style={styles.controlInfo}>
                            <Text style={styles.controlLabel}>Last Tray Reset</Text>
                            <Text style={styles.controlValue}>{data.last_empty_time}</Text>
                        </View>
                    </View>

                    <View style={styles.controlMetric}>
                        <View style={styles.controlIcon}>
                            <FontAwesome5 name="hourglass-half" size={16} color="#fff" />
                        </View>
                        <View style={styles.controlInfo}>
                            <Text style={styles.controlLabel}>Time Since Reset</Text>
                            <Text style={styles.controlValue}>{data.time_since_reset}</Text>
                        </View>
                    </View>

                    <View style={[styles.controlMetric, isStale() && styles.alertActive]}>
                        <View style={styles.controlIcon}>
                            <FontAwesome5 name={isStale() ? "triangle-exclamation" : "check-circle"} size={16} color="#fff" />
                        </View>
                        <View style={styles.controlInfo}>
                            <Text style={styles.controlLabel}>Food Freshness</Text>
                            <Text style={[styles.controlValue, isStale() && styles.alertText]}>
                                {isStale() ? 'STALE FOOD' : 'Fresh'}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    const renderRecentActivity = () => {
        if (!data) return null;

        return (
            <View style={styles.panel}>
                <View style={styles.panelHeader}>
                    <Text style={styles.panelTitle}>
                        <FontAwesome5 name="clock" size={16} color="#fff" /> Recent Activity
                    </Text>
                </View>

                <ScrollView
                    style={styles.scrollableActivities}
                    nestedScrollEnabled={true}
                >
                    {data.recent_activities.map((item, index) => (
                        <View key={index} style={styles.activityItem}>
                            <View style={[styles.activityIcon, item.type === 'feeding' ? styles.feedingIcon : styles.resetIcon]}>
                                <FontAwesome5 name={item.type === 'feeding' ? "paw" : "clock-rotate-left"} size={16} color="#fff" />
                            </View>
                            <View style={styles.activityContent}>
                                <Text style={styles.activityMessage}>
                                    {item.uid && (
                                        <Text> </Text>
                                    )}
                                    {item.message}
                                </Text>
                                <Text style={styles.activityTime}>{item.time}</Text>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </View>
        );
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
                source={require('../../assets/BG.png')}
                style={styles.background}
                resizeMode="cover"
            >
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
                <View style={styles.contentContainer}>
                    <View style={styles.headerContent}>
                        <View style={styles.logoSection}>
                            <View style={styles.dashboardTitleRow}>
                                <Text style={styles.headerText}>Dashboard</Text>
                                <View style={styles.taglineBox}>
                                    <FontAwesome5 name="paw" size={12} color="#fff" style={styles.pawHeader} />
                                    <Text style={styles.taglineText}> Stay on top of Kibbler activity and insights</Text>
                                </View>
                                <View style={styles.headerData}>
                                    <View style={[styles.statusBadge, data?.device_status.status === 'online' ? styles.connected : styles.disconnected]}>
                                        <View style={[
                                            styles.statusDot,
                                            data?.device_status.status === 'online' ? styles.connectedDot : styles.disconnectedDot
                                        ]} />
                                        <Text style={styles.statusText}>
                                            {data?.device_status.status
                                                ? data.device_status.status.charAt(0).toUpperCase() + data.device_status.status.slice(1)
                                                : 'Unknown'}
                                        </Text>
                                    </View>
                                    <View style={styles.batteryIndicator}>
                                        <FontAwesome5 name={getBatteryIcon(data?.device_status.battery_level || 0)} size={16} color="#fff" style={styles.batteryIcon} />
                                        <Text style={styles.batteryText}>{data?.device_status.battery_level}%</Text>
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
                                style={[styles.subtab, activeTab === 'Stats' && styles.activeSubtab]}
                                onPress={() => handleTabPress('Stats')}
                            >
                                <Text style={styles.subtabText}>Stats</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.subtab, activeTab === 'Device Status' && styles.activeSubtab]}
                                onPress={() => handleTabPress('Device Status')}
                            >
                                <Text style={styles.subtabText}>Device Status</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.subtab, activeTab === 'Feeding Trend' && styles.activeSubtab]}
                                onPress={() => handleTabPress('Feeding Trend')}
                            >
                                <Text style={styles.subtabText}>Feeding Trend</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.subtab, activeTab === 'Freshness Monitoring' && styles.activeSubtab]}
                                onPress={() => handleTabPress('Freshness Monitoring')}
                            >
                                <Text style={styles.subtabText}>Freshness Monitoring</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.subtab, activeTab === 'Recent Activity' && styles.activeSubtab]}
                                onPress={() => handleTabPress('Recent Activity')}
                            >
                                <Text style={styles.subtabText}>Recent Activity</Text>
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
                                    setActiveTab(tabName);
                                    break;
                                }
                            }
                        }}
                        scrollEventThrottle={16}
                        bounces={false}
                        overScrollMode="never"
                        contentContainerStyle={{ paddingBottom: 80 }} // Add padding to avoid content being hidden under tab bar
                    >
                        <View onLayout={handleLayout('Stats')}>
                            {renderStatsCards()}
                        </View>

                        <View onLayout={handleLayout('Device Status')}>
                            {renderDeviceStatus()}
                        </View>

                        <View onLayout={handleLayout('Feeding Trend')}>
                            {renderFeedingTrend()}
                        </View>

                        <View onLayout={handleLayout('Freshness Monitoring')}>
                            {renderFreshnessMonitoring()}
                        </View>

                        <View onLayout={handleLayout('Recent Activity')}>
                            {renderRecentActivity()}
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
        backgroundColor: 'rgba(18, 18, 18, 0.7)', // Semi-transparent overlay for readability
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#121212',
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
    disconnected: {
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
    disconnectedDot: {
        backgroundColor: '#FF4747',
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
        backgroundColor: 'rgba(18, 18, 18, 0.7)', // Match contentContainer for consistency
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
        borderBottomColor: '#6a47c2ff',

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
    neutral: {
        color: '#FFC107',
    },
    improvement: {
        color: '#9C27B0',
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
    deviceMetrics: {
        marginBottom: 15,
    },
    metric: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    metricIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    mode: {
        backgroundColor: '#FF7043',
    },
    battery: {
        backgroundColor: '#4CAF50',
    },
    wifi: {
        backgroundColor: '#2196F3',
    },
    temp: {
        backgroundColor: '#9C27B0',
    },
    food: {
        backgroundColor: '#FF9800',
    },
    metricInfo: {
        flex: 1,
    },
    metricLabel: {
        color: '#e8e8e8ff',
        fontFamily: 'Poppins-Medium',
        fontSize: 12,
    },
    metricValue: {
        color: '#fff',
        fontFamily: 'Poppins-SemiBold',
        fontSize: 14,
    },
    deviceTimes: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: '#2d2d2d',
        paddingTop: 15,
    },
    timeInfo: {},
    timeLabel: {
        color: '#a0a0a0',
        fontFamily: 'Poppins',
        fontSize: 12,
    },
    timeValue: {
        color: '#fff',
        fontFamily: 'Poppins-SemiBold',
        fontSize: 14,
    },
    chartContainer: {
        alignItems: 'center',
        backgroundColor: 'transparent',
        marginRight: 50
    },
    controlMetrics: {
        marginTop: 10,
    },
    controlMetric: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#2d2d2d',
    },
    alertActive: {
        backgroundColor: 'rgba(255, 71, 71, 0.1)',
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
    alertText: {
        color: '#FF4747',
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
    resetIcon: {
        backgroundColor: '#2196F3',
    },
    activityContent: {
        flex: 1,
    },
    activityMessage: {
        color: '#fff',
        fontFamily: 'Poppins',
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
    dropdownContainer: {
        position: 'relative',
        zIndex: 1000,
    },
    dropdownButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 50,
        paddingHorizontal: 10,
        paddingVertical: 8,
        minWidth: 120,
    },
    dropdownButtonText: {
        color: '#fff',
        fontFamily: 'Poppins',
        fontSize: 14,
        marginRight: 8,
    },
    dropdownMenu: {
        position: 'absolute',
        top: 40,
        right: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 8,
        minWidth: 150,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
        zIndex: 1001,
    },
    dropdownMenuItem: {
        paddingHorizontal: 15,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#rgba(255, 255, 255, 0.1)',
    },
    dropdownMenuItemText: {
        color: '#fff',
        fontFamily: 'Poppins',
        fontSize: 14,
    },
});

export default HomeScreen;