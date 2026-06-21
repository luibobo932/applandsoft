import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, SafeAreaView, Text } from "react-native";

import {
  ApiError,
  fetchActivity,
  fetchLookups,
  fetchMe,
  fetchProperties,
  fetchPropertyDetail,
  login,
  registerUnauthorizedHandler,
} from "./src/api";
import { defaultApiBaseUrl, getApiBaseUrl, setApiBaseUrl } from "./src/config";
import { AppHeader, TabBar, TabKey } from "./src/components/shared";
import { LoginScreen } from "./src/screens/LoginScreen";
import { PropertyListScreen } from "./src/screens/PropertyListScreen";
import { PropertyDetailScreen } from "./src/screens/PropertyDetailScreen";
import { CreatePropertyScreen } from "./src/screens/CreatePropertyScreen";
import { ActivityScreen } from "./src/screens/ActivityScreen";
import { styles } from "./src/styles";
import {
  cleanDisplayText,
  isAndroidEmulatorRuntime,
  isConnectivityFailure,
  normalizeApiError,
} from "./src/utils";
import {
  ActivityItem,
  CurrentUser,
  LoginPayload,
  LookupCollections,
  PropertyCreatePayload,
  PropertyFilters,
  PropertySummary,
} from "./src/types";

const SESSION_KEY = "landsoft_mobile_session";
const CREATE_DRAFT_KEY = "landsoft_mobile_create_draft";
const API_BASE_URL_KEY = "landsoft_mobile_api_base_url";
const DEBUG_AUTO_LOGIN_USER = process.env.EXPO_PUBLIC_DEBUG_AUTO_LOGIN_USER?.trim();
const DEBUG_AUTO_LOGIN_PASSWORD = process.env.EXPO_PUBLIC_DEBUG_AUTO_LOGIN_PASSWORD?.trim();
const EMULATOR_API_BASE_URL = "http://10.0.2.2:8000/api/v1";

type SessionState = {
  token: string;
  user: CurrentUser;
};

const emptyDraft: PropertyCreatePayload = {
  title: "",
  address: "",
  district_code: "",
  ward_code: "",
  property_type_code: "",
  status_code: "",
  source_code: "",
  street_name: "",
  owner_name: "",
  contact_phone: "",
  price: 0,
  area: 0,
  width: 0,
  length: 0,
  legal_status_code: "",
  direction_code: "",
  grade_code: "",
  description: "",
  note: "",
  listing_type: "ban",
};

const emptyLookups: LookupCollections = {
  districts: [],
  wards: [],
  property_types: [],
  directions: [],
  legal_statuses: [],
  statuses: [],
  sources: [],
  grades: [],
};

const emptyFilters: PropertyFilters = {
  keyword: "",
  district: "",
  ward: "",
  status: "",
  price_min: undefined,
  price_max: undefined,
  area_min: undefined,
  area_max: undefined,
  page: 1,
  page_size: 50,
};

