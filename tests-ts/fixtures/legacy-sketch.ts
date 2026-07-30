export const legacyInfoSketch = {
  device: "iPhone 12 @2x",
  psdName: "legacy-home.psd",
  width: 750,
  height: 1334,
  info: [
    {
      ddsType: "groupLayer",
      name: "Content",
      visible: true,
      ddsOriginFrame: { x: 0, y: 0, width: 750, height: 1334 },
      layers: [
        {
          ddsType: "textLayer",
          name: "Legacy title",
          visible: true,
          layerOriginFrame: { x: 32, y: 96, width: 360, height: 48 },
          textInfo: {
            text: "Legacy Home",
            color: { red: 30, green: 30, blue: 30 },
            size: 32,
            fontPostScriptName: "PingFangSC-Medium",
          },
        },
        {
          ddsType: "shapeLayer",
          name: "Legacy card",
          visible: true,
          ddsOriginFrame: { x: 32, y: 180, width: 686, height: 320 },
          fills: [
            { isEnabled: true, color: { value: "rgba(255,255,255,1)" } },
          ],
        },
        {
          ddsType: "bitmapLayer",
          name: "Legacy icon",
          visible: true,
          ddsOriginFrame: { x: 640, y: 220, width: 48, height: 48 },
          ddsImage: {
            imageUrl: "https://cdn.example.com/legacy-icon.png",
            size: "48x48",
          },
        },
      ],
    },
  ],
};
