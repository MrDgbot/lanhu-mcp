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
          name: "15s",
          visible: true,
          layerOriginFrame: { x: 32, y: 96, width: 360, height: 48 },
          textInfo: [
            {
              text: "15s",
              color: { red: 30, green: 30, blue: 30, value: "rgba(30,30,30,1)" },
              font: {
                name: "SF Pro Display",
                postScriptName: "SFProDisplay-Semibold",
                type: "Semibold",
                size: 32,
                weight: 600,
                italic: false,
                align: "center",
                lineHeight: { value: 40, unit: "pixels" },
                letterSpacing: { value: 1.2, unit: "pixels" },
              },
            },
          ],
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

export const unrecognizedLegacyTextSketch = {
  device: "iPhone 12 @2x",
  width: 750,
  height: 1334,
  info: [
    {
      ddsType: "textLayer",
      name: "Layer name is not content",
      visible: true,
      ddsOriginFrame: { x: 32, y: 96, width: 360, height: 48 },
      textInfo: [
        {
          color: { value: "rgba(30,30,30,1)" },
          font: { name: "SF Pro Display", type: "Regular", size: 32 },
        },
      ],
    },
  ],
};
