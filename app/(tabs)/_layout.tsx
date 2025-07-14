import { Tabs } from 'expo-router'

const TabsLayout = () => {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={
        {
        headerTitle: "Dashboard",
        headerShown: false
        }
      } />

      <Tabs.Screen name="analytics" options={
        {
        headerTitle: "Analytics"
        }
      } />

      <Tabs.Screen name="pets" options={
        {
        headerTitle: "Pets"
        }
      } />

      <Tabs.Screen name="notifications" options={
        {
        headerTitle: "Notification"
        }
      } />

    </Tabs>
  )
}

export default TabsLayout
