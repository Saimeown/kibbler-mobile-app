import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useEffect } from 'react';


const AnimatedTabIcon = ({ focused, name, size, color }: {
  focused: boolean;
  name: keyof typeof Ionicons.glyphMap;
  size: number;
  color: string;
}) => {
  const scale = useSharedValue(focused ? 1.1 : 1);

  useEffect(() => {
    console.log('Icon focus changed:', name, focused); 
    scale.value = withTiming(focused ? 1.1 : 1, {
  duration: 250,
  easing: Easing.out(Easing.exp),
});

  }, [focused]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
};

const TabsLayout = () => {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#cacacbff',
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarShowLabel: false,
        tabBarIconStyle: {
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerTitle: 'Dashboard',
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon
        focused={focused}
        name={focused ? 'home' : 'home-outline'}
        size={size}
        color={color}
      />
          )
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          headerTitle: 'Analytics',
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon
            focused={focused}
              name={focused ? 'analytics' : 'analytics-outline'}
              size={size}
              color={color}
            />
          )
        }}
      />
      <Tabs.Screen
        name="pets"
        options={{
          headerTitle: 'Pets',
          headerShown: false,
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon
            focused={focused}
              name={focused ? 'paw' : 'paw-outline'}
              size={size}
              color={color}
            />
          )
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          headerTitle: 'Notifications',
          tabBarIcon: ({ color, size, focused }) => (
            <AnimatedTabIcon
            focused={focused}
              name={focused ? 'notifications' : 'notifications-outline'}
              size={size}
              color={color}
            />
          )
        }}
      />
    </Tabs>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: 'rgba(26, 21, 35, 1)', // Semi-transparent white
    borderRadius: 50,
    marginHorizontal: 15,
    marginBottom: 25,
    height: 60,
    paddingBottom: 5,
    paddingHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'absolute', // Ensure tab bar floats over content
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 0,
    borderTopColor: 'transparent',
  },
  tabBarLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default TabsLayout;