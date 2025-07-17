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
  Dimensions,
  TextInput,
  FlatList,
  Modal,
  Pressable
} from 'react-native';
import { useFonts } from 'expo-font';
import { FontAwesome5 } from '@expo/vector-icons';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update } from 'firebase/database';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAWs_lSL0Z09pYVQ70lvxEaqQl6YSsE6tY",
  databaseURL: "https://kibbler-24518-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "kibbler-24518",
  appId: "1:1093837743559:web:3d4a3a0a1f4e3f5c1a2f1f"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

interface Pet {
  uid: string;
  name: string;
  visit_count: number;
  last_visit_str: string;
  inactive_hours?: number | string;
}

interface PetsData {
  pet_stats: Record<string, Pet>;
  all_names: string[];
  assigned_names: string[];
  error?: string;
}

const defaultPetNames = [
  "Muichi", "Tomo", "Yuki", "Kiro", "Suki", "Hana", "Aiko", "Kenta", "Rin", "Kai",
  "Nori", "Mika", "Sora", "Kenji", "Emi", "Yui", "Riko", "Toshi", "Nana", "Ren",
  "Kumi", "Hiro", "Mari", "Taku", "Saya", "Yuma", "Kiko", "Naoki", "Ami", "Rei",
  "Tomi", "Haru", "Mei", "Sho", "Airi", "Kazu", "Hanae", "Riku", "Chika", "Yoru",
  "Ayumi", "Suzu", "Kiyo", "Tomoha", "Shin", "Sena", "Kayo", "Risa", "Toma", "Yuri"
];

