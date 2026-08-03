// Man hinh dang nhap.
import { StyleSheet } from "react-native";

export const loginStyles = StyleSheet.create({
  loginScreen: {
    flex: 1,
    backgroundColor: "#F3F6FB",
    justifyContent: "center",
    padding: 18,
  },
  loginPanel: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 22,
    gap: 14,
    borderWidth: 1,
    borderColor: "#DCE3EE",
    shadowColor: "#17305D",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  loginTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#17305D",
  },
  loginDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: "#64748B",
  },
  loginCancelButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 12,
    marginTop: 10,
  },
  loginCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#5B6B85",
  },
});
