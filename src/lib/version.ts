export interface ReleaseNote {
  version: string
  date: string
  title: string
  highlights: string[]
}

export interface TechFact {
  label: string
  value: string
}

export const APP_NAME = 'Luma 拾光'
export const APP_TAGLINE = '本地优先的智能图片管家'
export const APP_VERSION = __APP_VERSION__

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.0.0',
    date: '2026-10-20',
    title: '首个公开版本',
    highlights: [
      '本地智能归类：人物、风景、美食、夜景、截图、文档、日常七个相册自动成形，一张照片可同时属于多个相册',
      '画质体检与清理建议：感知哈希找出重复与相似，清晰度、曝光与分辨率逐张打分，并汇总可释放空间',
      '自然语言检索：本地关键词与标签始终可用，开启云端增强后叠加向量召回与重排排序',
      '沉浸幻灯片：支持全部照片或单相册范围、三档切换间隔、随机播放与缓慢推镜动效',
      '背景音乐：四首实时合成曲目随幻灯片播放，可上传自定义音频、可调音量，默认静音',
      '云端增强（可选）：生成画面描述、关键词、归类与画质点评，默认关闭且只上传 640px 压缩样张',
      '手动归类：每张照片最多归入三个相册，手动结果优先于自动结果，可一键恢复自动整理',
    ],
  },
]

export const TECH_FACTS: TechFact[] = [
  { label: '画面分析', value: '本机浏览器 Web Worker 内完成' },
  { label: '数据存储', value: '本机 IndexedDB（luma-photo-db v3）' },
  { label: '云端增强', value: '默认关闭，随时可在面板中启停' },
  { label: '上传内容', value: '仅 640px 长边压缩样张，原图不出设备' },
]

export const CURRENT_RELEASE = RELEASE_NOTES[0]
