import { useRef, useState } from "react";
import { PanResponder, View } from "react-native";

import { styles } from "../styles";

const THUMB = 26;

export function RangeSlider({
  min,
  max,
  step = 1,
  low,
  high,
  onChange,
}: {
  min: number;
  max: number;
  step?: number;
  low: number;
  high: number;
  onChange: (low: number, high: number) => void;
}) {
  const [width, setWidth] = useState(0);

  // Tat ca du lieu cho PanResponder doc qua ref de tranh capture closure cu (luc width=0)
  const widthRef = useRef(0);
  const cfgRef = useRef({ min, max, step });
  const lowRef = useRef(low);
  const highRef = useRef(high);
  const onChangeRef = useRef(onChange);
  const activeRef = useRef<"low" | "high">("low");
  const trackLeftRef = useRef(0);
  cfgRef.current = { min, max, step };
  lowRef.current = low;
  highRef.current = high;
  onChangeRef.current = onChange;

  const trackWidth = () => Math.max(widthRef.current - THUMB, 1);

  const xToValue = (x: number) => {
    const { min: lo, max: hi, step: st } = cfgRef.current;
    const tw = trackWidth();
    const span = Math.max(hi - lo, 1);
    const clampedX = Math.min(Math.max(x, 0), tw);
    const raw = lo + (clampedX / tw) * span;
    const stepped = Math.round(raw / st) * st;
    return Math.min(hi, Math.max(lo, stepped));
  };

  // Keo thumb dang active; vuot qua thumb kia thi doi vai -> luon tach ra duoc
  const apply = (value: number) => {
    if (activeRef.current === "low") {
      if (value <= highRef.current) {
        onChangeRef.current(value, highRef.current);
      } else {
        activeRef.current = "high";
        onChangeRef.current(highRef.current, value);
      }
    } else if (value >= lowRef.current) {
      onChangeRef.current(lowRef.current, value);
    } else {
      activeRef.current = "low";
      onChangeRef.current(value, lowRef.current);
    }
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const { locationX, pageX } = event.nativeEvent;
        trackLeftRef.current = pageX - locationX;
        const value = xToValue(locationX - THUMB / 2);
        activeRef.current =
          Math.abs(value - lowRef.current) <= Math.abs(value - highRef.current) ? "low" : "high";
        apply(value);
      },
      onPanResponderMove: (event) => {
        const x = event.nativeEvent.pageX - trackLeftRef.current - THUMB / 2;
        apply(xToValue(x));
      },
    })
  ).current;

  const span = Math.max(max - min, 1);
  const trackW = Math.max(width - THUMB, 1);
  const lowX = ((low - min) / span) * trackW;
  const highX = ((high - min) / span) * trackW;

  return (
    <View
      style={styles.rangeSliderTrackWrap}
      onLayout={(event) => {
        widthRef.current = event.nativeEvent.layout.width;
        setWidth(event.nativeEvent.layout.width);
      }}
      {...responder.panHandlers}
    >
      <View style={styles.rangeSliderTrack} />
      <View
        style={[
          styles.rangeSliderActive,
          { left: lowX + THUMB / 2, width: Math.max(highX - lowX, 0) },
        ]}
      />
      <View pointerEvents="none" style={[styles.rangeSliderThumb, { left: lowX }]} />
      <View pointerEvents="none" style={[styles.rangeSliderThumb, { left: highX }]} />
    </View>
  );
}
