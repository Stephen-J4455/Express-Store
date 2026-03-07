import { Pressable, StyleSheet, Text, View, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, getTheme } from "../theme/colors";
import { StatusPill } from "./StatusPill";
import { FlashSaleBadge } from "./FlashSaleBadge";

export const ProductCard = ({ product, onPress, flashSale, theme: themeProp }) => {
  const theme = themeProp || getTheme(colors.primary);
  // Handle flash sale data - could be passed directly or from product.flash_sale array
  const activeFlashSale = flashSale || (product.flash_sale && product.flash_sale.length > 0
    ? product.flash_sale.find(fs => fs.is_active && new Date(fs.end_time) > new Date())
    : null);

  // Determine actual price (flash sale price takes priority)
  const actualPrice = activeFlashSale?.flash_price || product.price;
  const hasFlashSale = !!activeFlashSale && new Date(activeFlashSale.end_time) > new Date();
  const displayDiscount = hasFlashSale ? activeFlashSale.discount_percentage : product.discount;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress?.(product)}
    >
      <View style={styles.imageContainer}>
        {product.thumbnails?.[0] && (
          <Image source={{ uri: product.thumbnails[0] }} style={styles.image} />
        )}
        {hasFlashSale && (
          <FlashSaleBadge
            discountPercentage={activeFlashSale.discount_percentage}
            position="top-left"
          />
        )}
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={2}>
              {product.title}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons name="folder-outline" size={12} color={colors.muted} />
              <Text style={styles.metaText}>{product.category || "No category"}</Text>
            </View>
          </View>
          <StatusPill value={product.status} />
        </View>

        <View style={styles.details}>
          <View style={styles.priceRow}>
            {hasFlashSale && (
              <Text style={styles.originalPrice}>
                GH₵{Number(activeFlashSale.original_price || product.price).toLocaleString()}
              </Text>
            )}
            <Text style={[styles.currency, { color: theme.primary }]}>GH₵</Text>
            <Text style={[styles.priceValue, { color: theme.primary }]}>
              {Number(actualPrice || 0).toLocaleString()}
            </Text>
            {hasFlashSale ? (
              <View style={styles.discountBadge}>
                  <Ionicons name="flash" size={12} color="#fff" />
                <Text style={styles.discountText}>
                  {Math.round(activeFlashSale.discount_percentage)}% OFF
                </Text>
              </View>
            ) : (
              product.discount > 0 && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>
                    {product.discount}% OFF
                  </Text>
                </View>
              )
            )}
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="cube-outline" size={12} color={colors.muted} />
            <Text style={styles.metaText}>Stock: {product.quantity || 0}</Text>
          </View>
        </View>

        <View style={styles.footer}>
          {product.badges && product.badges.length > 0 ? (
            <View style={styles.badges}>
              {product.badges.slice(0, 2).map((badge) => (
                <View key={badge} style={[styles.badge, { backgroundColor: theme.primary + '15' }]}>
                  <Text style={[styles.badgeText, { color: theme.primary }]}>{badge}</Text>
                </View>
              ))}
            </View>
          ) : (
             <View style={{ flex: 1 }} />
          )}
          <View style={[styles.viewButton, { backgroundColor: theme.primary + '15' }]}> 
            <Ionicons name="eye-outline" size={16} color={theme.primary} />
            <Text style={[styles.viewButtonText, { color: theme.primary }]}>View</Text>
          </View>
        </View>
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
    overflow: "hidden",
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 16,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  imageContainer: {
    position: "relative",
  },
  image: {
    width: "100%",
    height: 180,
    backgroundColor: "#F8FAFC",
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.dark,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "500",
  },
  details: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
  },
  originalPrice: {
    fontSize: 12,
    color: colors.muted,
    textDecorationLine: "line-through",
    marginRight: 8,
  },
  currency: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
    marginTop: 2,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.primary,
  },
  discountBadge: {
    backgroundColor: "#EF4444",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  discountText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  badges: {
    flexDirection: "row",
    gap: 6,
    flex: 1,
  },
  badge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "600",
  },
  viewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
  },
  viewButtonText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "700",
  },
});
