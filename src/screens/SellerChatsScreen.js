import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Image,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../supabase";
import { useSeller } from "../context/SellerContext";
import { useToast } from "../context/ToastContext";
import { colors, getTheme } from "../theme/colors";
import { ResponsiveContainer } from "../components/ResponsiveContainer";
import { useResponsive } from "../hooks/useResponsive";
import { SellerChatScreen } from "./SellerChatScreen";

export const SellerChatsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { horizontalPadding, isWide } = useResponsive();
  const { chats, loading, refresh, sellerId, profile } = useSeller();
  const theme = profile?.theme_apply_store
    ? getTheme(profile?.theme_color || colors.primary)
    : getTheme(colors.primary);
  const toast = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [statusToDelete, setStatusToDelete] = useState(null);
  const [activeTab, setActiveTab] = useState("messages");
  const [selectedChat, setSelectedChat] = useState(null);

  useEffect(() => {
    if (sellerId) {
      fetchStatuses();
    }
  }, [sellerId]);

  useEffect(() => {
    return () => {};
  }, []);

  const fetchStatuses = async () => {
    if (!sellerId) return;
    try {
      const { data, error } = await supabase
        .from("express_seller_statuses")
        .select("*")
        .eq("seller_id", sellerId)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (!error && data) {
        setStatuses(data);
      }
    } catch (err) {
      console.error("Error fetching statuses:", err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    await fetchStatuses();
    setRefreshing(false);
  };

  const handleDeleteStatus = (status) => {
    setStatusToDelete(status);
    setDeleteConfirmVisible(true);
  };

  const confirmDelete = async () => {
    if (!statusToDelete) return;
    setDeleteConfirmVisible(false);
    deleteStatus(statusToDelete);
  };

  const deleteStatus = async (status) => {
    try {
      // Delete from database
      const { error } = await supabase
        .from("express_seller_statuses")
        .delete()
        .eq("id", status.id);

      if (error) throw error;

      // Delete from storage
      if (status.media_url) {
        const urlParts = status.media_url.split("/seller-statuses/");
        if (urlParts.length > 1) {
          const filePath = urlParts[1].split("?")[0];
          await supabase.storage.from("seller-statuses").remove([filePath]);
        }
      }

      // Update local state
      setStatuses(statuses.filter((s) => s.id !== status.id));
      toast.success("Status deleted successfully");
    } catch (error) {
      console.error("Error deleting status:", error);
      toast.error("Failed to delete status");
    }
  };

  const renderConversation = ({ item }) => {
    const userName = item.user?.full_name || item.user?.email || "Customer";
    const lastMessageText = item.last_message || "No messages yet";
    const timestamp = item.last_message_at
      ? new Date(item.last_message_at)
      : new Date(item.created_at);

    const isSelected = isWide && selectedChat?.id === item.id;

    return (
      <Pressable
        style={[
          styles.conversationItem,
          isSelected && styles.conversationItemSelected,
        ]}
        onPress={() => {
          if (isWide) {
            setSelectedChat(item);
          } else {
            navigation.navigate("SellerChat", { conversation: item });
          }
        }}
      >
        <View style={styles.avatar}>
          {item.user?.avatar_url ? (
            <Image
              source={{ uri: item.user.avatar_url }}
              style={styles.avatarImage}
            />
          ) : (
            <Ionicons name="person" size={24} color={theme.accent} />
          )}
        </View>
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.userName} numberOfLines={1}>
              {userName}
            </Text>
            <Text style={styles.timestamp}>
              {timestamp.toLocaleDateString([], {
                month: "short",
                day: "numeric",
              })}
            </Text>
          </View>
          <Text style={styles.lastMessage} numberOfLines={1}>
            {lastMessageText}
          </Text>
        </View>
        <View style={styles.rightAction}>
          {item.unread_count > 0 && (
            <View
              style={[styles.unreadBadge, { backgroundColor: theme.primary }]}
            >
              <Text style={styles.unreadText}>{item.unread_count}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </View>
      </Pressable>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Loading conversations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>
              {activeTab === "status" ? "My Status" : "Messages"}
            </Text>
            <View style={styles.headerSubtitleRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.headerSubtitle}>Customer Support</Text>
            </View>
          </View>
        </View>

        {/* Tab bar */}
        <View style={styles.tabBar}>
          <Pressable
            style={[
              styles.tabItem,
              activeTab === "messages" && {
                backgroundColor: `${theme.primary}15`,
              },
            ]}
            onPress={() => setActiveTab("messages")}
          >
            <Ionicons
              name="chatbubbles"
              size={18}
              color={activeTab === "messages" ? theme.primary : colors.muted}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "messages" && { color: theme.primary },
              ]}
            >
              Messages
            </Text>
            {chats?.filter((c) => c.unread_count > 0).length > 0 && (
              <View
                style={[styles.tabBadge, { backgroundColor: theme.primary }]}
              >
                <Text style={styles.tabBadgeText}>
                  {chats.filter((c) => c.unread_count > 0).length}
                </Text>
              </View>
            )}
          </Pressable>
          <Pressable
            style={[
              styles.tabItem,
              activeTab === "status" && {
                backgroundColor: `${theme.primary}15`,
              },
            ]}
            onPress={() => setActiveTab("status")}
          >
            <Ionicons
              name="radio"
              size={18}
              color={activeTab === "status" ? theme.primary : colors.muted}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === "status" && { color: theme.primary },
              ]}
            >
              Status
            </Text>
            {statuses.length > 0 && (
              <View
                style={[styles.tabBadge, { backgroundColor: theme.primary }]}
              >
                <Text style={styles.tabBadgeText}>{statuses.length}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {activeTab === "status" ? (
        <ScrollView
          contentContainerStyle={styles.statusTabContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
            />
          }
        >
          <TouchableOpacity
            style={[styles.createStatusBtn, { backgroundColor: theme.primary }]}
            onPress={() => navigation.navigate("StatusCreator")}
          >
            <Ionicons name="add-circle" size={22} color="#fff" />
            <Text style={styles.createStatusBtnText}>Create New Status</Text>
          </TouchableOpacity>

          {statuses.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="radio-outline" size={48} color={theme.accent} />
              </View>
              <Text style={styles.emptyText}>No active statuses</Text>
              <Text style={styles.emptySubtext}>
                Create a status to share{"\n"}updates with your customers.
              </Text>
            </View>
          ) : (
            <View style={styles.statusGrid}>
              {statuses.map((status) => (
                <View key={status.id} style={styles.statusGridCard}>
                  <View style={styles.statusThumbnailContainer}>
                    {status.status_type === "text" ? (
                      status.gradient_start ? (
                        <LinearGradient
                          colors={[
                            status.gradient_start,
                            status.gradient_end || status.gradient_start,
                          ]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.statusGridThumb}
                        >
                          <Text
                            style={[
                              styles.statusThumbnailText,
                              {
                                color: status.text_color || "#fff",
                                fontSize: 12,
                              },
                            ]}
                            numberOfLines={4}
                          >
                            {status.status_text}
                          </Text>
                        </LinearGradient>
                      ) : (
                        <View
                          style={[
                            styles.statusGridThumb,
                            {
                              backgroundColor:
                                status.background_color || "#FF6B6B",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusThumbnailText,
                              {
                                color: status.text_color || "#fff",
                                fontSize: 12,
                              },
                            ]}
                            numberOfLines={4}
                          >
                            {status.status_text}
                          </Text>
                        </View>
                      )
                    ) : (
                      <Image
                        source={{ uri: status.media_url }}
                        style={styles.statusGridThumb}
                      />
                    )}
                    <TouchableOpacity
                      style={styles.deleteStatusButton}
                      onPress={() => handleDeleteStatus(status)}
                    >
                      <Ionicons name="close-circle" size={22} color="#FF3B30" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.statusTime}>
                    {new Date(status.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                  <Text style={styles.statusExpiry}>
                    {Math.round(
                      (new Date(status.expires_at) - new Date()) /
                        (1000 * 60 * 60),
                    )}
                    h left
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      ) : isWide ? (
        <View style={styles.wideChatRow}>
          <View style={styles.chatListPanel}>
            <FlatList
              data={chats}
              keyExtractor={(item) => item.id}
              renderItem={renderConversation}
              contentContainerStyle={styles.listContainer}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={theme.primary}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconContainer}>
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={48}
                      color={theme.accent}
                    />
                  </View>
                  <Text style={styles.emptyText}>No conversations yet</Text>
                  <Text style={styles.emptySubtext}>
                    When customers message you,{"\n"}they will appear here.
                  </Text>
                </View>
              }
            />
          </View>
          <View style={styles.chatDetailPanel}>
            {selectedChat ? (
              <SellerChatScreen
                navigation={navigation}
                embedded={true}
                conversation={selectedChat}
              />
            ) : (
              <View style={styles.noChatSelected}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={56}
                  color={colors.muted}
                />
                <Text style={styles.noChatSelectedText}>
                  Select a conversation
                </Text>
                <Text style={styles.noChatSelectedSub}>
                  Choose a chat from the list to start messaging
                </Text>
              </View>
            )}
          </View>
        </View>
      ) : (
        <ResponsiveContainer>
          <FlatList
            data={chats}
            keyExtractor={(item) => item.id}
            renderItem={renderConversation}
            contentContainerStyle={[
              styles.listContainer,
              { paddingHorizontal: horizontalPadding },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={48}
                    color={theme.accent}
                  />
                </View>
                <Text style={styles.emptyText}>No conversations yet</Text>
                <Text style={styles.emptySubtext}>
                  When customers message you,{"\n"}they will appear here.
                </Text>
              </View>
            }
          />
        </ResponsiveContainer>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        visible={deleteConfirmVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setDeleteConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Status?</Text>
            <Text style={styles.modalMessage}>
              This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setDeleteConfirmVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.deleteButton]}
                onPress={confirmDelete}
              >
                <Text style={styles.deleteButtonText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.light,
    gap: 12,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "500",
  },
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  addStatusButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.dark,
    letterSpacing: -0.5,
  },
  headerSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: "500",
  },
  listContainer: {
    padding: 16,
    paddingTop: 24,
    paddingBottom: 100,
  },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.light,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  userName: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.dark,
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: "500",
  },
  lastMessage: {
    fontSize: 14,
    color: colors.muted,
    fontWeight: "400",
  },
  rightAction: {
    alignItems: "flex-end",
    gap: 8,
    marginLeft: 8,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  unreadText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 100,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 35,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: colors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.dark,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 15,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 22,
  },
  statusScroll: {
    marginTop: 16,
  },
  statusScrollContent: {
    gap: 12,
  },
  statusItem: {
    width: 100,
  },
  statusThumbnailContainer: {
    position: "relative",
  },
  statusThumbnail: {
    width: 100,
    height: 140,
    borderRadius: 12,
    backgroundColor: colors.light,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  statusThumbnailText: {
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
    paddingHorizontal: 6,
  },
  deleteStatusButton: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "#fff",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  statusInfo: {
    marginTop: 6,
  },
  statusTime: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.dark,
  },
  statusExpiry: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "85%",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.dark,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: 24,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: colors.light,
  },
  cancelButtonText: {
    color: colors.dark,
    fontWeight: "600",
    fontSize: 14,
  },
  deleteButton: {
    backgroundColor: "#EF4444",
  },
  deleteButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  // Tab bar
  tabBar: {
    flexDirection: "row",
    marginTop: 14,
    gap: 8,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.light,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
  },
  tabBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 20,
    alignItems: "center",
  },
  tabBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  // Status tab
  statusTabContent: {
    padding: 16,
    paddingBottom: 100,
  },
  createStatusBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 20,
  },
  createStatusBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statusGridCard: {
    width: "30%",
    flexGrow: 1,
    maxWidth: 160,
  },
  statusGridThumb: {
    width: "100%",
    aspectRatio: 9 / 16,
    borderRadius: 12,
    backgroundColor: colors.light,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  // Wide (tablet/desktop) styles
  wideChatRow: {
    flex: 1,
    flexDirection: "row",
  },
  chatListPanel: {
    width: 360,
    borderRightWidth: 1,
    borderRightColor: "#E4E8F0",
    backgroundColor: "#fff",
  },
  chatDetailPanel: {
    flex: 1,
    backgroundColor: colors.light,
  },
  conversationItemSelected: {
    backgroundColor: `${colors.primary}10`,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  noChatSelected: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  noChatSelectedText: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.dark,
  },
  noChatSelectedSub: {
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
  },
});
