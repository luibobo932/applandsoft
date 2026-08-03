// Luoi an toan cho ca app.
//
// Truoc day mot loi JavaScript bat ky (VD backend tra ve du lieu la) lam trang man hinh,
// nguoi dung chi con cach vao Cai dat de "Buoc dung" app. Gio se hien mot man hinh
// giai thich + nut "Tai lai" de dung tiep ma khong phai thoat app.
import { Component, ErrorInfo, ReactNode } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Giu lai trong logcat de con doi chieu khi nguoi dung bao loi
    console.error("[HomeApp] Loi khong bat duoc:", error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <SafeAreaView style={boundaryStyles.screen}>
        <View style={boundaryStyles.card}>
          <Text style={boundaryStyles.title}>HomeApp gặp sự cố</Text>
          <Text style={boundaryStyles.hint}>
            App vừa gặp lỗi ngoài dự tính. Bấm "Tải lại" để dùng tiếp — dữ liệu đang nhập dở
            vẫn được giữ trong máy.
          </Text>
          <ScrollView style={boundaryStyles.detailBox}>
            <Text style={boundaryStyles.detailText}>{error.message || String(error)}</Text>
          </ScrollView>
          <Pressable style={boundaryStyles.button} onPress={this.handleReset}>
            <Text style={boundaryStyles.buttonText}>Tải lại</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }
}

// Style de rieng trong file nay: man hinh loi phai hien duoc ngay ca khi
// bang style chung cua app la thu bi loi.
const boundaryStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F3F6FB",
    justifyContent: "center",
    padding: 18,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DCE3EE",
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 19,
    fontWeight: "700",
    color: "#17305D",
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    color: "#5B6B85",
  },
  detailBox: {
    maxHeight: 160,
    backgroundColor: "#F6F8FC",
    borderRadius: 12,
    padding: 12,
  },
  detailText: {
    fontSize: 12,
    color: "#7C8BA1",
  },
  button: {
    backgroundColor: "#F37021",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
