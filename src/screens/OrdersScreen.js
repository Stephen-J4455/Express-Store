import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSeller } from "../context/SellerContext";
import { colors } from "../theme/colors";
import { OrderCard } from "../components/OrderCard";
import { SectionHeader } from "../components/SectionHeader";
import { ResponsiveContainer } from "../components/ResponsiveContainer";
import { useResponsive } from "../hooks/useResponsive";

const statusFilters = [
  "processing",
  "packed",
  "shipped",
  "delivered",
  "canceled",
];

export const OrdersScreen = ({ navigation }) => {
  const { orders, refresh, loading, advanceOrderStatus } = useSeller();
  const { horizontalPadding, isWide, cardColumns } = useResponsive();
  const [filter, setFilter] = useState("processing");
  const [searchQuery, setSearchQuery] = useState("");
  const statusSummary = statusFilters.map((status) => ({
    status,
    total: orders.filter((order) => order.status === status).length,
  }));

  const filteredOrders = useMemo(() => {
    let filtered = orders;

    // Apply status filter - each filter shows only orders with that exact status
    filtered = filtered.filter((order) => order.status === filter);

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (order) =>
          order.order_number?.toLowerCase().includes(query) ||
          order.customer?.name?.toLowerCase().includes(query) ||
          order.customer?.email?.toLowerCase().includes(query),
      );
    }

    return filtered;
  }, [orders, filter, searchQuery]);

  const nextStatus = {
    processing: "packed",
    packed: "shipped",
    shipped: "delivered",
  };

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
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <SectionHeader
          title="Store Orders"
          subtitle="Manage incoming fulfillment"
        />

        {orders.length > 0 &&
          (() => {
            const segColors = {
              processing: colors.primary,
              packed: "#F59E0B",
              shipped: "#06B6D4",
              delivered: "#10B981",
              canceled: "#EF4444",
            };
            const totalOrders = Math.max(
              statusSummary.reduce((s, { total: t }) => s + t, 0),
              1,
            );
            return (
              <View style={styles.pipelineContainer}>
                <View style={styles.pipelineBar}>
                  {statusSummary
                    .filter(({ total: t }) => t > 0)
                    .map(({ status, total: count }) => (
                      <View
                        key={status}
                        style={[
                          styles.pipelineSegment,
                          {
                            flex: count / totalOrders,
                            backgroundColor: segColors[status] || colors.muted,
                          },
                        ]}
                      />
                    ))}
                </View>
                <View style={styles.pipelineLegend}>
                  {statusSummary.map(({ status, total: count }) => (
                    <View key={status} style={styles.legendItem}>
                      <View
                        style={[
                          styles.legendDot,
                          {
                            backgroundColor: segColors[status] || colors.muted,
                          },
                        ]}
                      />
                      <Text style={styles.legendText}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}:{" "}
                        {count}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })()}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.summaryRow}
        >
          {statusSummary.map(({ status, total }) => (
            <View key={status} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{status}</Text>
              <Text style={styles.summaryValue}>{total}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color={colors.muted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by order # or customer..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.muted}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.filters}>
          {statusFilters.map((status) => (
            <Pressable
              key={status}
              style={[
                styles.filterChip,
                filter === status && styles.filterChipActive,
              ]}
              onPress={() => setFilter(status)}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === status && styles.filterTextActive,
                ]}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          numColumns={cardColumns}
          key={String(cardColumns)}
          columnWrapperStyle={cardColumns > 1 ? { gap: 16 } : null}
          contentContainerStyle={{ gap: 16 }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              No orders in this fulfillment lane.
            </Text>
          }
          renderItem={({ item }) => (
            <View style={cardColumns > 1 ? { flex: 1 } : null}>
              <OrderCard
                order={item}
                onPress={() =>
                  navigation.navigate("OrderDetail", { order: item })
                }
                footer={
                  nextStatus[item.status] ? (
                    <TouchableOpacity
                      style={styles.progressButton}
                      onPress={() =>
                        advanceOrderStatus(item.id, nextStatus[item.status])
                      }
                    >
                      <Text style={styles.progressText}>
                        Move to {nextStatus[item.status]}
                      </Text>
                    </TouchableOpacity>
                  ) : item.status === "delivered" ? (
                    <View style={styles.successBadge}>
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color={colors.success}
                      />
                      <Text style={styles.successText}>Delivered</Text>
                    </View>
                  ) : null
                }
              />
            </View>
          )}
        />
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
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
    paddingRight: 6,
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    minWidth: 120,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontWeight: "900",
    color: colors.dark,
    fontSize: 20,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.dark,
    fontSize: 15,
    fontWeight: "500",
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  filterChipActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  filterText: {
    color: colors.muted,
    fontWeight: "600",
    fontSize: 13,
  },
  filterTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  empty: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 60,
  },
  progressButton: {
    marginTop: 18,
    backgroundColor: colors.primaryLight,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  progressText: {
    color: colors.primary,
    fontWeight: "700",
    fontSize: 13,
  },
  successBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 18,
  },
  successText: {
    color: colors.success,
    fontWeight: "700",
    fontSize: 13,
  },
  pipelineContainer: {
    marginBottom: 20,
  },
  pipelineBar: {
    flexDirection: "row",
    height: 10,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#F1F5F9",
  },
  pipelineSegment: {
    height: "100%",
  },
  pipelineLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: "600",
  },
});
