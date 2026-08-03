// Bang style duoc gop tu 11 file con bang toan tu spread. Neu hai file cung dat mot
// ten style thi file sau se GHI DE file truoc ma khong bao loi — man hinh doi giao dien
// ma khong ai biet tai sao. Test nay chan dung truong hop do.
import { activityStyles } from "../styles/activity";
import { callLogsStyles } from "../styles/callLogs";
import { commonStyles } from "../styles/common";
import { customersStyles } from "../styles/customers";
import { formStyles } from "../styles/form";
import { kinglandStyles } from "../styles/kingland";
import { loginStyles } from "../styles/login";
import { navStyles } from "../styles/nav";
import { propertyDetailStyles } from "../styles/propertyDetail";
import { propertyListStyles } from "../styles/propertyList";
import { workspaceStyles } from "../styles/workspace";
import { styles } from "../styles";

const groups: Record<string, object> = {
  activity: activityStyles,
  callLogs: callLogsStyles,
  common: commonStyles,
  customers: customersStyles,
  form: formStyles,
  kingland: kinglandStyles,
  login: loginStyles,
  nav: navStyles,
  propertyDetail: propertyDetailStyles,
  propertyList: propertyListStyles,
  workspace: workspaceStyles,
};

describe("bang style", () => {
  it("khong co ten style nao bi trung giua cac file", () => {
    const owner = new Map<string, string>();
    const clashes: string[] = [];

    for (const [groupName, group] of Object.entries(groups)) {
      for (const styleName of Object.keys(group)) {
        const existing = owner.get(styleName);
        if (existing) {
          clashes.push(`${styleName} (${existing} vs ${groupName})`);
        } else {
          owner.set(styleName, groupName);
        }
      }
    }

    expect(clashes).toEqual([]);
  });

  it("gop du toan bo style cua cac file con", () => {
    const totalInGroups = Object.values(groups).reduce(
      (sum, group) => sum + Object.keys(group).length,
      0
    );
    expect(Object.keys(styles)).toHaveLength(totalInGroups);
  });
});
