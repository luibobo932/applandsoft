// Lich su thao tac + trang thai rong.
import { StyleSheet } from "react-native";

export const activityStyles = StyleSheet.create({
  emptyListContainer: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyStateText: {
    color: "#64748B",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  bootText: {
    color: "#53657D",
  },
  activityListContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  activityListEmpty: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  activityHeroCard: {
    marginBottom: 14,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#DCE3EE",
    backgroundColor: "#ffffff",
  },
  activityHeroStatsRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  activityHeroStat: {
    flex: 1,
    minHeight: 82,
    borderRadius: 20,
    backgroundColor: "#F7F9FC",
    borderWidth: 1,
    borderColor: "#E6EDF5",
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "center",
  },
  activityHeroStatValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#17305D",
  },
  activityHeroStatLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "#7C8BA1",
  },
  activityRow: {
    marginBottom: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#DCE3EE",
    backgroundColor: "#ffffff",
    padding: 16,
  },
  activityRowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 6,
  },
  activityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  activityBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  activityAction: {
    fontSize: 14,
    fontWeight: "800",
    color: "#17305D",
    flex: 1,
  },
  activityMeta: {
    fontSize: 13,
    color: "#7C8BA1",
    lineHeight: 20,
  },
  activityResult: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: "#425466",
  },
});
