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
  const lowRef = useRef(low);
  const highRef = useRef(high);
  const startXRef = useRef(0);
  lowRef.current = low;
  highRef.current = high;

  const trackW = Math.max(width - THUMB, 1);
  const span = Math.max(max - min, 1);

  const valueToX = (value: number) => ((value - min) / span) * trackW;
  const xToValue = (x: number) => {
    const raw = min + (x / trackW) * span;
    const stepped = Math.round(raw / step) * step;
    return Math.min(max, Math.max(min, stepped));
  };

  const makeResponder = (which: "low" | "high") =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        startXRef.current = valueToX(which === "low" ? lowRef.current : highRef.current);
      },
      onPanResponderMove: (_event, gesture) => {
        const value = xToValue(startXRef.current + gesture.dx);
        if (which === "low") {
          onChange(Math.min(value, highRef.current), highRef.current);
        } else {
          onChange(lowRef.current, Math.max(value, lowRef.current));
        }
      },
    });

  const lowResponder = useRef(makeResponder("low")).current;
  const highResponder = useRef(makeResponder("high")).current;

  const lowX = valueToX(low);
  const highX = valueToX(high);

  return (
    <View
      style={styles.rangeSliderTrackWrap}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <View style={styles.rangeSliderTrack} />
      <View
        style={[
          styles.rangeSliderActive,
          { left: lowX + THUMB / 2, width: Math.max(highX - lowX, 0) },
        ]}
      />
      <View
        {...lowResponder.panHandlers}
        style={[styles.rangeSliderThumb, { left: lowX }]}
      />
      <View
        {...highResponder.panHandlers}
        style={[styles.rangeSliderThumb, { left: highX }]}
      />
    </View>
  );
}
