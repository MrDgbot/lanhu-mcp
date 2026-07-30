export const legacyInfoSketch = {
  device: "iOS @1x",
  width: 375,
  height: 667,
  // Sanitized from the observed info-layer shape. Text styles exist, but textInfo/text do not.
  info: [
    {
      ddsType: "textLayer",
      name: "Time",
      color: { value: "rgba(0,0,0,1)" },
      size: 15,
      justification: "center",
      visible: true,
      layerOriginFrame: { x: 21.3, y: 14, width: 54, height: 20 },
    },
    {
      ddsType: "textLayer",
      name: "Сіздің несиеңіз дайы",
      color: { value: "rgba(51,51,51,1)" },
      size: 16,
      justification: "center",
      visible: true,
      layerOriginFrame: { x: 66, y: 161, width: 243, height: 44 },
    },
    {
      ddsType: "textLayer",
      name: "15s",
      color: { value: "rgba(16,128,61,1)" },
      size: 40,
      justification: "left",
      visible: true,
      layerOriginFrame: { x: 155, y: 94, width: 64, height: 49 },
    },
    {
      ddsType: "textLayer",
      name: "Your loan amount is",
      color: { value: "rgba(51,51,51,1)" },
      size: 12,
      justification: "left",
      visible: true,
      layerOriginFrame: { x: 34, y: 254, width: 307, height: 14 },
    },
    {
      ddsType: "textLayer",
      name: "Сіздің несие балыңыз",
      color: { value: "rgba(102,102,102,1)" },
      size: 14,
      justification: "left",
      visible: true,
      layerOriginFrame: { x: 71, y: 246, width: 270, height: 36 },
    },
    {
      ddsType: "textLayer",
      name: "Несие сомасын есепте",
      color: { value: "rgba(153,153,153,1)" },
      size: 14,
      justification: "left",
      visible: true,
      layerOriginFrame: { x: 71, y: 322, width: 228, height: 18 },
    },
    {
      ddsType: "textLayer",
      name: "Несие қаражатын сәйк",
      color: { value: "rgba(153,153,153,1)" },
      size: 14,
      justification: "left",
      visible: true,
      layerOriginFrame: { x: 71, y: 388, width: 274, height: 17 },
    },
    {
      ddsType: "textLayer",
      name: "Банк төлем арнасын т",
      color: { value: "rgba(153,153,153,1)" },
      size: 14,
      justification: "left",
      visible: true,
      layerOriginFrame: { x: 71, y: 456, width: 270, height: 17 },
    },
  ],
};

export const unstyledLegacyInfoSketch = {
  device: "iOS @1x",
  width: 375,
  height: 667,
  info: [
    {
      ddsType: "textLayer",
      name: "Your loan amount is",
      visible: true,
      layerOriginFrame: { x: 34, y: 254, width: 307, height: 14 },
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
