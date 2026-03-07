import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../../supabase";
import { useSeller } from "../context/SellerContext";
import { useToast } from "../context/ToastContext";
import { colors, getTheme } from "../theme/colors";
import { ResponsiveContainer } from "../components/ResponsiveContainer";
import { useResponsive } from "../hooks/useResponsive";

export const SellerChatScreen = ({
  route,
  navigation,
  embedded = false,
  conversation: embeddedConversation,
}) => {
  const insets = useSafeAreaInsets();
  const { sellerId, profile } = useSeller();
  const theme = profile?.theme_apply_store
    ? getTheme(profile?.theme_color || colors.primary)
    : getTheme(colors.primary);
  const toast = useToast();
  const conversation = embeddedConversation || route?.params?.conversation;
  const userName =
    conversation?.user?.full_name || conversation?.user?.email || "Customer";

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [inputHeight, setInputHeight] = useState(72);

  // keyboard visibility tracking removed; not needed for padding

  useEffect(() => {
    if (conversation) {
      fetchMessages();
      const subscription = setupRealtimeSubscription();
      return () => {
        if (subscription) subscription.unsubscribe();
      };
    }
  }, [conversation]);

  // Listen for keyboard show/hide to adjust layout
  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = (e) => {
      const height = e?.endCoordinates?.height || 0;
      setKeyboardHeight(height);
    };

    const onHide = () => setKeyboardHeight(0);

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const fetchMessages = async () => {
    if (!conversation) return;

    try {
      const { data, error } = await supabase
        .from("express_chat_messages")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Auto scroll to bottom after messages are loaded
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!conversation) return;

    return supabase
      .channel(`chat-${conversation.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "express_chat_messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        },
      )
      .subscribe();
  };

  useEffect(() => {
    if (messages.length > 0) {
      markAsRead();
    }
  }, [messages]);

  const markAsRead = async () => {
    if (!conversation || !sellerId) return;

    try {
      const { error } = await supabase
        .from("express_chat_messages")
        .update({ is_read: true })
        .eq("conversation_id", conversation.id)
        .neq("sender_id", sellerId)
        .eq("is_read", false);

      if (error) throw error;
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversation || sending || !sellerId) return;

    const messageText = newMessage.trim();
    setSending(true);
    setNewMessage("");

    try {
      const { error } = await supabase.from("express_chat_messages").insert({
        conversation_id: conversation.id,
        sender_id: sellerId,
        sender_type: "seller",
        message: messageText,
      });

      if (error) throw error;

      // Update unread_count logic if needed - normally handled by backend triggers or context
    } catch (error) {
      console.error("Error sending message:", error);
      setNewMessage(messageText);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isSeller = item.sender_type === "seller";

    return (
      <View
        style={[
          styles.messageWrapper,
          isSeller ? styles.sellerWrapper : styles.userWrapper,
        ]}
      >
        <View
          style={[
            styles.messageContainer,
            isSeller
              ? [styles.sellerMessage, { backgroundColor: theme.primary }]
              : styles.userMessage,
          ]}
        >
          <Text
            style={[styles.messageText, isSeller && styles.sellerMessageText]}
          >
            {item.message}
          </Text>
        </View>
        <Text style={styles.messageTime}>
          {new Date(item.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={theme.primary} />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </View>
    );
  }

  const inputPaddingBottom = insets.bottom;

  const headerPaddingTop = embedded ? 10 : insets.top + 10;

  const content = (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: headerPaddingTop }]}>
        <View style={styles.headerContent}>
          {!embedded && (
            <Pressable
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={theme.primary} />
            </Pressable>
          )}
          <View style={styles.headerInfo}>
            <View style={styles.userAvatar}>
              {conversation.user?.avatar_url ? (
                <Image
                  source={{ uri: conversation.user.avatar_url }}
                  style={styles.avatarImg}
                />
              ) : (
                <Ionicons name="person" size={20} color={theme.accent} />
              )}
            </View>
            <View>
              <Text style={styles.headerTitle}>{userName}</Text>
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text style={styles.headerSubtitle}>Customer</Text>
              </View>
            </View>
          </View>
          <Pressable style={styles.headerAction}>
            <Ionicons
              name="ellipsis-vertical"
              size={20}
              color={theme.primary}
            />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={[styles.chatContainer]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top + 70}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[
            styles.messagesList,
            {
              paddingBottom: inputHeight + insets.bottom + keyboardHeight + 16,
            },
          ]}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        <View
          onLayout={(e) => setInputHeight(e.nativeEvent.layout.height)}
          style={[
            styles.inputContainer,
            { marginBottom: keyboardHeight + insets.bottom },
          ]}
        >
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="Type a message..."
              placeholderTextColor={colors.muted}
              multiline
              maxLength={1000}
            />
            <Pressable
              style={[
                styles.sendButton,
                { backgroundColor: theme.primary },
                (!newMessage.trim() || sending) && styles.sendButtonDisabled,
              ]}
              onPress={sendMessage}
              disabled={!newMessage.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );

  return embedded ? (
    content
  ) : (
    <ResponsiveContainer>{content}</ResponsiveContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    padding: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: colors.light,
  },
  headerInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: colors.light,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.dark,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.muted,
  },
  headerAction: {
    padding: 8,
  },
  chatContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.light,
    gap: 8,
  },
  loadingText: {
    color: colors.muted,
    fontSize: 15,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 32,
  },
  messageWrapper: {
    marginBottom: 16,
    maxWidth: "85%",
  },
  userWrapper: {
    alignSelf: "flex-start",
  },
  sellerWrapper: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  messageContainer: {
    padding: 12,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  userMessage: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
  },
  sellerMessage: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.dark,
  },
  sellerMessageText: {
    color: "#fff",
  },
  messageTime: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
    marginHorizontal: 4,
  },
  inputContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: colors.light,
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    maxHeight: 120,
    paddingTop: 8,
    paddingBottom: 8,
    color: colors.dark,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: colors.muted,
    opacity: 0.5,
  },
});
