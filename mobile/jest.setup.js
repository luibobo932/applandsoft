// AsyncStorage la native module — trong test khong co may that nen phai dung ban gia lap
// chinh chu cua thu vien (luu trong bo nho).
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);
