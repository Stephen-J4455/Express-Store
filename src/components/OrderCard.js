import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { StatusPill } from "./StatusPill";

export const OrderCard = ({ order, onPress, footer }) => {
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress?.(order)}
    >
      <View style={styles.orderIconBox}>
        <Ionicons name="receipt-outline" size={20} color={colors.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>#{order.order_number}</Text>
        <Text style={styles.meta}>{order.customer?.name || "Guest"}</Text>
        {order.service_fee > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Service Fee</Text>
            <Text style={styles.detailValue}>
              GH₵{Number(order.service_fee).toLocaleString()}
            </Text>
          </View>
        )}
        {footer}
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <Text style={styles.priceText}>
          GH₵{Number(order.total || 0).toLocaleString()}
        </Text>
        <StatusPill value={order.status} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 12,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  orderIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.dark,
  },
  meta: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 13,
    fontWeight: "500",
  },
  priceText: {
    color: colors.dark,
    fontWeight: "800",
    fontSize: 14,
  },
});
