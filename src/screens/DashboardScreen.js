import { LinearGradient } from "expo-linear-gradient";
import React, { useState, useMemo } from "react";
import { BarChart, LineChart, PieChart } from "react-native-gifted-charts";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  Platform,
  Modal,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSeller } from "../context/SellerContext";
import { colors, THEMES, getTheme } from "../theme/colors";
import { StatCard } from "../components/StatCard";
import { SectionHeader } from "../components/SectionHeader";
import { OrderCard } from "../components/OrderCard";
import { StatusPill } from "../components/StatusPill";
import { ResponsiveContainer } from "../components/ResponsiveContainer";
import { useResponsive } from "../hooks/useResponsive";

export const DashboardScreen = () => {
  const navigation = useNavigation();
  const { horizontalPadding, width, isWide, cardColumns, getItemWidth } =
    useResponsive();
  const {
    vendorName,
    metrics,
    orders,
    products,
    refresh,
    loading,
    logout,
    profile,
    updateProfile,
  } = useSeller();
  const theme = profile?.theme_apply_store
    ? getTheme(profile?.theme_color || colors.primary)
    : getTheme(colors.primary);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [selectedThemeId, setSelectedThemeId] = useState(null);
  const [applyToStore, setApplyToStore] = useState(
    profile?.theme_apply_store || false,
  );
  const [applyToCustomer, setApplyToCustomer] = useState(
    profile?.theme_apply_customer || false,
  );

  const handleSelectTheme = (themeId) => {
    setSelectedThemeId(themeId);
  };

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
  const latestOrders = orders.slice(0, 3);
  const trendingProducts = products
    .filter((p) => p.status === "active")
    .sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0))
    .slice(0, 5);
  const orderBreakdown = ["processing", "packed", "shipped", "delivered"].map(
    (status) => ({
      status,
      total: orders.filter((o) => o.status === status).length,
    }),
  );
  const weeklyChartData = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dateStr = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString("en", { weekday: "short" });
        const dayTotal = orders
          .filter((o) => (o.created_at || "").slice(0, 10) === dateStr)
          .reduce((sum, o) => sum + Number(o.total || 0), 0);
        return { value: dayTotal, label };
      }),
    [orders],
  );

  return (
    <ResponsiveContainer>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingHorizontal: horizontalPadding },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        <LinearGradient
          colors={[theme.gradientStart, theme.gradientEnd]}
          style={[styles.hero, { shadowColor: theme.primary }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.heroHeader}>
            <View>
              <Text style={styles.heroKicker}>Merchant Portal</Text>
              <Text style={styles.heroTitle}>{vendorName}</Text>
              <Text style={styles.heroSubtitle}>
                Monitoring your store's performance and fulfillment.
              </Text>
            </View>
            {logout && (
              <TouchableOpacity onPress={logout} style={styles.logoutButton}>
                <Ionicons name="log-out-outline" size={24} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.heroActions}>
            <View style={[styles.heroChip, { backgroundColor: theme.primary }]}>
              <Ionicons name="storefront" size={16} color="#fff" />
              <Text style={styles.heroChipText}>Store Active</Text>
            </View>
            <TouchableOpacity style={styles.heroAction} onPress={refresh}>
              <Ionicons name="sync" size={16} color="#fff" />
              <Text style={styles.heroActionText}>Sync Data</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <View style={styles.statsGrid}>
          <StatCard
            label="Active Products"
            value={metrics.activeProducts}
            hint={`${metrics.pendingProducts} pending approval`}
            trend="+2.4%"
            tone="primary"
          />
          <StatCard
            label="Total Sold"
            value={metrics.totalSold || 0}
            hint="Items delivered"
            trend="+5.1%"
            tone="info"
          />
          <StatCard
            label="Net Earnings"
            value={`GH₵${(metrics.netRevenue || 0).toFixed(2)}`}
            hint={`${metrics.inProgressOrders} active orders`}
            trend="+12.7%"
            tone="success"
          />
          <StatCard
            label="Catalog"
            value={`${products.length} Items`}
            hint="Keep it updated"
            trend="+1.2%"
            tone="accent"
          />
        </View>

        {/* 7-Day Earnings Sparkline */}
        <View style={[styles.controlCard, { marginBottom: 24 }]}>
          <Text style={styles.controlTitle}>7-Day Order Revenue</Text>
          <LineChart
            areaChart
            data={weeklyChartData}
            width={width - horizontalPadding * 2 - 88}
            height={80}
            color={theme.primary}
            thickness={2}
            startFillColor={theme.primary + "33"}
            endFillColor={theme.primary + "05"}
            initialSpacing={12}
            noOfSections={2}
            hideDataPoints={false}
            dataPointsColor={theme.primary}
            dataPointsRadius={3}
            xAxisColor="#F1F5F9"
            yAxisColor="transparent"
            yAxisTextStyle={{ color: colors.muted, fontSize: 9 }}
            xAxisLabelTextStyle={{ color: colors.muted, fontSize: 9 }}
            rulesType="solid"
            rulesColor="#F1F5F9"
            isAnimated
            animationDuration={800}
          />
        </View>

        {/* Service Fee Info Card */}
        <View style={styles.controlCard}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <Ionicons
              name="information-circle"
              size={20}
              color={theme.primary}
            />
            <Text
              style={[styles.controlTitle, { marginLeft: 8, marginBottom: 0 }]}
            >
              Platform Service Fee
            </Text>
          </View>
          {metrics.netRevenue +
            metrics.commissionPaid +
            metrics.totalPaystackFees >
            0 && (
            <View style={{ alignItems: "center", paddingVertical: 16 }}>
              <PieChart
                donut
                data={[
                  { value: metrics.netRevenue, color: colors.success },
                  { value: metrics.commissionPaid, color: "#F59E0B" },
                  { value: metrics.totalPaystackFees, color: "#EF4444" },
                ].filter((d) => d.value > 0)}
                radius={70}
                innerRadius={44}
                isAnimated
                animationDuration={800}
                centerLabelComponent={() => {
                  const gross =
                    metrics.netRevenue +
                    metrics.commissionPaid +
                    metrics.totalPaystackFees;
                  const pct =
                    gross > 0
                      ? Math.round((metrics.netRevenue / gross) * 100)
                      : 0;
                  return (
                    <View style={{ alignItems: "center" }}>
                      <Text style={{ fontSize: 10, color: colors.muted }}>
                        you keep
                      </Text>
                      <Text
                        style={{
                          fontSize: 18,
                          fontWeight: "900",
                          color: colors.dark,
                        }}
                      >
                        {pct}%
                      </Text>
                    </View>
                  );
                }}
              />
              <View style={{ flexDirection: "row", gap: 16, marginTop: 12 }}>
                {[
                  { label: "Your Earnings", color: colors.success },
                  { label: "Service Fee", color: "#F59E0B" },
                  { label: "Paystack", color: "#EF4444" },
                ].map(({ label, color }) => (
                  <View
                    key={label}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: color,
                      }}
                    />
                    <Text style={{ fontSize: 10, color: colors.muted }}>
                      {label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>Service Fee Rate</Text>
            <StatusPill value={`${metrics.serviceFeePercentage || 0}%`} />
          </View>
          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>Total Service Fee Deducted</Text>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontWeight: "700", color: colors.dark }}>
                GH₵{(metrics.commissionPaid || 0).toFixed(2)}
              </Text>
              {metrics.feesAreEstimated && (
                <Text style={{ fontSize: 10, color: colors.muted }}>
                  estimated
                </Text>
              )}
            </View>
          </View>
          <View style={styles.controlRow}>
            <Text style={styles.controlLabel}>
              Paystack Fees (absorbed by platform)
            </Text>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontWeight: "700", color: colors.dark }}>
                GH₵{(metrics.totalPaystackFees || 0).toFixed(2)}
              </Text>
              {metrics.feesAreEstimated && (
                <Text style={{ fontSize: 10, color: colors.muted }}>
                  estimated
                </Text>
              )}
            </View>
          </View>
          <Text
            style={{
              fontSize: 12,
              color: colors.muted,
              marginTop: 8,
              lineHeight: 17,
            }}
          >
            The platform deducts {metrics.serviceFeePercentage || 0}% service
            fee from your product subtotal. This is taken from your subaccount
            share — customers are NOT charged extra. Paystack processing fees
            are also absorbed from the platform's share, not from your earnings.
            Your shipping fees are passed directly to you.
            {metrics.feesAreEstimated
              ? ' Values marked "estimated" are calculated from your order totals — they will update to exact figures once payment records are available.'
              : ""}
          </Text>
        </View>

        <View style={styles.controlsSection}>
          <View style={styles.controlCard}>
            <Text style={styles.controlTitle}>Fulfillment Lanes</Text>
            {(() => {
              const maxVal = Math.max(...orderBreakdown.map((b) => b.total), 1);
              const laneColors = {
                processing: theme.primary,
                packed: "#F59E0B",
                shipped: colors.accent,
                delivered: colors.success,
              };
              return orderBreakdown.map(({ status, total }) => (
                <View key={status} style={{ marginTop: 10 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <Text
                      style={[
                        styles.controlLabel,
                        { textTransform: "capitalize" },
                      ]}
                    >
                      {status}
                    </Text>
                    <Text
                      style={{
                        fontWeight: "800",
                        color: laneColors[status] || colors.muted,
                        fontSize: 13,
                      }}
                    >
                      {total}
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 8,
                      backgroundColor: "#F1F5F9",
                      borderRadius: 6,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        height: "100%",
                        width: `${(total / maxVal) * 100}%`,
                        backgroundColor: laneColors[status] || colors.muted,
                        borderRadius: 6,
                      }}
                    />
                  </View>
                </View>
              ));
            })()}
          </View>

          <View style={styles.controlCard}>
            <Text style={styles.controlTitle}>Store Actions</Text>
            <View style={styles.actionGrid}>
              <TouchableOpacity
                style={styles.controlAction}
                onPress={() => navigation.navigate("Catalog")}
              >
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: theme.gradientStart + "22" },
                  ]}
                >
                  <Ionicons name="add-circle" size={20} color={theme.primary} />
                </View>
                <Text style={styles.controlActionText}>Add Product</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.controlAction}
                onPress={() => navigation.navigate("Orders")}
              >
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: theme.gradientStart + "22" },
                  ]}
                >
                  <Ionicons name="bicycle" size={20} color={theme.accent} />
                </View>
                <Text style={styles.controlActionText}>Delivery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.controlAction}
                onPress={() => navigation.navigate("Profile")}
              >
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: theme.gradientStart + "22" },
                  ]}
                >
                  <Ionicons name="help-buoy" size={20} color={theme.accent} />
                </View>
                <Text style={styles.controlActionText}>Support</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.controlAction}
                onPress={() => navigation.navigate("StatusCreator")}
              >
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: theme.gradientStart + "22" },
                  ]}
                >
                  <Ionicons name="camera" size={20} color={theme.accent} />
                </View>
                <Text style={styles.controlActionText}>Post Status</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.controlAction}
                onPress={() => setShowThemeModal(true)}
              >
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: theme.gradientStart + "22" },
                  ]}
                >
                  <Ionicons
                    name="color-palette"
                    size={20}
                    color={theme.primary}
                  />
                </View>
                <Text style={styles.controlActionText}>Theme</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.controlAction} onPress={refresh}>
                <View
                  style={[
                    styles.actionIcon,
                    { backgroundColor: theme.gradientStart + "22" },
                  ]}
                >
                  <Ionicons
                    name="refresh-circle"
                    size={20}
                    color={theme.accent}
                  />
                </View>
                <Text style={styles.controlActionText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <SectionHeader
          title="Recent Orders"
          subtitle="Manage incoming fulfillment"
        />

        <Modal
          visible={showThemeModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowThemeModal(false)}
        >
          <View style={{ flex: 1, justifyContent: "flex-end" }}>
            <View
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                padding: 16,
                maxHeight: "70%",
              }}
            >
              <Text
                style={{ fontWeight: "800", fontSize: 16, marginBottom: 12 }}
              >
                Select Store Theme
              </Text>
              <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
                <View style={styles.themeSwatchesContainer}>
                  {Object.values(THEMES).map((t) => (
                    <View key={t.id} style={styles.themeSwatchItem}>
                      <Pressable
                        onPress={() => handleSelectTheme(t.id)}
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
        <View style={styles.listContainer}>
          {latestOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
          {!latestOrders.length ? (
            <Text style={styles.empty}>No recent orders found.</Text>
          ) : null}
        </View>

        <SectionHeader
          title="Performance Snapshot"
          subtitle="Your top performing items"
        />
        <View style={styles.cardGrid}>
          {trendingProducts.map((item) => (
            <View key={item.id} style={styles.trendingCard}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.cardMeta} numberOfLines={1}>
                {item.category || "General"}
              </Text>
              <View style={styles.priceRow}>
                <Text style={[styles.currency, { color: theme.primary }]}>
                  GH₵
                </Text>
                <Text style={[styles.priceValue, { color: theme.primary }]}>
                  {Number(item.price || 0).toLocaleString()}
                </Text>
              </View>
            </View>
          ))}
          {!trendingProducts.length ? (
            <Text style={styles.empty}>No trending products identified.</Text>
          ) : null}
        </View>

        {trendingProducts.some((p) => (p.sold_count || 0) > 0) && (
          <View style={[styles.controlCard, { marginBottom: 24 }]}>
            <Text style={styles.controlTitle}>Units Sold — Top Products</Text>
            <BarChart
              data={trendingProducts.map((p, i) => ({
                value: p.sold_count || 0,
                label: p.title.split(" ")[0],
                frontColor: [
                  theme.primary,
                  colors.accent,
                  colors.success,
                  "#F59E0B",
                  "#8B5CF6",
                ][i % 5],
                topLabelComponent: () => (
                  <Text
                    style={{
                      fontSize: 9,
                      color: colors.muted,
                      marginBottom: 2,
                    }}
                  >
                    {p.sold_count || 0}
                  </Text>
                ),
              }))}
              barWidth={36}
              spacing={20}
              height={100}
              width={width - horizontalPadding * 2 - 88}
              noOfSections={3}
              xAxisThickness={0}
              yAxisThickness={0}
              yAxisTextStyle={{ color: colors.muted, fontSize: 9 }}
              xAxisLabelTextStyle={{
                color: colors.muted,
                fontSize: 9,
                width: 44,
                textAlign: "center",
              }}
              isAnimated
              animationDuration={600}
              roundedTop
            />
          </View>
        )}
      </ScrollView>
    </ResponsiveContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 120,
  },
  hero: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
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
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroKicker: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 4,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.85)",
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: "85%",
  },
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 24,
  },
  heroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
  },
  heroChipText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  heroAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.1)",
    borderRadius: 12,
  },
  heroActionText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  logoutButton: {
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  controlsSection: {
    gap: 12,
    marginBottom: 24,
    marginTop: 4,
  },
  controlCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  controlTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.dark,
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  controlRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  controlLabel: {
    color: colors.muted,
    fontWeight: "600",
    fontSize: 14,
    textTransform: "capitalize",
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "stretch",
  },
  controlAction: {
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    width: "30%",
    marginBottom: 12,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  controlActionText: {
    color: colors.dark,
    fontWeight: "700",
    fontSize: 11,
    textAlign: "center",
  },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  trendingCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    flex: 1,
    minWidth: 140,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.dark,
  },
  cardMeta: {
    color: colors.muted,
    marginTop: 4,
    fontSize: 13,
    fontWeight: "500",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
  },
  currency: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
    marginTop: 2,
  },
  priceValue: {
    fontSize: 17,
    fontWeight: "900",
    color: colors.primary,
  },
  listContainer: {
    gap: 12,
    marginBottom: 24,
  },
  empty: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    width: "100%",
    padding: 20,
  },
});