const PetsScreen = () => {
  const [fontsLoaded] = useFonts({
    'Poppins': require('../../assets/fonts/Poppins/Poppins-Light.ttf'),
    'Poppins-SemiBold': require('../../assets/fonts/Poppins/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../../assets/fonts/Poppins/Poppins-Bold.ttf'),
  });

  const [data, setData] = useState<PetsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('inactive');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [newName, setNewName] = useState('');
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [tagRegistrationMode, setTagRegistrationMode] = useState(false);
  const [detectedTag, setDetectedTag] = useState<string | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

  useEffect(() => {
    const dbRef = ref(database, '/devices/kibbler_001');

    const unsubscribe = onValue(dbRef, (snapshot) => {
      const firebaseData = snapshot.val();
      if (firebaseData) {
        const processedData = processPetData(firebaseData);
        setData(processedData);
      } else {
        setData({
          pet_stats: {},
          all_names: defaultPetNames,
          assigned_names: [],
          error: 'Could not load pet data'
        });
      }
      setLoading(false);
    }, (error) => {
      console.error('Firebase error:', error);
      setData({
        pet_stats: {},
        all_names: defaultPetNames,
        assigned_names: [],
        error: 'Could not load pet data'
      });
      setLoading(false);
    });

    // Listen for battery level
    const batteryRef = ref(database, '/devices/kibbler_001/device_status/battery_level');
    onValue(batteryRef, (snapshot) => {
      setBatteryLevel(snapshot.val());
    });

    return () => {
      unsubscribe();
      // Clean up any listeners if needed
    };
  }, []);

  const processPetData = (deviceData: any): PetsData => {
    try {
      const feedingHistory = deviceData.feeding_history || {};
      const petRegistry = deviceData.pet_registry || {};
      const lastFedTimes = deviceData.last_fed_times || {};

      const petStats: Record<string, Pet> = {};
      const assignedNames: string[] = [];

      // Process pet registry first
      Object.entries(petRegistry).forEach(([uid, name]) => {
        const uidStr = uid.toString();
        petStats[uidStr] = {
          uid: uidStr,
          name: name as string,
          visit_count: 0,
          last_visit_str: 'Never',
        };
        assignedNames.push(name as string);
      });

      // Process feeding history
      Object.values(feedingHistory).forEach((feeding: any) => {
        if (!feeding?.uid) return;

        const uid = feeding.uid.toString();
        const petName = petRegistry[uid] || feeding.pet_name || 'Unknown';

        if (!petStats[uid]) {
          petStats[uid] = {
            uid,
            name: petName,
            visit_count: 0,
            last_visit_str: 'Never',
          };
          if (petName !== 'Unknown') {
            assignedNames.push(petName);
          }
        }

        petStats[uid].visit_count++;

        if (feeding.timestamp) {
          const date = new Date(feeding.timestamp);
          petStats[uid].last_visit_str = date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          });
        }
      });

      // Process inactive hours
      const currentTime = Date.now() / 1000;
      Object.values(petStats).forEach(pet => {
        const lastFed = lastFedTimes[pet.uid];

        if (typeof lastFed === 'number') {
          const lastFedTime = (lastFed > currentTime * 1000) ? lastFed / 1000 : lastFed;
          pet.inactive_hours = Math.round((currentTime - lastFedTime) / 3600);
        } else if (typeof lastFed === 'string') {
          const lastFedTime = new Date(lastFed).getTime() / 1000;
          if (!isNaN(lastFedTime)) {
            pet.inactive_hours = Math.round((currentTime - lastFedTime) / 3600);
          } else {
            pet.inactive_hours = 'Unknown';
          }
        } else {
          pet.inactive_hours = 'Unknown';
        }
      });

      // Prepare all names
      const registryNames = Object.values(petRegistry);
      const allNames = Array.from(new Set([...defaultPetNames, ...registryNames])).sort();

      return {
        pet_stats: petStats,
        all_names: allNames as string[],
        assigned_names: assignedNames,
      };
    } catch (error) {
      console.error('Error processing pet data:', error);
      return {
        pet_stats: {},
        all_names: defaultPetNames,
        assigned_names: [],
        error: 'Error processing pet data'
      };
    }
  };

  const getBatteryIcon = (level?: number | null) => {
    if (!level) return 'battery-empty';
    if (level >= 80) return 'battery-full';
    if (level >= 60) return 'battery-three-quarters';
    if (level >= 40) return 'battery-half';
    if (level >= 20) return 'battery-quarter';
    return 'battery-empty';
  };

  const handleUpdatePetName = async (uid: string, newName: string) => {
    try {
      // Update pet registry
      const updates = {
        [`/devices/kibbler_001/pet_registry/${uid}`]: newName
      };

      // Update feeding history (would need to scan all records in a real app)
      // This is simplified - in a real app you'd need to update all references

      await update(ref(database), updates);

      // Show success (you might want to use a toast or alert)
      alert('Pet name updated successfully!');
    } catch (error) {
      console.error('Error updating pet name:', error);
      alert('Failed to update pet name');
    }
  };

  const startTagRegistration = async () => {
    try {
      setTagRegistrationMode(true);
      setDetectedTag(null);
      await set(ref(database, '/devices/kibbler_001/tag_registration_mode'), true);

      // Listen for new tags
      const tagRef = ref(database, '/devices/kibbler_001/last_detected_tag');
      onValue(tagRef, (snapshot) => {
        const tagData = snapshot.val();
        if (tagData?.uid && (!detectedTag || detectedTag !== tagData.uid)) {
          setDetectedTag(tagData.uid);
        }
      });
    } catch (error) {
      console.error('Error starting tag registration:', error);
    }
  };

  const stopTagRegistration = async () => {
    try {
      setTagRegistrationMode(false);
      setDetectedTag(null);
      await set(ref(database, '/devices/kibbler_001/tag_registration_mode'), false);
      await set(ref(database, '/devices/kibbler_001/last_detected_tag'), null);
    } catch (error) {
      console.error('Error stopping tag registration:', error);
    }
  };

  const registerTag = async () => {
    if (!detectedTag || !newName) {
      alert('Please select a name for the tag');
      return;
    }

    try {
      await set(ref(database, `/devices/kibbler_001/pet_registry/${detectedTag}`), newName); // Fixed: Removed extra parenthesis and ensured two arguments
      alert('Tag registered successfully!');
      setRegisterModalVisible(false);
      stopTagRegistration();
    } catch (error) {
      console.error('Error registering tag:', error);
      alert('Failed to register tag');
    }
  };

  const sortedPets = React.useMemo(() => {
    if (!data?.pet_stats) return [];

    const pets = Object.values(data.pet_stats);

    return pets.sort((a, b) => {
      let aValue, bValue;

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          return aValue.localeCompare(bValue) * (sortDirection === 'asc' ? 1 : -1);
        case 'visits':
          aValue = a.visit_count;
          bValue = b.visit_count;
          return (aValue - bValue) * (sortDirection === 'asc' ? 1 : -1);
        case 'inactive':
          aValue = typeof a.inactive_hours === 'number' ? a.inactive_hours : 0;
          bValue = typeof b.inactive_hours === 'number' ? b.inactive_hours : 0;
          return (aValue - bValue) * (sortDirection === 'asc' ? 1 : -1);
        default:
          return 0;
      }
    }).filter(pet =>
      pet.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data?.pet_stats, searchTerm, sortField, sortDirection]);

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
        source={require('../../assets/BG.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <View style={styles.contentContainer}>
          <View style={styles.headerContent}>
            <View style={styles.logoSection}>
              <View style={styles.dashboardTitleRow}>
                <Text style={styles.headerText}>Pet Management</Text>
                <View style={styles.taglineBox}>
                  <FontAwesome5 name="paw" size={12} color="#fff" style={styles.pawHeader} />
                  <Text style={styles.taglineText}> Manage pet names and view activity</Text>
                </View>
                <View style={styles.headerData}>
                  <View style={[styles.statusBadge, styles.connected]}>
                    <View style={[styles.statusDot, styles.connectedDot]} />
                    <Text style={styles.statusText}>Online</Text>
                  </View>
                  <View style={styles.batteryIndicator}>
                    <FontAwesome5 name={getBatteryIcon(batteryLevel)} size={16} color="#fff" style={styles.batteryIcon} />
                    <Text style={styles.batteryText}>{batteryLevel ?? '--'}%</Text>
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
              <TouchableOpacity style={styles.subtab}>
                <Text style={styles.subtabText}>Overview</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.subtab, styles.activeSubtab]}>
                <Text style={styles.subtabText}>Pet Management</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.subtab}>
                <Text style={styles.subtabText}>Feeding Patterns</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.subtab}>
                <Text style={styles.subtabText}>Historical Data</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          <View style={styles.headerLine} />

          <ScrollView style={styles.scrollContainer} contentContainerStyle={{ paddingBottom: 80 }}>
            {/* Registered Pets Panel */}
            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>
                  <FontAwesome5 name="dog" size={16} color="#fff" /> Registered Pets
                </Text>
              </View>

              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search pet names..."
                  placeholderTextColor="#a0a0a0"
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                />
                <View style={styles.sortControls}>
                  <Text style={styles.sortText}>Sort by:</Text>
                  <View style={styles.sortSelect}>
                    <FontAwesome5 name="sort" size={14} color="#fff" />
                    <Text style={styles.sortSelectText}>
                      {sortField === 'name' ? 'Name' :
                        sortField === 'visits' ? 'Visits' : 'Inactive'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.sortDirectionButton}
                    onPress={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                  >
                    <FontAwesome5
                      name={sortDirection === 'asc' ? 'sort-amount-up' : 'sort-amount-down'}
                      size={14}
                      color="#fff"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.tableContainer}>
                <View style={styles.tableHeader}>
                  <Text style={styles.tableHeaderCell}>RFID Tag</Text>
                  <Text style={styles.tableHeaderCell}>Pet Name</Text>
                  <Text style={styles.tableHeaderCell}>Visits</Text>
                  <Text style={styles.tableHeaderCell}>Last Fed</Text>
                </View>

                <FlatList
                  data={sortedPets}
                  keyExtractor={(item) => item.uid}
                  renderItem={({ item }) => (
                    <View style={styles.tableRow}>
                      <Text style={styles.tableCell}>{item.uid.substring(0, 8)}</Text>
                      <Text style={styles.tableCell}>{item.name}</Text>
                      <Text style={styles.tableCell}>{item.visit_count}</Text>
                      <Text style={styles.tableCell}>{item.last_visit_str}</Text>
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => setSelectedPet(item)}
                      >
                        <Text style={styles.editButtonText}>Edit</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  ListEmptyComponent={
                    <View style={styles.emptyRow}>
                      <Text style={styles.emptyText}>No pets registered yet</Text>
                    </View>
                  }
                />
              </View>
            </View>

            {/* Available Names Panel */}
            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>
                  <FontAwesome5 name="tag" size={16} color="#fff" /> Available Pet Names
                </Text>
              </View>

              <View style={styles.tagsContainer}>
                {data?.all_names.map((name) => (
                  <View
                    key={name}
                    style={[
                      styles.nameTag,
                      data.assigned_names.includes(name) && styles.assignedTag
                    ]}
                  >
                    <Text style={styles.nameTagText}>{name}</Text>
                    {data.assigned_names.includes(name) ? (
                      <FontAwesome5 name="check" size={12} color="#4CAF50" />
                    ) : (
                      <FontAwesome5 name="times" size={12} color="#FF4747" />
                    )}
                  </View>
                ))}
              </View>

              <View style={styles.addNameContainer}>
                <Text style={styles.sectionTitle}>
                  <FontAwesome5 name="plus" size={16} color="#fff" /> Add New Name
                </Text>
                <View style={styles.addNameForm}>
                  <TextInput
                    style={styles.nameInput}
                    placeholder="Enter a new pet name!"
                    placeholderTextColor="#a0a0a0"
                    value={newName}
                    onChangeText={setNewName}
                  />
                  <TouchableOpacity style={styles.addButton}>
                    <Text style={styles.addButtonText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.instructionsContainer}>
                <Text style={styles.sectionTitle}>
                  <FontAwesome5 name="info-circle" size={16} color="#fff" /> How to Assign Names
                </Text>
                <View style={styles.instructionsList}>
                  <Text style={styles.instructionText}>1. Scan your pet's RFID tag at the feeder</Text>
                  <Text style={styles.instructionText}>2. Come to this page to see the new tag appear</Text>
                  <Text style={styles.instructionText}>3. Select a name from the dropdown and click 'Update'</Text>
                  <Text style={styles.instructionText}>4. The name will be used for all future feedings</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.registerButton}
                onPress={() => setRegisterModalVisible(true)}
              >
                <FontAwesome5 name="plus" size={16} color="#fff" />
                <Text style={styles.registerButtonText}>Register New Tag</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </ImageBackground>

      {/* Edit Pet Name Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={!!selectedPet}
        onRequestClose={() => setSelectedPet(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Edit Pet Name</Text>
            <Text style={styles.modalSubtitle}>RFID: {selectedPet?.uid.substring(0, 8)}</Text>

            <View style={styles.modalPicker}>
              <FontAwesome5 name="chevron-down" size={16} color="#fff" style={styles.pickerIcon} />
              <Text style={styles.pickerText}>
                {selectedPet?.name || 'Select a name'}
              </Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setSelectedPet(null)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={() => {
                  if (selectedPet) {
                    handleUpdatePetName(selectedPet.uid, selectedPet.name);
                    setSelectedPet(null);
                  }
                }}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Register Tag Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={registerModalVisible}
        onRequestClose={() => setRegisterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              <FontAwesome5 name="rfid" size={16} color="#fff" /> Register New Pet Tag
            </Text>

            {!detectedTag ? (
              <View style={styles.scanningContainer}>
                <Text style={styles.scanningText}>Scan your pet's RFID tag now...</Text>
                <View style={styles.scanningAnimation}>
                  <View style={styles.wave} />
                  <View style={styles.wave} />
                  <View style={styles.wave} />
                </View>
              </View>
            ) : (
              <View style={styles.tagDetectedContainer}>
                <View style={styles.detectedTag}>
                  <FontAwesome5 name="check-circle" size={20} color="#4CAF50" />
                  <Text style={styles.detectedTagText}>
                    Tag Detected: {detectedTag.substring(0, 8)}
                  </Text>
                </View>

                <Text style={styles.modalLabel}>Pet Name:</Text>
                <View style={styles.modalPicker}>
                  <FontAwesome5 name="chevron-down" size={16} color="#fff" style={styles.pickerIcon} />
                  <Text style={styles.pickerText}>
                    {newName || 'Select a name'}
                  </Text>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => {
                      setRegisterModalVisible(false);
                      stopTagRegistration();
                    }}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={registerTag}
                  >
                    <Text style={styles.modalButtonText}>Register</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
    backgroundColor: 'rgba(18, 18, 18, 0.7)',
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
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
  panel: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 15,
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
  searchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 10,
    color: '#fff',
    fontFamily: 'Poppins',
    fontSize: 14,
    marginRight: 10,
  },
  sortControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortText: {
    color: '#a0a0a0',
    fontFamily: 'Poppins',
    fontSize: 12,
    marginRight: 5,
  },
  sortSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 5,
  },
  sortSelectText: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
    marginLeft: 5,
  },
  sortDirectionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 8,
  },
  tableContainer: {
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 10,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  tableHeaderCell: {
    flex: 1,
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  tableCell: {
    flex: 1,
    color: '#e8e8e8',
    fontFamily: 'Poppins',
    fontSize: 12,
    textAlign: 'center',
  },
  editButton: {
    backgroundColor: 'rgba(106, 71, 194, 0.5)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editButtonText: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
  },
  emptyRow: {
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#a0a0a0',
    fontFamily: 'Poppins',
    fontSize: 14,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  nameTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  assignedTag: {
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
  },
  nameTagText: {
    color: '#fff',
    fontFamily: 'Poppins',
    fontSize: 12,
    marginRight: 5,
  },
  addNameContainer: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    marginBottom: 10,
  },
  addNameForm: {
    flexDirection: 'row',
  },
  nameInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 10,
    color: '#fff',
    fontFamily: 'Poppins',
    fontSize: 14,
    marginRight: 10,
  },
  addButton: {
    backgroundColor: '#dd2c00',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
  },
  instructionsContainer: {
    marginBottom: 20,
  },
  instructionsList: {
    marginLeft: 15,
  },
  instructionText: {
    color: '#a0a0a0',
    fontFamily: 'Poppins',
    fontSize: 14,
    lineHeight: 22,
  },
  registerButton: {
    flexDirection: 'row',
    backgroundColor: '#dd2c00',
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: 'rgba(40, 40, 40, 0.95)',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    marginBottom: 5,
  },
  modalSubtitle: {
    color: '#a0a0a0',
    fontFamily: 'Poppins',
    fontSize: 12,
    marginBottom: 15,
  },
  modalLabel: {
    color: '#fff',
    fontFamily: 'Poppins',
    fontSize: 14,
    marginBottom: 8,
  },
  modalPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
  },
  pickerIcon: {
    marginRight: 10,
  },
  pickerText: {
    flex: 1,
    color: '#fff',
    fontFamily: 'Poppins',
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginRight: 10,
  },
  saveButton: {
    backgroundColor: '#dd2c00',
  },
  modalButtonText: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
  },
  scanningContainer: {
    alignItems: 'center',
    padding: 20,
  },
  scanningText: {
    color: '#fff',
    fontFamily: 'Poppins',
    fontSize: 14,
    marginBottom: 15,
  },
  scanningAnimation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 30,
  },
  wave: {
    width: 6,
    height: 20,
    backgroundColor: '#dd2c00',
    marginHorizontal: 3,
    borderRadius: 3,
  },
  tagDetectedContainer: {
    marginTop: 10,
  },
  detectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
  },
  detectedTagText: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    marginLeft: 8,
  },
});

export default PetsScreen;