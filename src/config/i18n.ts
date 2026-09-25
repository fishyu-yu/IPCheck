// Locale dictionary is deliberately separate from network data; extend keys as translations are added.
export const messages = {
  en: {
    unknown: 'Unknown',
    notChecked: 'Not checked',
    unsupported: 'Unsupported',
    partial: 'Partial data',
    run: 'Run test',
  },
  zh: { unknown: '未知', notChecked: '未检测', unsupported: '不支持', partial: '部分数据', run: '开始检测' },
};
export type Locale = keyof typeof messages;
