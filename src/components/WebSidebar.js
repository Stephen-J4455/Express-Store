import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { useSeller } from "../context/SellerContext";
import { colors, getTheme, THEMES } from "../theme/colors";

const NAV_ITEMS = [
  { name: "Overview", icon: "speedometer-outline", iconFocused: "speedometer" },
  { name: "Catalog", icon: "pricetags-outline", iconFocused: "pricetags" },
  { name: "Orders", icon: "cube-outline", iconFocused: "cube" },
  { name: "Chats", icon: "chatbubble-outline", iconFocused: "chatbubble" },
  { name: "Feedback", icon: "star-outline", iconFocused: "star" },
  { name: "Profile", icon: "person-outline", iconFocused: "person" },
];

const UTILITY_ITEMS = [
  {
    key: "support",
    label: "Support",
    icon: "help-buoy-outline",
    iconFocused: "help-buoy",
  },
  {
    key: "theme",
    label: "Theme",
    icon: "color-palette-outline",
    iconFocused: "color-palette",
  },
];

export const WebSidebar = ({ state, navigation, sidebarWidth }) => {
  const insets = useSafeAreaInsets();
  const { metrics, profile, updateProfile } = useSeller();
  const theme = profile?.theme_apply_store
    ? getTheme(profile?.theme_color || colors.primary)
    : getTheme(colors.primary);
  const activeRoute = state?.routes?.[state.index]?.name;
  const orderBadge =
    metrics?.inProgressOrders > 0 ? metrics.inProgressOrders : 0;

  const [showThemeModal, setShowThemeModal] = useState(false);
  const [selectedThemeId, setSelectedThemeId] = useState(null);
  const [applyToStore, setApplyToStore] = useState(
    profile?.theme_apply_store || false,
  );
  const [applyToCustomer, setApplyToCustomer] = useState(
    profile?.theme_apply_customer || false,
  );

  const handleSaveTheme = async () => {
    if (!selectedThemeId) {
      setShowThemeModal(false);
      return;
    }
    try {
      await updateProfile({
        theme_color: selectedThemeId,
        theme_apply_store: applyToStore,
        theme_apply_customer: applyToCustomer,
      });
    } catch (err) {
      console.error("Failed to update theme:", err);
    } finally {
      setShowThemeModal(false);
    }
  };

  const handleUtilityPress = (key) => {
    if (key === "support") {
      navigation.navigate("Profile", { initialTab: "support" });
    } else if (key === "theme") {
      setSelectedThemeId(null);
      setApplyToStore(profile?.theme_apply_store || false);
      setApplyToCustomer(profile?.theme_apply_customer || false);
      setShowThemeModal(true);
    }
  };

  return (
    <View
      style={[
        styles.container,
        { width: sidebarWidth, paddingTop: insets.top },
      ]}
    >
      {/* Brand */}
      <View style={styles.brandContainer}>
        <LinearGradient
          colors={[
            theme.primary || colors.primary,
            theme.accent || colors.accent,
          ]}
          style={styles.brandIcon}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="storefront" size={22} color="#fff" />
        </LinearGradient>
        {sidebarWidth >= 200 && (
          <Text style={styles.brandText}>Express Store</Text>
        )}
      </View>

      {/* Nav Items */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.navList}
        style={{ flex: 1 }}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeRoute === item.name;
          return (
            <Pressable
              key={item.name}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => navigation.navigate(item.name)}
            >
              {isActive && (
                <LinearGradient
                  colors={[
                    (theme.primary || colors.primary) + "15",
                    (theme.accent || colors.accent) + "08",
                  ]}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              )}
              <View style={styles.navItemContent}>
                <View style={styles.iconContainer}>
                  <Ionicons
                    name={isActive ? item.iconFocused : item.icon}
                    size={22}
                    color={
                      isActive ? theme.primary || colors.primary : colors.muted
                    }
                  />
                  {item.name === "Orders" && orderBadge > 0 && (
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: theme.accent || colors.accent },
                      ]}
                    >
                      <Text style={styles.badgeText}>
                        {orderBadge > 99 ? "99+" : orderBadge}
                      </Text>
                    </View>
                  )}
                </View>
                {sidebarWidth >= 200 && (
                  <Text
                    style={[
                      styles.navLabel,
                      isActive && {
                        color: theme.primary || colors.primary,
                        fontWeight: "800",
                      },
                    ]}
                  >
                    {item.name}
                  </Text>
                )}
              </View>
              {isActive && (
                <View
                  style={[
                    styles.activeIndicator,
                    { backgroundColor: theme.primary || colors.primary },
                  ]}
                />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Utility Section */}
      <View style={styles.utilitySection}>
        <View style={styles.divider} />
        {UTILITY_ITEMS.map((item) => {
          const isActive = item.key === "support" && activeRoute === "Profile";
          return (
            <Pressable
              key={item.key}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => handleUtilityPress(item.key)}
            >
              <View style={styles.navItemContent}>
                <View style={styles.iconContainer}>
                  <Ionicons
                    name={isActive ? item.iconFocused : item.icon}
                    size={20}
                    color={
                      isActive ? theme.primary || colors.primary : colors.muted
                    }
                  />
                </View>
                {sidebarWidth >= 200 && (
                  <Text
                    style={[
                      styles.navLabel,
                      isActive && {
                        color: theme.primary || colors.primary,
                        fontWeight: "800",
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Theme Modal */}
      <Modal
        visible={showThemeModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowThemeModal(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <View style={styles.themeSheet}>
            <Text style={styles.themeSheetTitle}>Select Store Theme</Text>
            <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
              <View style={styles.themeSwatchesContainer}>
                {Object.values(THEMES).map((t) => (
                  <View key={t.id} style={styles.themeSwatchItem}>
                    <Pressable
                      onPress={() => setSelectedThemeId(t.id)}
                      style={{ alignItems: "center" }}
                    >
                      <View
                        style={[
                          styles.themeSwatchCircle,
                          selectedThemeId === t.id &&
                            styles.themeSwatchSelected,
                          { backgroundColor: t.primary },
                        ]}
                      />
                      <Text style={styles.themeSwatchLabel}>{t.id}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>

              <View style={{ marginTop: 12 }}>
                <Text style={{ fontWeight: "700", marginBottom: 8 }}>
                  Apply theme to
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    gap: 16,
                    alignItems: "center",
                  }}
                >
                  <Pressable
                    onPress={() => setApplyToStore(!applyToStore)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <View style={{ width: 40 }}>
                      <View
                        style={{
                          width: 36,
                          height: 20,
                          borderRadius: 12,
                          backgroundColor: applyToStore
                            ? theme.primary
                            : "#E5E7EB",
                          justifyContent: "center",
                        }}
                      >
                        <View
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 8,
                            backgroundColor: "#fff",
                            marginLeft: applyToStore ? 18 : 2,
                          }}
                        />
                      </View>
                    </View>
                    <Text>Store app</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setApplyToCustomer(!applyToCustomer)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <View style={{ width: 40 }}>
                      <View
                        style={{
                          width: 36,
                          height: 20,
                          borderRadius: 12,
                          backgroundColor: applyToCustomer
                            ? theme.primary
                            : "#E5E7EB",
                          justifyContent: "center",
                        }}
                      >
                        <View
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 8,
                            backgroundColor: "#fff",
                            marginLeft: applyToCustomer ? 18 : 2,
                          }}
                        />
                      </View>
                    </View>
                    <Text>Customer app</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>

            <View
              style={{
                marginTop: 8,
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: 12,
              }}
            >
              <TouchableOpacity
                onPress={() => setShowThemeModal(false)}
                style={{ padding: 8 }}
              >
                <Text style={{ color: "#374151", fontWeight: "700" }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveTheme}
                style={{ padding: 8 }}
              >
                <Text style={{ color: theme.primary, fontWeight: "800" }}>
                  Apply
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRightWidth: 1,
    borderRightColor: "#F1F5F9",
  },
  brandContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 12,
  },
  brandIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.dark,
    letterSpacing: -0.5,
  },
  navList: {
    paddingHorizontal: 12,
    gap: 4,
  },
  navItem: {
    borderRadius: 12,
    overflow: "hidden",
    minHeight: 48,
    justifyContent: "center",
  },
  navItemActive: {
    backgroundColor: "transparent",
  },
  navItemContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
  },
  iconContainer: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -10,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
  navLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.muted,
  },
  activeIndicator: {
    position: "absolute",
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
  },
  utilitySection: {
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginBottom: 8,
  },
  themeSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: "70%",
  },
  themeSheetTitle: {
    fontWeight: "800",
    fontSize: 16,
    marginBottom: 12,
  },
  themeSwatchesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 4,
  },
  themeSwatchItem: {
    width: "20%",
    alignItems: "center",
    marginBottom: 12,
  },
  themeSwatchCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  themeSwatchSelected: {
    borderWidth: 3,
    borderColor: "#111",
  },
  themeSwatchLabel: {
    marginTop: 6,
    fontSize: 12,
    textTransform: "capitalize",
    color: "#374151",
  },
});
