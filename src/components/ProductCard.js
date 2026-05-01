import { Pressable, StyleSheet, Text, View, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, getTheme } from "../theme/colors";
import { StatusPill } from "./StatusPill";
import { FlashSaleBadge } from "./FlashSaleBadge";

const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes";
  }
  return false;
};

export const ProductCard = ({
  product,
  onPress,
  flashSale,
  theme: themeProp,
}) => {
  const theme = themeProp || getTheme(colors.primary);
  const hasInventoryValue = product?.quantity != null || product?.stock != null;
  const availableStock = Number(product?.quantity ?? product?.stock ?? 0);
  const isPreorder = toBoolean(product?.is_preorder);
  const isOutOfStock = !isPreorder && hasInventoryValue && availableStock <= 0;
  // Handle flash sale data - could be passed directly or from product.flash_sale array
  const activeFlashSale =
    flashSale ||
    (product.flash_sale && product.flash_sale.length > 0
      ? product.flash_sale.find(
          (fs) => fs.is_active && new Date(fs.end_time) > new Date(),
        )
      : null);

  // Determine actual price (flash sale price takes priority)
  const actualPrice = activeFlashSale?.flash_price || product.price;
  const hasFlashSale =
    !!activeFlashSale && new Date(activeFlashSale.end_time) > new Date();
  const displayDiscount = hasFlashSale
    ? activeFlashSale.discount_percentage
    : product.discount;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isOutOfStock && styles.outOfStockCard,
        pressed && styles.cardPressed,
      ]}
      onPress={() => onPress?.(product)}
    >
      <View style={styles.imageContainer}>
        {product.thumbnails?.[0] && (
          <Image source={{ uri: product.thumbnails[0] }} style={styles.image} />
        )}
        {hasFlashSale ? (
          <FlashSaleBadge
            discountPercentage={activeFlashSale.discount_percentage}
            position="top-left"
          />
        ) : product.discount > 0 ? (
          <View style={styles.discountOverlay}>
            <Text style={styles.discountOverlayText}>
              {product.discount}% OFF
            </Text>
          </View>
        ) : null}
        {isPreorder && (
          <View style={styles.preorderOverlay}>
            <Text style={styles.preorderOverlayText}>Preorder</Text>
          </View>
        )}
        {isOutOfStock && (
          <View style={styles.outOfStockOverlay}>
            <Text style={styles.outOfStockOverlayText}>Out of Stock</Text>
          </View>
        )}
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {product.title}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons name="folder-outline" size={12} color={colors.muted} />
              <Text style={styles.metaText} numberOfLines={1}>
                {product.category || "No category"}
              </Text>
            </View>
          </View>
          <StatusPill value={product.status} />
        </View>

        <View style={styles.details}>
          <View style={styles.priceRow}>
            <Text style={[styles.currency, { color: theme.primary }]}>GH₵</Text>
            <Text style={[styles.priceValue, { color: theme.primary }]}>
              {Number(actualPrice || 0).toLocaleString()}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="cube-outline" size={12} color={colors.muted} />
            <Text style={[styles.metaText, isOutOfStock && styles.stockDanger]}>
              {isPreorder
                ? "Preorder"
                : isOutOfStock
                  ? "Out of stock"
                  : hasInventoryValue
                    ? `Stock: ${availableStock}`
                    : "Stock: --"}
            </Text>
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
  outOfStockCard: {
    opacity: 0.72,
  },
  imageContainer: {
    position: "relative",
  },
  outOfStockOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(31,41,55,0.9)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    zIndex: 10,
  },
  outOfStockOverlayText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
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
  stockDanger: {
    color: colors.accent,
    fontWeight: "700",
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
  discountOverlay: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#EF4444",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  discountOverlayText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  preorderOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#0EA5E9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  preorderOverlayText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
});
