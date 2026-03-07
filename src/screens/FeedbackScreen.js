import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Image,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSeller } from "../context/SellerContext";
import { useToast } from "../context/ToastContext";
import { colors, getTheme } from "../theme/colors";
import { Header } from "../components/Header";
import { ResponsiveContainer } from "../components/ResponsiveContainer";
import { useResponsive } from "../hooks/useResponsive";

export const FeedbackScreen = ({ embedded = false }) => {
  const { reviews, products, replyToReview, refreshData, loading, profile } =
    useSeller();
  const toast = useToast();
  const { horizontalPadding, cardColumns } = useResponsive();
  const theme = getTheme(profile?.theme_color);
  const [replyText, setReplyText] = useState("");
  const [selectedReview, setSelectedReview] = useState(null);

  const ratingDistribution = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => {
      const star = Math.round(Number(r.rating || r.stars || 0));
      if (star >= 1 && star <= 5) counts[star]++;
    });
    const avg =
      reviews.length > 0
        ? reviews.reduce((s, r) => s + Number(r.rating || r.stars || 0), 0) /
          reviews.length
        : 0;
    return { counts, avg: Math.round(avg * 10) / 10 };
  }, [reviews]);

  const getProductName = (productId) => {
    const product = products.find((p) => p.id === productId);
    return product ? product.title : "Unknown Product";
  };

  const getProduct = (productId) =>
    products.find((p) => p.id === productId) || null;

  // Per-product stats: avg rating + review count
  const productStats = useMemo(() => {
    const map = {};
    reviews.forEach((r) => {
      if (!r.product_id) return;
      if (!map[r.product_id]) map[r.product_id] = { sum: 0, count: 0 };
      map[r.product_id].sum += Number(r.rating || r.stars || 0);
      map[r.product_id].count += 1;
    });
    return map;
  }, [reviews]);

  const reviewedProducts = useMemo(
    () =>
      products
        .filter((p) => productStats[p.id])
        .map((p) => ({
          ...p,
          reviewCount: productStats[p.id].count,
          avgRating:
            Math.round(
              (productStats[p.id].sum / productStats[p.id].count) * 10,
            ) / 10,
        }))
        .sort((a, b) => b.reviewCount - a.reviewCount),
    [products, productStats],
  );

  const handleReply = async () => {
    if (!replyText.trim()) return;

    try {
      await replyToReview(selectedReview.id, replyText);
      toast.success("Your reply has been posted!");
      setReplyText("");
      setSelectedReview(null);
      refreshData();
    } catch (error) {
      toast.error("Could not post reply");
    }
  };

  const renderReviewItem = ({ item }) => {
    const product = getProduct(item.product_id);
    const thumb = product?.thumbnails?.[0] || product?.thumbnail || null;
    return (
      <View style={styles.card}>
        {/* Product strip */}
        {product && (
          <View style={styles.productStrip}>
            {thumb ? (
              <Image source={{ uri: thumb }} style={styles.productThumb} />
            ) : (
              <View
                style={[styles.productThumb, styles.productThumbPlaceholder]}
              >
                <Ionicons name="bag-outline" size={16} color={colors.muted} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.productStripTitle} numberOfLines={1}>
                {product.title}
              </Text>
              <Text style={styles.productStripMeta} numberOfLines={1}>
                {product.category || "General"} · GH₵
                {Number(product.price || 0).toLocaleString()}
              </Text>
            </View>
          </View>
        )}
        <View style={styles.cardHeader}>
          <View style={styles.userInfo}>
            <View
              style={[styles.avatar, { backgroundColor: `${theme.primary}20` }]}
            >
              <Text style={[styles.avatarText, { color: theme.primary }]}>
                {(item.express_profiles?.full_name || "U").charAt(0)}
              </Text>
            </View>
            <View>
              <Text style={styles.userName}>
                {item.express_profiles?.full_name || "Anonymous"}
              </Text>
              <Text style={styles.productName}>
                {getProductName(item.product_id)}
              </Text>
            </View>
          </View>
          <StatusPill rating={item.rating} />
        </View>

        <Text style={styles.commentText}>{item.comment}</Text>
        <Text style={styles.dateText}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>

        <TouchableOpacity
          style={styles.replyButton}
          onPress={() => setSelectedReview(item)}
        >
          <Ionicons name="chatbubble-outline" size={16} color={theme.primary} />
          <Text style={[styles.replyButtonText, { color: theme.primary }]}>
            Reply to Customer
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={embedded ? { flex: 1 } : styles.container}>
      {!embedded && <Header title="Customer Feedback" />}

      <ResponsiveContainer>
        <FlatList
          data={reviews}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={cardColumns > 1 ? { flex: 1 } : undefined}>
              {renderReviewItem({ item })}
            </View>
          )}
          numColumns={cardColumns}
          key={"feedback-" + String(cardColumns)}
          columnWrapperStyle={
            cardColumns > 1
              ? { gap: 12, paddingHorizontal: horizontalPadding }
              : undefined
          }
          contentContainerStyle={[
            styles.list,
            cardColumns === 1 && { paddingHorizontal: horizontalPadding },
          ]}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refreshData} />
          }
          ListHeaderComponent={
            reviews.length > 0 ? (
              <>
                <View style={styles.ratingCard}>
                  <View style={styles.ratingRow}>
                    <View style={styles.ratingBig}>
                      <Text style={styles.ratingNumber}>
                        {ratingDistribution.avg}
                      </Text>
                      <View style={styles.starsRow}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Ionicons
                            key={s}
                            name={
                              s <= Math.round(ratingDistribution.avg)
                                ? "star"
                                : "star-outline"
                            }
                            size={12}
                            color="#F59E0B"
                          />
                        ))}
                      </View>
                      <Text style={styles.ratingCount}>
                        {reviews.length} reviews
                      </Text>
                    </View>
                    <View style={styles.histogramBars}>
                      {[5, 4, 3, 2, 1].map((star) => {
                        const count = ratingDistribution.counts[star];
                        const maxCount = Math.max(
                          ...Object.values(ratingDistribution.counts),
                          1,
                        );
                        return (
                          <View key={star} style={styles.histogramRow}>
                            <Text style={styles.histogramStar}>{star}</Text>
                            <Ionicons
                              name="star"
                              size={9}
                              color={theme.accent}
                            />
                            <View style={styles.histogramTrack}>
                              <View
                                style={[
                                  styles.histogramFill,
                                  {
                                    width: `${(count / maxCount) * 100}%`,
                                    backgroundColor: theme.accent,
                                  },
                                ]}
                              />
                            </View>
                            <Text style={styles.histogramCount}>{count}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>

                {/* Per-product breakdown */}
                {reviewedProducts.length > 0 && (
                  <View style={[styles.ratingCard, { marginBottom: 16 }]}>
                    <Text style={styles.sectionLabel}>Reviews by Product</Text>
                    {reviewedProducts.map((p) => {
                      const thumb = p.thumbnails?.[0] || p.thumbnail || null;
                      return (
                        <View key={p.id} style={styles.productReviewRow}>
                          {thumb ? (
                            <Image
                              source={{ uri: thumb }}
                              style={styles.productReviewThumb}
                            />
                          ) : (
                            <View
                              style={[
                                styles.productReviewThumb,
                                styles.productThumbPlaceholder,
                              ]}
                            >
                              <Ionicons
                                name="bag-outline"
                                size={14}
                                color={colors.muted}
                              />
                            </View>
                          )}
                          <View style={{ flex: 1, gap: 4 }}>
                            <View
                              style={{
                                flexDirection: "row",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <Text
                                style={styles.productReviewName}
                                numberOfLines={1}
                              >
                                {p.title}
                              </Text>
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 3,
                                }}
                              >
                                <Ionicons
                                  name="star"
                                  size={11}
                                  color="#F59E0B"
                                />
                                <Text style={styles.productReviewAvg}>
                                  {p.avgRating}
                                </Text>
                                <Text style={styles.productReviewCount}>
                                  ({p.reviewCount})
                                </Text>
                              </View>
                            </View>
                            <View style={styles.histogramTrack}>
                              <View
                                style={[
                                  styles.histogramFill,
                                  {
                                    width: `${(p.avgRating / 5) * 100}%`,
                                    backgroundColor: theme.accent,
                                  },
                                ]}
                              />
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="star-outline" size={64} color={colors.muted} />
              <Text style={styles.emptyText}>No reviews yet</Text>
            </View>
          }
        />
      </ResponsiveContainer>

      <Modal
        visible={!!selectedReview}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedReview(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setSelectedReview(null)}
          />
          <View style={styles.replyContainer}>
            <View style={styles.replyHeader}>
              <Text style={styles.replyTitle}>
                Replying to{" "}
                {selectedReview?.express_profiles?.full_name || "Customer"}
              </Text>
              <TouchableOpacity onPress={() => setSelectedReview(null)}>
                <Ionicons name="close" size={24} color={colors.dark} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Type your reply here..."
              value={replyText}
              onChangeText={setReplyText}
              multiline
              autoFocus
            />
            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: theme.primary }]}
              onPress={handleReply}
            >
              <Text style={styles.sendButtonText}>Send Reply</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const StatusPill = ({ rating }) => (
  <View
    style={[
      styles.pill,
      {
        backgroundColor:
          rating >= 4 ? colors.successLight : colors.warningLight,
      },
    ]}
  >
    <Ionicons
      name="star"
      size={12}
      color={rating >= 4 ? colors.success : colors.warning}
    />
    <Text
      style={[
        styles.pillText,
        { color: rating >= 4 ? colors.success : colors.warning },
      ]}
    >
      {rating}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E4E8F0",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontWeight: "800",
  },
  userName: {
    fontWeight: "700",
    color: colors.dark,
  },
  productName: {
    fontSize: 12,
    color: colors.muted,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  commentText: {
    fontSize: 14,
    color: colors.dark,
    lineHeight: 20,
    marginBottom: 8,
  },
  dateText: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 16,
  },
  replyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  replyButtonText: {
    fontWeight: "600",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  replyContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  replyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  replyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.dark,
  },
  input: {
    backgroundColor: colors.light,
    borderRadius: 12,
    padding: 16,
    height: 120,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  sendButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 100,
  },
  emptyText: {
    marginTop: 16,
    color: colors.muted,
    fontSize: 16,
    fontWeight: "600",
  },
  productStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 8,
    marginBottom: 12,
  },
  productThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  productThumbPlaceholder: {
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  productStripTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.dark,
  },
  productStripMeta: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.dark,
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  productReviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  productReviewThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  productReviewName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.dark,
    flex: 1,
    marginRight: 8,
  },
  productReviewAvg: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.dark,
  },
  productReviewCount: {
    fontSize: 11,
    color: colors.muted,
  },
  ratingCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E4E8F0",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  ratingBig: {
    alignItems: "center",
    minWidth: 64,
  },
  ratingNumber: {
    fontSize: 40,
    fontWeight: "900",
    color: colors.dark,
    lineHeight: 44,
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
    marginTop: 4,
  },
  ratingCount: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
  },
  histogramBars: {
    flex: 1,
    gap: 5,
  },
  histogramRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  histogramStar: {
    fontSize: 11,
    color: colors.muted,
    width: 8,
  },
  histogramTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 4,
    overflow: "hidden",
  },
  histogramFill: {
    height: "100%",
    borderRadius: 4,
  },
  histogramCount: {
    fontSize: 11,
    color: colors.muted,
    width: 20,
    textAlign: "right",
  },
});
