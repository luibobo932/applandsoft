// Bang style cua app, gop tu cac file con theo tung man hinh.
//
// Truoc day tat ca nam trong mot file styles.ts gan 3.700 dong. Moi file con tu goi
// StyleSheet.create nen TypeScript van bao loi neu go sai ten style.
import { activityStyles } from "./activity";
import { callLogsStyles } from "./callLogs";
import { commonStyles } from "./common";
import { customersStyles } from "./customers";
import { formStyles } from "./form";
import { kinglandStyles } from "./kingland";
import { loginStyles } from "./login";
import { navStyles } from "./nav";
import { propertyDetailStyles } from "./propertyDetail";
import { propertyListStyles } from "./propertyList";
import { workspaceStyles } from "./workspace";

export const styles = {
  ...activityStyles,
  ...callLogsStyles,
  ...commonStyles,
  ...customersStyles,
  ...formStyles,
  ...kinglandStyles,
  ...loginStyles,
  ...navStyles,
  ...propertyDetailStyles,
  ...propertyListStyles,
  ...workspaceStyles,
};
