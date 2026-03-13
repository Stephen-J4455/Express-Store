import { useState, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
  Modal,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useSeller } from "../context/SellerContext";
import { useToast } from "../context/ToastContext";
import { colors, getTheme } from "../theme/colors";
import { SectionHeader } from "../components/SectionHeader";
import { ProductCard } from "../components/ProductCard";
import { StatusPill } from "../components/StatusPill";
import { supabase } from "../../supabase";
import { flashSaleService } from "../services/flashSaleService";
import { ResponsiveContainer } from "../components/ResponsiveContainer";
import { useResponsive } from "../hooks/useResponsive";

const filters = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "pending", label: "Pending" },
  { key: "draft", label: "Drafts" },
  { key: "rejected", label: "Rejected" },
];

const CatalogScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isWide, gridColumns } = useResponsive();
  const {
    products,
    categories,
    profile,
    settings,
    createProduct,
    updateProduct,
    updateProductStatus,
    refresh,
    loading,
  } = useSeller();
  const theme = profile?.theme_apply_store
    ? getTheme(profile?.theme_color || colors.primary)
    : getTheme(colors.primary);
  const toast = useToast();
  const [filter, setFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [shippingFee, setShippingFee] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [discount, setDiscount] = useState(0);
  const [imageUris, setImageUris] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [selectedColors, setSelectedColors] = useState([]);
  const [quantity, setQuantity] = useState("");
  const [sku, setSku] = useState("");
  const [weight, setWeight] = useState("");
  const [barcode, setBarcode] = useState("");
  const [vendor, setVendor] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [tags, setTags] = useState("");
  const [trackInventory, setTrackInventory] = useState(true);
  const [allowBackorder, setAllowBackorder] = useState(false);
  const [weightUnit, setWeightUnit] = useState("kg");
  const [slug, setSlug] = useState("");
  const [specifications, setSpecifications] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [viewingProduct, setViewingProduct] = useState(null);

  const AVAILABLE_COLORS = [
    { name: "Black", hex: "#000000" },
    { name: "White", hex: "#FFFFFF" },
    { name: "Red", hex: "#EF4444" },
    { name: "Blue", hex: "#3B82F6" },
    { name: "Green", hex: "#10B981" },
    { name: "Yellow", hex: "#F59E0B" },
    { name: "Purple", hex: "#8B5CF6" },
    { name: "Pink", hex: "#EC4899" },
    { name: "Orange", hex: "#F97316" },
    { name: "Brown", hex: "#92400E" },
    { name: "Gray", hex: "#6B7280" },
    { name: "Navy", hex: "#1E3A8A" },
  ];

  const PRODUCT_BADGES = [
    {
      id: "free_shipping",
      label: "Free Shipping",
      icon: "rocket",
      color: "#3B82F6",
    },
    { id: "flash_deal", label: "Flash Deal", icon: "flash", color: "#EF4444" },
    {
      id: "new_arrival",
      label: "New Arrival",
      icon: "sparkles",
      color: "#8B5CF6",
    },
    { id: "bestseller", label: "Bestseller", icon: "trophy", color: "#F59E0B" },
    {
      id: "limited_stock",
      label: "Limited Stock",
      icon: "alert-circle",
      color: "#DC2626",
    },
    { id: "top_rated", label: "Top Rated", icon: "star", color: "#EAB308" },
  ];

  const filteredProducts = useMemo(() => {
    let filtered = products;

    if (filter !== "all") {
      filtered = filtered.filter((p) => p.status === filter);
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter((p) => p.category === categoryFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.category?.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query),
      );
    }

    if (sortBy === "price-desc") {
      filtered = [...filtered].sort(
        (a, b) => Number(b.price || 0) - Number(a.price || 0),
      );
    } else if (sortBy === "price-asc") {
      filtered = [...filtered].sort(
        (a, b) => Number(a.price || 0) - Number(b.price || 0),
      );
    } else if (sortBy === "alpha") {
      filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    }

    return filtered;
  }, [products, filter, categoryFilter, searchQuery, sortBy]);

  const inventorySummary = useMemo(() => {
    const statuses = ["active", "pending", "draft", "rejected"];
    return statuses.map((status) => ({
      status,
      total: products.filter((p) => p.status === status).length,
    }));
  }, [products]);

  const activeFlashSales = useMemo(() => {
    const now = new Date().toISOString();
    return products.flatMap((p) => {
      const sales = Array.isArray(p.flash_sale) ? p.flash_sale : [];
      return sales
        .filter((fs) => fs.is_active && fs.end_time > now)
        .map((fs) => ({ ...fs, product: p }));
    });
  }, [products]);

  const openEditModal = (product) => {
    setEditingProduct(product);
    setTitle(product.title || "");
    setPrice(product.price?.toString() || "");
    setShippingFee(product.shipping_fee?.toString() || "");
    setCategory(product.category || "");
    setDescription(product.description || "");
    setDiscount(product.discount || 0);
    setQuantity(product.quantity?.toString() || "");
    setSku(product.sku || "");
    setWeight(product.weight?.toString() || "");
    setBarcode(product.barcode || "");
    setVendor(product.vendor || "");
    setCompareAtPrice(product.compare_at_price?.toString() || "");
    setCostPrice(product.cost_price?.toString() || "");
    setTags(product.tags?.join(", ") || "");
    setSelectedSizes(product.sizes || []);
    setSelectedColors(product.colors || []);
    setWeightUnit(product.weight_unit || "kg");
    setSlug(product.slug || "");
    setTrackInventory(product.track_inventory ?? true);
    setAllowBackorder(product.allow_backorder ?? false);
    if (product.specifications && typeof product.specifications === "object") {
      const specsArray = Object.entries(product.specifications).map(
        ([key, value]) => ({ key, value }),
      );
      setSpecifications(specsArray);
    } else {
      setSpecifications([]);
    }
    setImageUris([]);
    setModalVisible(true);
  };

  const pickImage = async () => {
    if (imageUris.length >= 5) {
      toast.warning("Maximum images", "You can upload up to 5 images");
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      toast.error("Permission needed", "Please grant camera roll permissions");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
      allowsMultipleSelection: true,
      selectionLimit: 5 - imageUris.length,
    });
    if (!result.canceled) {
      const newUris = result.assets.map((asset) => asset.uri);
      setImageUris((prev) => [...prev, ...newUris]);
    }
  };

  const uploadImage = async (uri) => {
    try {
      // Fetch the image as ArrayBuffer (better compatibility with React Native)
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();

      // Create a unique filename
      const ext = uri.split(".").pop() || "jpg";
      const fileName = `product-${Date.now()}-${Math.random()
        .toString(36)
        .substring(7)}.${ext}`;

      // Convert ArrayBuffer to Uint8Array for upload
      const fileData = new Uint8Array(arrayBuffer);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from("express-products")
        .upload(fileName, fileData, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        console.error("Supabase upload error:", error);
        throw error;
      }

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from("express-products")
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  };

  const uploadImages = async (uris) => {
    const uploadPromises = uris.map((uri) => uploadImage(uri));
    return await Promise.all(uploadPromises);
  };

  const handleProductPress = (product) => {
    setSelectedProduct(product);
    setActionSheetVisible(true);
  };

  const handleActionSheetAction = (action) => {
    setActionSheetVisible(false);
    if (!selectedProduct) return;

    switch (action) {
      case "view":
        setViewingProduct(selectedProduct);
        setDetailModalVisible(true);
        break;
      case "edit":
        openEditModal(selectedProduct);
        break;
      case "duplicate":
        updateProductStatus(selectedProduct.id, "draft");
        break;
      case "toggle_status":
        updateProductStatus(
          selectedProduct.id,
          selectedProduct.status === "active" ? "draft" : "pending",
        );
        break;
      case "flash_sale":
        // Navigate to flash sale screen
        navigation.navigate("FlashSale", { product: selectedProduct });
        break;
    }
  };

  const handleCreateFlashSale = async () => {
    if (!selectedProduct || !flashSalePrice) {
      toast.warning("Missing Info", "Please enter a flash sale price");
      return;
    }

    const price = parseFloat(flashSalePrice);
    const originalPrice = parseFloat(selectedProduct.price);

    if (price >= originalPrice) {
      toast.error(
        "Invalid Price",
        "Flash sale price must be lower than the original price",
      );
      return;
    }

    if (flashSaleEndDate <= flashSaleStartDate) {
      toast.error("Invalid Dates", "End date must be after start date");
      return;
    }

    if (flashSaleMaxQty) {
      const qty = parseInt(flashSaleMaxQty);
      if (isNaN(qty) || qty <= 0) {
        toast.error(
          "Invalid Quantity",
          "Max quantity must be a positive number",
        );
        return;
      }
    }

    setSubmitting(true);
    const { success, error } = await flashSaleService.createFlashSale({
      productId: selectedProduct.id,
      sellerId: profile.id,
      flashPrice: price,
      originalPrice,
      startTime: flashSaleStartDate.toISOString(),
      endTime: flashSaleEndDate.toISOString(),
      maxQuantity: flashSaleMaxQty ? parseInt(flashSaleMaxQty) : null,
    });

    setSubmitting(false);

    if (success) {
      toast.success(
        "Flash Sale Created",
        `Flash sale created for ${selectedProduct.title}`,
      );
      setFlashSaleModalVisible(false);
      setSelectedProduct(null);
    } else {
      toast.error("Error", error || "Failed to create flash sale");
    }
  };

  const submit = async () => {
    if (!title || !price || !category || !quantity) {
      toast.warning(
        "Missing info",
        "Please fill title, price, category, and quantity.",
      );
      return;
    }
    setSubmitting(true);
    try {
      let imageUrls = [];
      if (imageUris.length > 0) {
        imageUrls = await uploadImages(imageUris);
      }

      // Convert specifications array to object
      const specificationsObj = {};
      specifications.forEach((spec) => {
        if (spec.key && spec.value) {
          specificationsObj[spec.key] = spec.value;
        }
      });

      const productData = {
        title,
        price: parseFloat(price),
        shipping_fee: shippingFee ? parseFloat(shippingFee) : 0,
        category,
        description,
        discount,
        sizes: selectedSizes,
        badges: [
          ...(!shippingFee || parseFloat(shippingFee) === 0
            ? ["free_shipping"]
            : []),
          ...(quantity && parseInt(quantity) > 0 ? ["limited_stock"] : []),
        ],
        colors: selectedColors,
        quantity: quantity ? parseInt(quantity) : 0,
        sku: sku || null,
        weight: weight ? parseFloat(weight) : null,
        weight_unit: weightUnit || "kg",
        barcode: barcode || null,
        vendor: vendor || null,
        slug: slug || null,
        compare_at_price: compareAtPrice ? parseFloat(compareAtPrice) : null,
        cost_price: costPrice ? parseFloat(costPrice) : null,
        tags: tags
          ? tags
              .split(",")
              .map((t) => t.trim())
              .filter((t) => t)
          : [],
        track_inventory: trackInventory,
        allow_backorder: allowBackorder,
        specifications:
          Object.keys(specificationsObj).length > 0 ? specificationsObj : null,
      };

      if (imageUrls.length > 0) {
        productData.thumbnails = imageUrls;
      }

      if (editingProduct) {
        // Set status to pending after edit (requires re-approval)
        productData.status = "pending";
        await updateProduct(editingProduct.id, productData);
      } else {
        productData.thumbnails = imageUrls;
        await createProduct(productData);
      }

      setSubmitting(false);
      setTitle("");
      setPrice("");
      setShippingFee("");
      setCategory("");
      setDescription("");
      setDiscount(0);
      setImageUris([]);
      setSelectedSizes([]);
      setSelectedColors([]);
      setQuantity("");
      setSku("");
      setWeight("");
      setBarcode("");
      setVendor("");
      setCompareAtPrice("");
      setCostPrice("");
      setTags("");
      setWeightUnit("kg");
      setSlug("");
      setTrackInventory(true);
      setAllowBackorder(false);
      setSpecifications([]);
      setEditingProduct(null);
      setModalVisible(false);
    } catch (error) {
      toast.error("Error", error.message);
      setSubmitting(false);
    }
  };

  return (
    <ResponsiveContainer>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        <SectionHeader
          title="Store Catalog"
          subtitle={`${products.length} Products`}
          action={
            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
              onPress={() => setModalVisible(true)}
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.primaryButtonText}>Add New</Text>
            </TouchableOpacity>
          }
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.summaryRow}
        >
          {inventorySummary.map(({ status, total }) => (
            <View key={status} style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{status}</Text>
              <Text style={styles.summaryValue}>{total}</Text>
            </View>
          ))}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Categories</Text>
            <Text style={styles.summaryValue}>{categories.length}</Text>
          </View>
        </ScrollView>

        {/* Active Flash Sales */}
        {activeFlashSales.length > 0 && (
          <View style={styles.flashSaleBanner}>
            <View style={styles.flashSaleBannerHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Ionicons name="flash" size={16} color="#EF4444" />
                <Text style={styles.flashSaleBannerTitle}>
                  Active Flash Sales
                </Text>
              </View>
              <View style={styles.flashSaleCountPill}>
                <Text style={styles.flashSaleCountText}>
                  {activeFlashSales.length} live
                </Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.flashSaleScroll}
            >
              {activeFlashSales.map((fs) => {
                const thumb = fs.product.thumbnails?.[0] || null;
                const discountPct =
                  fs.discount_percentage ||
                  Math.round(
                    ((fs.original_price - fs.flash_price) / fs.original_price) *
                      100,
                  );
                const hoursLeft = Math.max(
                  0,
                  Math.round(
                    (new Date(fs.end_time) - new Date()) / (1000 * 60 * 60),
                  ),
                );
                return (
                  <TouchableOpacity
                    key={fs.id}
                    style={styles.flashSaleCard}
                    onPress={() => {
                      setSelectedProduct(fs.product);
                      setActionSheetVisible(true);
                    }}
                  >
                    {thumb ? (
                      <Image
                        source={{ uri: thumb }}
                        style={styles.flashSaleThumb}
                      />
                    ) : (
                      <View
                        style={[
                          styles.flashSaleThumb,
                          styles.flashSaleThumbPlaceholder,
                        ]}
                      >
                        <Ionicons
                          name="image-outline"
                          size={20}
                          color={colors.muted}
                        />
                      </View>
                    )}
                    <View style={styles.flashSaleCardBody}>
                      <Text
                        style={styles.flashSaleProductName}
                        numberOfLines={1}
                      >
                        {fs.product.title}
                      </Text>
                      <View style={styles.flashSalePriceRow}>
                        <Text style={styles.flashSalePrice}>
                          GH₵{Number(fs.flash_price).toLocaleString()}
                        </Text>
                        <View style={styles.flashSaleDiscountBadge}>
                          <Text style={styles.flashSaleDiscountText}>
                            {discountPct}% off
                          </Text>
                        </View>
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Ionicons
                          name="time-outline"
                          size={11}
                          color={hoursLeft <= 3 ? "#EF4444" : colors.muted}
                        />
                        <Text
                          style={[
                            styles.flashSaleExpiry,
                            hoursLeft <= 3 && {
                              color: "#EF4444",
                              fontWeight: "700",
                            },
                          ]}
                        >
                          {hoursLeft}h left
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color={colors.muted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryFilter}
        >
          <Pressable
            style={[
              styles.categoryChip,
              categoryFilter === "all" && styles.categoryChipActive,
            ]}
            onPress={() => setCategoryFilter("all")}
          >
            <Text
              style={[
                styles.categoryChipText,
                categoryFilter === "all" && styles.categoryChipTextActive,
              ]}
            >
              All categories
            </Text>
          </Pressable>
          {categories.map((cat) => (
            <Pressable
              key={cat.id}
              style={[
                styles.categoryChip,
                categoryFilter === cat.name && styles.categoryChipActive,
              ]}
              onPress={() => setCategoryFilter(cat.name)}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  categoryFilter === cat.name && styles.categoryChipTextActive,
                ]}
              >
                {cat.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>Sort</Text>
          <View style={styles.sortChips}>
            {["recent", "price-desc", "price-asc", "alpha"].map((key) => (
              <Pressable
                key={key}
                style={[
                  styles.sortChip,
                  sortBy === key && styles.sortChipActive,
                ]}
                onPress={() => setSortBy(key)}
              >
                <Text
                  style={[
                    styles.sortChipText,
                    sortBy === key && styles.sortChipTextActive,
                  ]}
                >
                  {key === "recent"
                    ? "Recent"
                    : key === "alpha"
                      ? "A-Z"
                      : key === "price-desc"
                        ? "Price ↓"
                        : "Price ↑"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Modal
          visible={modalVisible}
          animationType="slide"
          presentationStyle="overFullScreen"
          statusBarTranslucent
          onRequestClose={() => setModalVisible(false)}
        >
          <ScrollView style={styles.modalContainer}>
            <View
              style={[
                styles.modalContent,
                isWide && { maxWidth: 800, alignSelf: "center", width: "100%" },
              ]}
            >
              <View
                style={[styles.modalHeader, { paddingTop: insets.top + 12 }]}
              >
                <Pressable
                  onPress={() => {
                    setModalVisible(false);
                    setEditingProduct(null);
                  }}
                  style={styles.cancelButton}
                >
                  <Ionicons name="close" size={24} color={theme.primary} />
                </Pressable>
                <Text style={styles.modalTitle}>
                  {editingProduct ? "Edit Product" : "New Product"}
                </Text>
                <View style={{ width: 24 }} />
              </View>
              <View style={styles.form}>
                <View style={isWide ? styles.row : null}>
                  <View style={isWide ? styles.halfInput : null}>
                    <Text style={styles.label}>Title *</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons
                        name="text"
                        size={20}
                        color={colors.muted}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        placeholder="Product name"
                        style={styles.input}
                        value={title}
                        onChangeText={setTitle}
                      />
                    </View>
                  </View>

                  <View style={isWide ? styles.halfInput : null}>
                    <Text style={styles.label}>Brand (Optional)</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons
                        name="business"
                        size={20}
                        color={colors.muted}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        placeholder="e.g., Nike, Apple, Samsung"
                        style={styles.input}
                        value={vendor}
                        onChangeText={setVendor}
                      />
                    </View>
                  </View>
                </View>

                <Text style={styles.label}>Price *</Text>
                <View style={styles.inputContainer}>
                  <Ionicons
                    name="cash"
                    size={20}
                    color={colors.muted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="99.00"
                    style={styles.input}
                    keyboardType="decimal-pad"
                    value={price}
                    onChangeText={setPrice}
                  />
                </View>
                {parseFloat(settings?.service_fee_percentage || "0") > 0 &&
                  parseFloat(price) > 0 && (
                    <View style={styles.serviceFeePreview}>
                      <Ionicons
                        name="information-circle-outline"
                        size={14}
                        color={colors.primary}
                      />
                      <Text style={styles.serviceFeePreviewText}>
                        {(() => {
                          const pct = parseFloat(
                            settings.service_fee_percentage || "0",
                          );
                          const priceNum = parseFloat(price);
                          const fee =
                            Math.round(((priceNum * pct) / 100) * 100) / 100;
                          const youGet =
                            Math.round((priceNum - fee) * 100) / 100;
                          return (
                            "Platform fee (" +
                            pct +
                            "%): GH₵" +
                            fee.toFixed(2) +
                            "  •  You receive: GH₵" +
                            youGet.toFixed(2) +
                            "\nDiscount does not affect the service fee."
                          );
                        })()}
                      </Text>
                    </View>
                  )}

                <Text style={styles.label}>Shipping Fee (GH₵)</Text>
                <View style={styles.inputContainer}>
                  <Ionicons
                    name="car"
                    size={20}
                    color={colors.muted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="0.00 (Free shipping)"
                    style={styles.input}
                    keyboardType="decimal-pad"
                    value={shippingFee}
                    onChangeText={setShippingFee}
                  />
                </View>
                <Text style={styles.hint}>
                  Shipping fee charged to customers for this product. Leave
                  empty or 0 for free shipping.
                </Text>

                <Text style={styles.label}>Description</Text>
                <View style={styles.inputContainer}>
                  <Ionicons
                    name="document-text"
                    size={20}
                    color={colors.muted}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="Product description"
                    style={[styles.input, { height: 80 }]}
                    multiline
                    value={description}
                    onChangeText={setDescription}
                  />
                </View>

                <Text style={styles.label}>Discount (%)</Text>
                <View style={styles.discountRow}>
                  <Pressable
                    style={styles.discountButton}
                    onPress={() => setDiscount(Math.max(0, discount - 5))}
                  >
                    <Ionicons name="remove" size={20} color={theme.accent} />
                  </Pressable>
                  <TextInput
                    style={styles.discountInput}
                    keyboardType="numeric"
                    value={discount.toString()}
                    onChangeText={(text) => {
                      const num = parseInt(text) || 0;
                      setDiscount(Math.min(100, Math.max(0, num)));
                    }}
                    maxLength={3}
                  />
                  <Pressable
                    style={styles.discountButton}
                    onPress={() => setDiscount(Math.min(100, discount + 5))}
                  >
                    <Ionicons name="add" size={20} color={theme.accent} />
                  </Pressable>
                </View>

                <View style={isWide ? styles.row : null}>
                  <View style={isWide ? styles.halfInput : null}>
                    <Text style={styles.label}>Stock Quantity *</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons
                        name="cube"
                        size={20}
                        color={colors.muted}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        placeholder="Available quantity (e.g., 50)"
                        style={styles.input}
                        keyboardType="numeric"
                        value={quantity}
                        onChangeText={setQuantity}
                      />
                    </View>
                  </View>

                  <View style={isWide ? styles.halfInput : null}>
                    <Text style={styles.label}>SKU (Optional)</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons
                        name="pricetags"
                        size={20}
                        color={colors.muted}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        placeholder="Stock Keeping Unit (e.g., PROD-001)"
                        style={styles.input}
                        value={sku}
                        onChangeText={setSku}
                      />
                    </View>
                  </View>
                </View>

                <View style={isWide ? styles.row : null}>
                  <View style={isWide ? styles.halfInput : null}>
                    <Text style={styles.label}>Barcode (Optional)</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons
                        name="barcode"
                        size={20}
                        color={colors.muted}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        placeholder="Product barcode number"
                        style={styles.input}
                        value={barcode}
                        onChangeText={setBarcode}
                      />
                    </View>
                  </View>

                  <View style={isWide ? styles.halfInput : null}>
                    <Text style={styles.label}>Weight (kg, Optional)</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons
                        name="speedometer"
                        size={20}
                        color={colors.muted}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        placeholder="Product weight (e.g., 0.5)"
                        style={styles.input}
                        keyboardType="decimal-pad"
                        value={weight}
                        onChangeText={setWeight}
                      />
                    </View>
                  </View>
                </View>

                <Text style={styles.label}>Category</Text>
                {categories.length === 0 ? (
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 14,
                      marginBottom: 8,
                    }}
                  >
                    No categories available. Please run the seed_categories.sql
                    file.
                  </Text>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.categoryContainer}
                  >
                    {categories.map((cat) => (
                      <Pressable
                        key={cat.id}
                        style={[
                          styles.categoryCard,
                          {
                            backgroundColor: cat.color || colors.light,
                            borderColor:
                              category === cat.name
                                ? theme.primary
                                : "transparent",
                            borderWidth: category === cat.name ? 2 : 0,
                          },
                        ]}
                        onPress={() => setCategory(cat.name)}
                      >
                        <View style={styles.categoryIconWrap}>
                          <Ionicons
                            name={cat.icon || "apps-outline"}
                            size={20}
                            color={colors.dark}
                          />
                        </View>
                        <Text numberOfLines={2} style={styles.categoryLabel}>
                          {cat.name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}

                <Text style={styles.label}>Upload Images (up to 5)</Text>
                <Pressable
                  style={[styles.imagePicker, { borderColor: theme.primary }]}
                  onPress={pickImage}
                >
                  <View style={styles.imagePickerContent}>
                    <Ionicons name="image" size={40} color={theme.primary} />
                    <Text
                      style={[styles.imagePickerText, { color: theme.primary }]}
                    >
                      {imageUris.length > 0
                        ? `${imageUris.length} image${imageUris.length > 1 ? "s" : ""} selected`
                        : "Tap to select images"}
                    </Text>
                  </View>
                </Pressable>
                {imageUris.length > 0 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.imagePreviewContainer}
                  >
                    {imageUris.map((uri, index) => (
                      <View key={index} style={styles.imagePreviewWrapper}>
                        <Image source={{ uri }} style={styles.previewImage} />
                        <Pressable
                          style={styles.removeImageButton}
                          onPress={() => {
                            setImageUris((prev) =>
                              prev.filter((_, i) => i !== index),
                            );
                          }}
                        >
                          <Ionicons name="close-circle" size={24} color="red" />
                        </Pressable>
                      </View>
                    ))}
                  </ScrollView>
                )}

                <Text style={styles.label}>Badges</Text>

                <Text style={styles.label}>Sizes (Optional)</Text>
                <View style={styles.sizeOptions}>
                  {[
                    "XS",
                    "S",
                    "M",
                    "L",
                    "XL",
                    "XXL",
                    "6",
                    "7",
                    "8",
                    "9",
                    "10",
                    "11",
                    "12",
                  ].map((size) => (
                    <Pressable
                      key={size}
                      style={[
                        styles.sizeChip,
                        selectedSizes.includes(size) && styles.sizeChipSelected,
                      ]}
                      onPress={() => {
                        setSelectedSizes((prev) =>
                          prev.includes(size)
                            ? prev.filter((s) => s !== size)
                            : [...prev, size],
                        );
                      }}
                    >
                      <Text
                        style={[
                          styles.sizeText,
                          selectedSizes.includes(size) &&
                            styles.sizeTextSelected,
                        ]}
                      >
                        {size}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.label}>Colors (Optional)</Text>
                <View style={styles.colorsGrid}>
                  {AVAILABLE_COLORS.map((color) => {
                    const isSelected = selectedColors.includes(color.name);
                    return (
                      <Pressable
                        key={color.name}
                        style={[
                          styles.colorOption,
                          isSelected && styles.colorOptionSelected,
                        ]}
                        onPress={() => {
                          setSelectedColors((prev) =>
                            prev.includes(color.name)
                              ? prev.filter((c) => c !== color.name)
                              : [...prev, color.name],
                          );
                        }}
                      >
                        <View
                          style={[
                            styles.colorCircle,
                            { backgroundColor: color.hex },
                            color.name === "White" && {
                              borderWidth: 1,
                              borderColor: "#E5E7EB",
                            },
                          ]}
                        />
                        <Text style={styles.colorText}>{color.name}</Text>
                        {isSelected && (
                          <Ionicons
                            name="checkmark-circle"
                            size={18}
                            color={theme.primary}
                            style={styles.colorCheckmark}
                          />
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                <View style={isWide ? styles.row : null}>
                  <View style={isWide ? styles.halfInput : null}>
                    <Text style={styles.label}>Tags (Optional)</Text>
                    <Text style={styles.hint}>
                      Comma-separated keywords for search
                    </Text>
                    <View style={styles.inputContainer}>
                      <Ionicons
                        name="pricetags-outline"
                        size={20}
                        color={colors.muted}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        placeholder="e.g., summer, sale, trending"
                        style={styles.input}
                        value={tags}
                        onChangeText={setTags}
                      />
                    </View>
                  </View>

                  <View style={isWide ? styles.halfInput : null}>
                    <Text style={styles.label}>Product Slug</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons
                        name="link-outline"
                        size={20}
                        color={colors.muted}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        placeholder="URL-friendly name (optional)"
                        style={styles.input}
                        value={slug}
                        onChangeText={setSlug}
                      />
                    </View>
                  </View>
                </View>

                <Text style={styles.label}>Weight Details</Text>
                <View style={styles.row}>
                  <View style={styles.halfInput}>
                    <Text style={styles.hint}>Weight</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons
                        name="scale-outline"
                        size={20}
                        color={colors.muted}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        placeholder="e.g., 2.5"
                        style={styles.input}
                        value={weight}
                        onChangeText={setWeight}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                  <View style={styles.halfInput}>
                    <Text style={styles.hint}>Unit</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons
                        name="menu-outline"
                        size={20}
                        color={colors.muted}
                        style={styles.inputIcon}
                      />
                      <TextInput
                        placeholder="kg, g, lb"
                        style={styles.input}
                        value={weightUnit}
                        onChangeText={setWeightUnit}
                      />
                    </View>
                  </View>
                </View>

                <Text style={styles.label}>Specifications</Text>
                <View style={{ gap: 12 }}>
                  {specifications.map((spec, index) => (
                    <View key={index} style={styles.row}>
                      <View style={styles.halfInput}>
                        <Text style={styles.hint}>Specification Name</Text>
                        <View style={styles.inputContainer}>
                          <Ionicons
                            name="tag-outline"
                            size={20}
                            color={colors.muted}
                            style={styles.inputIcon}
                          />
                          <TextInput
                            placeholder="e.g., Material"
                            style={styles.input}
                            value={spec.key}
                            onChangeText={(text) => {
                              const updated = [...specifications];
                              updated[index].key = text;
                              setSpecifications(updated);
                            }}
                          />
                        </View>
                      </View>
                      <View style={styles.halfInput}>
                        <Text style={styles.hint}>Value</Text>
                        <View style={styles.inputContainer}>
                          <Ionicons
                            name="checkmark-outline"
                            size={20}
                            color={colors.muted}
                            style={styles.inputIcon}
                          />
                          <TextInput
                            placeholder="e.g., Cotton"
                            style={styles.input}
                            value={spec.value}
                            onChangeText={(text) => {
                              const updated = [...specifications];
                              updated[index].value = text;
                              setSpecifications(updated);
                            }}
                          />
                        </View>
                      </View>
                      <Pressable
                        style={styles.removeButton}
                        onPress={() => {
                          setSpecifications(
                            specifications.filter((_, i) => i !== index),
                          );
                        }}
                      >
                        <Ionicons
                          name="close-circle"
                          size={24}
                          color="#EF4444"
                        />
                      </Pressable>
                    </View>
                  ))}
                  <Pressable
                    style={styles.addButton}
                    onPress={() => {
                      setSpecifications([
                        ...specifications,
                        { key: "", value: "" },
                      ]);
                    }}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={20}
                      color={theme.primary}
                    />
                    <Text style={styles.addButtonText}>Add Specification</Text>
                  </Pressable>
                </View>

                <Text style={styles.label}>Inventory Settings</Text>
                <View style={styles.settingsRow}>
                  <View style={styles.settingItem}>
                    <View style={styles.settingLeft}>
                      <Ionicons
                        name="analytics"
                        size={20}
                        color={theme.primary}
                      />
                      <View style={styles.settingTextContainer}>
                        <Text style={styles.settingTitle}>Track Inventory</Text>
                        <Text style={styles.settingDescription}>
                          Monitor stock levels
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      style={[
                        styles.toggle,
                        trackInventory && { backgroundColor: theme.primary },
                      ]}
                      onPress={() => setTrackInventory(!trackInventory)}
                    >
                      <View
                        style={[
                          styles.toggleThumb,
                          trackInventory && styles.toggleThumbActive,
                        ]}
                      />
                    </Pressable>
                  </View>

                  <View style={styles.settingItem}>
                    <View style={styles.settingLeft}>
                      <Ionicons
                        name="infinite"
                        size={20}
                        color={theme.primary}
                      />
                      <View style={styles.settingTextContainer}>
                        <Text style={styles.settingTitle}>Allow Backorder</Text>
                        <Text style={styles.settingDescription}>
                          Sell when out of stock
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      style={[
                        styles.toggle,
                        allowBackorder && { backgroundColor: theme.primary },
                      ]}
                      onPress={() => setAllowBackorder(!allowBackorder)}
                    >
                      <View
                        style={[
                          styles.toggleThumb,
                          allowBackorder && styles.toggleThumbActive,
                        ]}
                      />
                    </Pressable>
                  </View>
                </View>

                <Pressable
                  style={[
                    styles.primaryButton,
                    {
                      marginTop: 16,
                      backgroundColor: theme.primary,
                      borderColor: theme.primary,
                    },
                    submitting && styles.primaryButtonDisabled,
                  ]}
                  onPress={submit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons
                        name={
                          editingProduct ? "checkmark-circle" : "add-circle"
                        }
                        size={20}
                        color="#fff"
                      />
                      <Text style={styles.primaryButtonText}>
                        {editingProduct ? "Update Product" : "Create Product"}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </Modal>

        {/* Action Sheet Modal */}
        <Modal
          visible={actionSheetVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setActionSheetVisible(false)}
        >
          <Pressable
            style={[
              styles.actionSheetOverlay,
              isWide && { justifyContent: "center", alignItems: "center" },
            ]}
            onPress={() => setActionSheetVisible(false)}
          >
            <View
              style={[
                styles.actionSheetContainer,
                isWide && {
                  width: 420,
                  alignSelf: "center",
                },
              ]}
            >
              <Pressable
                style={[
                  styles.actionSheetContent,
                  isWide && {
                    borderRadius: 20,
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                  },
                ]}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={styles.actionSheetHeader}>
                  <Text style={styles.actionSheetTitle}>
                    {selectedProduct?.title}
                  </Text>
                  <Text style={styles.actionSheetSubtitle}>
                    Choose an action
                  </Text>
                </View>

                <Pressable
                  style={styles.actionSheetButton}
                  onPress={() => handleActionSheetAction("view")}
                >
                  <Ionicons
                    name="eye-outline"
                    size={22}
                    color={theme.primary}
                  />
                  <Text style={styles.actionSheetButtonText}>View Details</Text>
                </Pressable>

                <Pressable
                  style={styles.actionSheetButton}
                  onPress={() => handleActionSheetAction("edit")}
                >
                  <Ionicons
                    name="create-outline"
                    size={22}
                    color={theme.primary}
                  />
                  <Text style={styles.actionSheetButtonText}>Edit Product</Text>
                </Pressable>

                <Pressable
                  style={styles.actionSheetButton}
                  onPress={() => handleActionSheetAction("duplicate")}
                >
                  <Ionicons
                    name="copy-outline"
                    size={22}
                    color={colors.muted}
                  />
                  <Text style={styles.actionSheetButtonText}>
                    Duplicate as Draft
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.actionSheetButton}
                  onPress={() => handleActionSheetAction("flash_sale")}
                >
                  <Ionicons name="flash-outline" size={22} color="#EF4444" />
                  <Text
                    style={[styles.actionSheetButtonText, { color: "#EF4444" }]}
                  >
                    Create Flash Sale
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.actionSheetButton}
                  onPress={() => handleActionSheetAction("toggle_status")}
                >
                  <Ionicons
                    name={
                      selectedProduct?.status === "active"
                        ? "pause-circle-outline"
                        : "play-circle-outline"
                    }
                    size={22}
                    color={
                      selectedProduct?.status === "active"
                        ? "#F59E0B"
                        : "#10B981"
                    }
                  />
                  <Text style={styles.actionSheetButtonText}>
                    {selectedProduct?.status === "active"
                      ? "Pause Listing"
                      : "Request Activation"}
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.actionSheetButton,
                    styles.actionSheetCancelButton,
                  ]}
                  onPress={() => setActionSheetVisible(false)}
                >
                  <Text style={styles.actionSheetCancelText}>Cancel</Text>
                </Pressable>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        {/* Product Detail Modal */}
        <Modal
          visible={detailModalVisible}
          animationType="slide"
          onRequestClose={() => setDetailModalVisible(false)}
          statusBarTranslucent
        >
          <View style={styles.detailModal}>
            <ScrollView style={styles.detailContent}>
              <Pressable
                onPress={() => setDetailModalVisible(false)}
                style={styles.detailFloatingBackButton}
              >
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </Pressable>

              {viewingProduct?.thumbnails &&
                viewingProduct.thumbnails.length > 0 && (
                  <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    style={styles.detailImageScroll}
                  >
                    {viewingProduct.thumbnails.map((imageUri, index) => (
                      <Image
                        key={index}
                        source={{ uri: imageUri }}
                        style={styles.detailImage}
                      />
                    ))}
                  </ScrollView>
                )}

              <View style={styles.detailSection}>
                <View style={styles.detailTitleRow}>
                  <Text style={styles.detailTitle}>
                    {viewingProduct?.title}
                  </Text>
                  <StatusPill value={viewingProduct?.status} />
                </View>

                <View style={styles.detailPriceRow}>
                  <View>
                    <Text style={styles.detailPriceLabel}>Selling Price</Text>
                    <Text style={styles.detailPrice}>
                      ${Number(viewingProduct?.price || 0).toFixed(2)}
                    </Text>
                  </View>
                  {viewingProduct?.compare_at_price && (
                    <View>
                      <Text style={styles.detailPriceLabel}>
                        Original Price
                      </Text>
                      <Text style={styles.detailPriceCompare}>
                        ${Number(viewingProduct.compare_at_price).toFixed(2)}
                      </Text>
                    </View>
                  )}
                  {viewingProduct?.cost_price && (
                    <View>
                      <Text style={styles.detailPriceLabel}>Cost Price</Text>
                      <Text style={styles.detailPriceCost}>
                        ${Number(viewingProduct.cost_price).toFixed(2)}
                      </Text>
                    </View>
                  )}
                </View>

                {viewingProduct?.description && (
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailLabel}>Description</Text>
                    <Text style={styles.detailText}>
                      {viewingProduct.description}
                    </Text>
                  </View>
                )}

                <View style={styles.detailGrid}>
                  <View style={styles.detailGridItem}>
                    <Text style={styles.detailLabel}>Category</Text>
                    <Text style={styles.detailText}>
                      {viewingProduct?.category || "—"}
                    </Text>
                  </View>
                  <View style={styles.detailGridItem}>
                    <Text style={styles.detailLabel}>Stock</Text>
                    <Text style={styles.detailText}>
                      {viewingProduct?.quantity || 0}
                    </Text>
                  </View>
                </View>

                {viewingProduct?.sku && (
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailLabel}>SKU</Text>
                    <Text style={styles.detailText}>{viewingProduct.sku}</Text>
                  </View>
                )}

                {viewingProduct?.barcode && (
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailLabel}>Barcode</Text>
                    <Text style={styles.detailText}>
                      {viewingProduct.barcode}
                    </Text>
                  </View>
                )}

                {viewingProduct?.vendor && (
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailLabel}>Brand</Text>
                    <Text style={styles.detailText}>
                      {viewingProduct.vendor}
                    </Text>
                  </View>
                )}

                {viewingProduct?.weight && (
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailLabel}>Weight</Text>
                    <Text style={styles.detailText}>
                      {viewingProduct.weight} kg
                    </Text>
                  </View>
                )}

                {viewingProduct?.sizes && viewingProduct.sizes.length > 0 && (
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailLabel}>Sizes</Text>
                    <View style={styles.detailChips}>
                      {viewingProduct.sizes.map((size) => (
                        <View key={size} style={styles.detailChip}>
                          <Text style={styles.detailChipText}>{size}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {viewingProduct?.colors && viewingProduct.colors.length > 0 && (
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailLabel}>Colors</Text>
                    <View style={styles.detailChips}>
                      {viewingProduct.colors.map((color) => (
                        <View key={color} style={styles.detailChip}>
                          <Text style={styles.detailChipText}>{color}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {viewingProduct?.badges && viewingProduct.badges.length > 0 && (
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailLabel}>Badges</Text>
                    <View style={styles.detailChips}>
                      {viewingProduct.badges.map((badge) => (
                        <View
                          key={badge}
                          style={[styles.detailChip, styles.detailBadge]}
                        >
                          <Text style={styles.detailBadgeText}>{badge}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {viewingProduct?.tags && viewingProduct.tags.length > 0 && (
                  <View style={styles.detailBlock}>
                    <Text style={styles.detailLabel}>Tags</Text>
                    <View style={styles.detailChips}>
                      {viewingProduct.tags.map((tag) => (
                        <View key={tag} style={styles.detailChip}>
                          <Text style={styles.detailChipText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.detailBlock}>
                  <Text style={styles.detailLabel}>Inventory Settings</Text>
                  <View style={styles.detailSettingRow}>
                    <Text style={styles.detailSettingLabel}>
                      Track Inventory
                    </Text>
                    <Text style={styles.detailSettingValue}>
                      {viewingProduct?.track_inventory ? "Yes" : "No"}
                    </Text>
                  </View>
                  <View style={styles.detailSettingRow}>
                    <Text style={styles.detailSettingLabel}>
                      Allow Backorder
                    </Text>
                    <Text style={styles.detailSettingValue}>
                      {viewingProduct?.allow_backorder ? "Yes" : "No"}
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>
            {/* Detail Modal Footer Actions */}
            <View style={styles.detailFooter}>
              <Pressable
                style={styles.detailFooterBtn}
                onPress={() => {
                  setDetailModalVisible(false);
                  openEditModal(viewingProduct);
                }}
              >
                <Ionicons
                  name="create-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.detailFooterBtnText}>Edit Product</Text>
              </Pressable>
              <Pressable
                style={[styles.detailFooterBtn, styles.detailFooterBtnPrimary]}
                onPress={() => {
                  setDetailModalVisible(false);
                  navigation.navigate("Chats");
                }}
              >
                <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
                <Text style={[styles.detailFooterBtnText, { color: "#fff" }]}>
                  Buyer Chats
                </Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <View style={styles.filters}>
          {filters.map(({ key, label }) => (
            <Pressable
              key={key}
              style={[styles.chip, filter === key && styles.chipActive]}
              onPress={() => setFilter(key)}
            >
              <Text
                style={[
                  styles.chipText,
                  filter === key && styles.chipTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <FlatList
          key={String(gridColumns)}
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          numColumns={gridColumns}
          columnWrapperStyle={gridColumns > 1 ? { gap: 14 } : null}
          contentContainerStyle={{ gap: 14, paddingBottom: 140 }}
          scrollEnabled={false}
          ListEmptyComponent={
            <Text style={styles.empty}>No products for this filter.</Text>
          }
          renderItem={({ item }) => (
            <View style={gridColumns > 1 ? { flex: 1 } : null}>
              <ProductCard
                product={item}
                onPress={() => handleProductPress(item)}
                theme={theme}
              />
            </View>
          )}
        />
      </ScrollView>
    </ResponsiveContainer>
  );
};

export default CatalogScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
    paddingTop: 50,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.muted,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
    marginLeft: 8,
  },
  form: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E4E8F0",
    marginBottom: 18,
  },
  label: {
    fontWeight: "600",
    color: colors.dark,
    marginTop: 12,
    marginBottom: 6,
  },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
    paddingRight: 6,
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E4E8F0",
    minWidth: 110,
  },
  summaryLabel: {
    color: colors.muted,
    textTransform: "capitalize",
  },
  summaryValue: {
    fontWeight: "800",
    color: colors.dark,
    marginTop: 4,
    fontSize: 18,
  },
  // Flash sale banner
  flashSaleBanner: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FEE2E2",
    padding: 14,
    marginBottom: 14,
  },
  flashSaleBannerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  flashSaleBannerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#EF4444",
  },
  flashSaleCountPill: {
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  flashSaleCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#EF4444",
  },
  flashSaleScroll: {
    gap: 10,
  },
  flashSaleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5F5",
    borderRadius: 12,
    padding: 10,
    gap: 10,
    width: 220,
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  flashSaleThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: "#f1f1f1",
  },
  flashSaleThumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  flashSaleCardBody: {
    flex: 1,
    gap: 3,
  },
  flashSaleProductName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.dark,
  },
  flashSalePriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  flashSalePrice: {
    fontSize: 14,
    fontWeight: "800",
    color: "#EF4444",
  },
  flashSaleDiscountBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  flashSaleDiscountText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  flashSaleExpiry: {
    fontSize: 11,
    color: colors.muted,
  },
  categoryFilter: {
    gap: 8,
    paddingVertical: 4,
    marginBottom: 10,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sortLabel: {
    color: colors.muted,
    fontWeight: "700",
  },
  sortChips: {
    flexDirection: "row",
    gap: 8,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E4E8F0",
  },
  sortChipActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  sortChipText: {
    color: colors.dark,
    fontWeight: "600",
  },
  sortChipTextActive: {
    color: "#fff",
  },
  categoryTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.light,
  },
  tagText: {
    color: colors.dark,
  },
  imagePicker: {
    backgroundColor: colors.light,
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: "dashed",
    alignItems: "center",
  },
  imagePickerContent: {
    alignItems: "center",
  },
  imagePickerText: {
    color: colors.primary,
    fontWeight: "600",
    marginTop: 8,
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    marginTop: 8,
  },
  imagePreviewContainer: {
    marginTop: 8,
  },
  imagePreviewWrapper: {
    position: "relative",
    marginRight: 8,
  },
  removeImageButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "white",
    borderRadius: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E4E8F0",
  },
  chipActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  chipText: {
    color: colors.dark,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#fff",
  },
  empty: {
    color: colors.muted,
    marginTop: 40,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.light,
  },
  modalContent: {
    padding: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: colors.dark,
    flex: 1,
    textAlign: "center",
  },
  cancelButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: colors.light,
  },
  closeText: {
    color: colors.primary,
    fontWeight: "600",
  },
  badgeOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badgeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.light,
  },
  badgeChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  badgeText: {
    color: colors.dark,
  },
  badgeTextSelected: {
    color: "#fff",
  },
  sizeOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sizeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.light,
    minWidth: 50,
    alignItems: "center",
  },
  sizeChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sizeText: {
    color: colors.dark,
    fontWeight: "600",
  },
  sizeTextSelected: {
    color: "#fff",
  },
  colorsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  colorOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.light,
    gap: 8,
  },
  colorOptionSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  colorCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  colorText: {
    fontSize: 14,
    color: colors.dark,
    fontWeight: "500",
  },
  colorCheckmark: {
    marginLeft: 4,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#D8DDE8",
    borderRadius: 12,
    backgroundColor: colors.light,
    marginTop: 6,
  },
  picker: {
    height: 50,
    color: colors.dark,
  },
  categoryContainer: {
    paddingVertical: 8,
    gap: 12,
  },
  categoryCard: {
    width: 100,
    height: 100,
    borderRadius: 12,
    padding: 12,
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.dark,
    textAlign: "center",
  },
  hint: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 8,
    marginTop: -4,
  },
  serviceFeePreview: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  serviceFeePreviewText: {
    flex: 1,
    fontSize: 12,
    color: "#1E40AF",
    lineHeight: 18,
  },
  badgesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  badgeOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.light,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  badgeOptionText: {
    fontSize: 13,
    color: colors.dark,
    fontWeight: "600",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.light,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#D8DDE8",
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: colors.dark,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#D8DDE8",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.dark,
    fontSize: 16,
  },
  discountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  halfInput: {
    flex: 1,
  },
  discountButton: {
    backgroundColor: colors.light,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D8DDE8",
  },
  discountInput: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.dark,
    textAlign: "center",
    minWidth: 50,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#D8DDE8",
    borderRadius: 8,
    backgroundColor: colors.light,
  },
  hint: {
    fontSize: 12,
    color: colors.muted,
    marginTop: -4,
    marginBottom: 8,
  },
  settingsRow: {
    gap: 12,
    marginTop: 8,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.light,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D8DDE8",
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.dark,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: colors.muted,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#D1D5DB",
    padding: 2,
    justifyContent: "center",
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 22 }],
  },
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  actionSheetContainer: {
    justifyContent: "flex-end",
  },
  actionSheetContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 34,
    paddingHorizontal: 20,
  },
  actionSheetHeader: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    marginBottom: 8,
  },
  actionSheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.dark,
    marginBottom: 4,
  },
  actionSheetSubtitle: {
    fontSize: 14,
    color: colors.muted,
  },
  actionSheetButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginVertical: 4,
    backgroundColor: colors.light,
    gap: 12,
  },
  actionSheetButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.dark,
    flex: 1,
  },
  actionSheetCancelButton: {
    marginTop: 8,
    backgroundColor: "#FEE2E2",
  },
  actionSheetCancelText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#DC2626",
    textAlign: "center",
    flex: 1,
  },
  detailModal: {
    flex: 1,
    backgroundColor: "#fff",
  },
  detailFooter: {
    flexDirection: "row",
    padding: 16,
    paddingBottom: 28,
    gap: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  detailFooterBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.primary + "40",
    backgroundColor: colors.light,
  },
  detailFooterBtnPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  detailFooterBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
  },
  detailFloatingBackButton: {
    position: "absolute",
    top: 50,
    left: 16,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  detailContent: {
    flex: 1,
  },
  detailImageScroll: {
    maxHeight: 300,
  },
  detailImage: {
    width: Dimensions.get("window").width,
    height: 300,
    backgroundColor: "#F3F4F6",
  },
  detailSection: {
    padding: 20,
  },
  detailTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 12,
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.dark,
    flex: 1,
  },
  detailPriceRow: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  detailPriceLabel: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 4,
  },
  detailPrice: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.primary,
  },
  detailPriceCompare: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.muted,
    textDecorationLine: "line-through",
  },
  detailPriceCost: {
    fontSize: 20,
    fontWeight: "600",
    color: "#6B7280",
  },
  detailBlock: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.muted,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailText: {
    fontSize: 16,
    color: colors.dark,
    lineHeight: 24,
  },
  detailGrid: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 20,
  },
  detailGridItem: {
    flex: 1,
  },
  detailChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  detailChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.light,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  detailChipText: {
    fontSize: 13,
    color: colors.dark,
    fontWeight: "500",
  },
  detailBadge: {
    backgroundColor: colors.primary + "20",
    borderColor: colors.primary,
  },
  detailBadgeText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "600",
  },
  detailSettingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  detailSettingLabel: {
    fontSize: 15,
    color: colors.dark,
  },
  detailSettingValue: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F0F5FF",
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: "dashed",
  },
  addButtonText: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: 14,
  },
  removeButton: {
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 12,
  },
});