function getPreferredApiBaseUrl(storedApiBaseUrl?: string | null): string {
  // Tren emulator (may dev): cho phep URL da luu de tien test, mac dinh 10.0.2.2
  if (isAndroidEmulatorRuntime()) {
    if (storedApiBaseUrl?.trim()) {
      return setApiBaseUrl(storedApiBaseUrl);
    }
    return setApiBaseUrl(EMULATOR_API_BASE_URL);
  }
  // Tren dien thoai that: luon dung URL production da dong trong APK.
  return setApiBaseUrl(defaultApiBaseUrl);
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [session, setSession] = useState<SessionState | null>(null);
  const [lookups, setLookups] = useState<LookupCollections>(emptyLookups);
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [propertyTotal, setPropertyTotal] = useState(0);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [filters, setFilters] = useState<PropertyFilters>(emptyFilters);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("properties");
  const [propertyLoading, setPropertyLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [draft, setDraft] = useState<PropertyCreatePayload>(emptyDraft);
  const [savingDraft, setSavingDraft] = useState(false);
  const [apiBaseUrlInput, setApiBaseUrlInput] = useState(() => getPreferredApiBaseUrl());

  const handleLogout = useCallback(async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    setSession(null);
    setProperties([]);
    setActivityItems([]);
    setSelectedPropertyId(null);
  }, []);

  // Register 401 handler once so any expired token auto-logs out
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      void handleLogout();
    });
  }, [handleLogout]);

  const title = useMemo(() => {
    if (selectedPropertyId && activeTab === "properties") {
      return "Chi tiết căn";
    }
    if (activeTab === "create") {
      return "Nhập nhà mới";
    }
    if (activeTab === "activity") {
      return "Lịch sử";
    }
    return "Kho hàng";
  }, [activeTab, selectedPropertyId]);

  const saveDraft = useCallback(async (nextDraft: PropertyCreatePayload) => {
    setSavingDraft(true);
    try {
      await AsyncStorage.setItem(CREATE_DRAFT_KEY, JSON.stringify(nextDraft));
    } finally {
      setSavingDraft(false);
    }
  }, []);

  const updateDraft = useCallback(
    (patch: Partial<PropertyCreatePayload>) => {
      setDraft((current) => {
        const next = { ...current, ...patch };
        void saveDraft(next);
        return next;
      });
    },
    [saveDraft]
  );

  const hydrateSession = useCallback(async () => {
    try {
      const [storedSession, storedDraft, storedApiBaseUrl] = await Promise.all([
        AsyncStorage.getItem(SESSION_KEY),
        AsyncStorage.getItem(CREATE_DRAFT_KEY),
        AsyncStorage.getItem(API_BASE_URL_KEY),
      ]);
      setApiBaseUrlInput(getPreferredApiBaseUrl(storedApiBaseUrl));
      if (storedSession) {
        const parsed: SessionState = JSON.parse(storedSession);
        const currentUser = await fetchMe(parsed.token);
        setSession({ token: parsed.token, user: currentUser });
      } else if (DEBUG_AUTO_LOGIN_USER && DEBUG_AUTO_LOGIN_PASSWORD) {
        const response = await login({
          username: DEBUG_AUTO_LOGIN_USER,
          password: DEBUG_AUTO_LOGIN_PASSWORD,
        });
        const nextSession = { token: response.access_token, user: response.user };
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
        setSession(nextSession);
      }
      if (storedDraft) {
        setDraft({ ...emptyDraft, ...JSON.parse(storedDraft) });
      }
    } catch {
      await AsyncStorage.removeItem(SESSION_KEY);
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  const persistApiBaseUrl = useCallback(async (nextValue: string) => {
    const normalized = setApiBaseUrl(nextValue);
    setApiBaseUrlInput(normalized);
    if (normalized === defaultApiBaseUrl) {
      await AsyncStorage.removeItem(API_BASE_URL_KEY);
      return normalized;
    }
    await AsyncStorage.setItem(API_BASE_URL_KEY, normalized);
    return normalized;
  }, []);

  const loadLookups = useCallback(async (token: string) => {
    const data = await fetchLookups(token);
    // Merge with emptyLookups so any missing key keeps its default []
    setLookups({ ...emptyLookups, ...data });
  }, []);

  const loadProperties = useCallback(
    async (token: string, nextFilters: PropertyFilters) => {
      setPropertyLoading(true);
      try {
        const response = await fetchProperties(token, nextFilters);
        setProperties(response.items);
        setPropertyTotal(response.total);
      } catch (error) {
        Alert.alert("Không tải được kho hàng", normalizeApiError(error));
      } finally {
        setPropertyLoading(false);
      }
    },
    []
  );

  // Theo doi so can da tai de tinh trang ke tiep ma khong can dua properties vao deps
  const loadedCountRef = useRef(0);
  useEffect(() => {
    loadedCountRef.current = properties.length;
  }, [properties.length]);

  // Cuon toi dau tai toi do: lay trang ke tiep va noi vao danh sach
  const handleLoadMore = useCallback(async () => {
    if (!session || loadingMore || propertyLoading) {
      return;
    }
    const loaded = loadedCountRef.current;
    if (loaded === 0 || loaded >= propertyTotal) {
      return;
    }
    const pageSize = filters.page_size ?? 50;
    const nextPage = Math.floor(loaded / pageSize) + 1;
    setLoadingMore(true);
    try {
      const response = await fetchProperties(session.token, { ...filters, page: nextPage });
      setProperties((prev) => {
        const seen = new Set(prev.map((item) => item.landsoft_id));
        const fresh = response.items.filter((item) => !seen.has(item.landsoft_id));
        return [...prev, ...fresh];
      });
      setPropertyTotal(response.total);
    } catch (error) {
      Alert.alert("Không tải thêm được", normalizeApiError(error));
    } finally {
      setLoadingMore(false);
    }
  }, [filters, loadingMore, propertyLoading, propertyTotal, session]);

  const loadActivity = useCallback(async (token: string) => {
    setActivityLoading(true);
    try {
      const response = await fetchActivity(token);
      setActivityItems(response);
    } catch (error) {
      Alert.alert("Không tải được lịch sử", normalizeApiError(error));
    } finally {
      setActivityLoading(false);
    }
  }, []);

  const refreshAuthenticatedData = useCallback(
    async (token: string, nextFilters: PropertyFilters) => {
      await Promise.all([loadLookups(token), loadProperties(token, nextFilters), loadActivity(token)]);
    },
    [loadActivity, loadLookups, loadProperties]
  );

  const handleLogin = async (payload: LoginPayload) => {
    setLoginLoading(true);
    try {
      const requestedApiBaseUrl = await persistApiBaseUrl(apiBaseUrlInput);
      let response;
      try {
        response = await login(payload);
      } catch (error) {
        // BUG FIX: only retry with emulator URL when actually running on an emulator
        const shouldRetryOnEmulator =
          isConnectivityFailure(normalizeApiError(error)) &&
          isAndroidEmulatorRuntime() &&
          requestedApiBaseUrl !== EMULATOR_API_BASE_URL;

        if (!shouldRetryOnEmulator) {
          throw error;
        }

        await persistApiBaseUrl(EMULATOR_API_BASE_URL);
        response = await login(payload);
      }

      const nextSession = { token: response.access_token, user: response.user };
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
    } catch (error) {
      Alert.alert("Đăng nhập thất bại", normalizeApiError(error));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleReloadProperties = useCallback(async () => {
    if (!session) {
      return;
    }
    await loadProperties(session.token, filters);
  }, [filters, loadProperties, session]);

  const handleFiltersChange = useCallback((patch: Partial<PropertyFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }
    void refreshAuthenticatedData(session.token, filters);
  }, [refreshAuthenticatedData, session]);

  const handleQuickViewPhone = useCallback(
    async (landsoftId: number) => {
      if (!session) {
        return;
      }
      try {
        const detail = await fetchPropertyDetail(session.token, landsoftId);
        const ownerName = cleanDisplayText(detail.owner_name, "Chưa rõ chủ nhà");
        const phoneNumber = cleanDisplayText(detail.contact_phone, "");
        if (!phoneNumber) {
          Alert.alert("Chưa có số điện thoại", `${ownerName}\nCăn này chưa có số liên hệ.`, [
            { text: "Đóng", style: "cancel" },
            { text: "Mở hồ sơ", onPress: () => setSelectedPropertyId(landsoftId) },
          ]);
          return;
        }

        Alert.alert("Số điện thoại chủ nhà", `${ownerName}\n${phoneNumber}`, [
          { text: "Copy số", onPress: () => void Clipboard.setStringAsync(phoneNumber) },
          { text: "Mở hồ sơ", onPress: () => setSelectedPropertyId(landsoftId) },
          { text: "Đóng", style: "cancel" },
        ]);
      } catch (error) {
        Alert.alert("Không lấy được số điện thoại", normalizeApiError(error));
      }
    },
    [session]
  );

  if (booting) {
    return (
      <SafeAreaView style={styles.screenCenter}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#F37021" />
        <Text style={styles.bootText}>Đang khởi tạo app...</Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <LoginScreen
        apiBaseUrlValue={apiBaseUrlInput}
        loading={loginLoading}
        onChangeApiBaseUrl={setApiBaseUrlInput}
        onUseEmulatorApiBaseUrl={() => setApiBaseUrlInput(EMULATOR_API_BASE_URL)}
        onLogin={handleLogin}
      />
    );
  }

  const isPropertyDetailView = Boolean(selectedPropertyId && activeTab === "properties");

  return (
    <SafeAreaView style={styles.appShell}>
      <StatusBar style="dark" />
      {!isPropertyDetailView ? (
        <AppHeader user={session.user} title={title} onLogout={() => void handleLogout()} />
      ) : null}

      {selectedPropertyId && activeTab === "properties" ? (
        <PropertyDetailScreen
          token={session.token}
          propertyId={selectedPropertyId}
          lookups={lookups}
          onBack={() => setSelectedPropertyId(null)}
          onChanged={async () => {
            await loadProperties(session.token, filters);
            await loadActivity(session.token);
          }}
        />
      ) : null}

      {!selectedPropertyId && activeTab === "properties" ? (
        <PropertyListScreen
          filters={filters}
          items={properties}
          totalCount={propertyTotal}
          lookups={lookups}
          loading={propertyLoading}
          refreshing={propertyLoading}
          loadingMore={loadingMore}
          onChangeFilter={handleFiltersChange}
          onReload={handleReloadProperties}
          onLoadMore={handleLoadMore}
          onOpenProperty={(landsoftId) => setSelectedPropertyId(landsoftId)}
          onQuickViewPhone={handleQuickViewPhone}
          onGoCreate={() => setActiveTab("create")}
        />
      ) : null}

      {activeTab === "create" ? (
        <CreatePropertyScreen
          token={session.token}
          lookups={lookups}
          draft={draft}
          savingDraft={savingDraft}
          onChangeDraft={updateDraft}
          onSubmitSuccess={async () => {
            setActiveTab("properties");
            await Promise.all([loadProperties(session.token, filters), loadActivity(session.token)]);
          }}
        />
      ) : null}

      {activeTab === "activity" ? (
        <ActivityScreen
          items={activityItems}
          loading={activityLoading}
          // BUG FIX: was () => loadActivity(...) — Promise not awaited
          onReload={async () => { await loadActivity(session.token); }}
        />
      ) : null}

      <TabBar
        activeTab={activeTab}
        onChange={(tab) => {
          setSelectedPropertyId(null);
          setActiveTab(tab);
        }}
      />
    </SafeAreaView>
  );
}
